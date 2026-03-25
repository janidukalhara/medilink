"""
MediLink — NLP Service (v3)
============================
Pipeline architecture based on aryaman.space/ScanPlus approach:

  OCR text
    ↓
  [Stage 1] BERT contextual embeddings  (d4data/biomedical-ner-all)
    → identifies CHEMICAL / DRUG entity spans with confidence scores
    ↓
  [Stage 2] Rule-based extraction       (regex patterns)
    → dosage, frequency, duration, patient info, doctor info
    → fills fields BERT doesn't cover (structured prescription fields)
    ↓
  [Stage 3] Fuzzy entity linking        (rapidfuzz)
    → corrects OCR mangled names: "Amoxicilin" → "Amoxicillin"
    → links to canonical medicine DB for category, common doses
    ↓
  [Stage 4] Confidence scoring          (BERT score + rule coverage)
    → per-medicine confidence 0–100
    ↓
  Structured JSON output

Writing style analysis (from word-level OCR data):
  → avg confidence, variance, style label (printed/semi-cursive/cursive)
"""

from __future__ import annotations

import re
import logging
from typing import List, Dict, Any, Optional

from rapidfuzz import process as fuzz_proc, fuzz

from services.ner_model import (
    bert_ner_extract,
    rule_extract_patient, rule_extract_doctor, rule_extract_date,
    rule_extract_frequency, rule_extract_duration, rule_extract_dosage,
    rule_extract_qty, rule_extract_instructions, DOSAGE_RE,
)

logger = logging.getLogger(__name__)

# ═══════════════════════════════════════════════════════════════════════════════
# MEDICINE DATABASE — Sri Lanka + International (70+ entries)
# Used for fuzzy OCR correction and entity enrichment
# ═══════════════════════════════════════════════════════════════════════════════
MEDICINE_DB: List[Dict[str, Any]] = [
    # Antibiotics
    {"name":"Amoxicillin","aliases":["Amoxil"],"category":"Antibiotic","doses":["250mg","500mg"]},
    {"name":"Amoxicillin Clavulanate","aliases":["Augmentin","Co-amoxiclav"],"category":"Antibiotic","doses":["625mg","1g"]},
    {"name":"Azithromycin","aliases":["Zithromax","Azee"],"category":"Antibiotic","doses":["250mg","500mg"]},
    {"name":"Ciprofloxacin","aliases":["Cipro"],"category":"Antibiotic","doses":["250mg","500mg","750mg"]},
    {"name":"Metronidazole","aliases":["Flagyl"],"category":"Antibiotic","doses":["200mg","400mg","500mg"]},
    {"name":"Doxycycline","category":"Antibiotic","doses":["100mg"]},
    {"name":"Erythromycin","category":"Antibiotic","doses":["250mg","500mg"]},
    {"name":"Clarithromycin","aliases":["Klacid"],"category":"Antibiotic","doses":["250mg","500mg"]},
    {"name":"Cephalexin","aliases":["Keflex"],"category":"Antibiotic","doses":["250mg","500mg"]},
    {"name":"Cefuroxime","category":"Antibiotic","doses":["250mg","500mg"]},
    {"name":"Cotrimoxazole","aliases":["Septrin","Bactrim"],"category":"Antibiotic","doses":["480mg","960mg"]},
    {"name":"Phenoxymethylpenicillin","aliases":["Pen V"],"category":"Antibiotic","doses":["250mg"]},
    # Analgesics / NSAIDs
    {"name":"Paracetamol","aliases":["Panadol","Acetaminophen","Calpol"],"category":"Analgesic","doses":["500mg","1g"]},
    {"name":"Ibuprofen","aliases":["Brufen","Advil","Nurofen"],"category":"NSAID","doses":["200mg","400mg","600mg"]},
    {"name":"Diclofenac","aliases":["Voltaren","Cataflam"],"category":"NSAID","doses":["25mg","50mg","75mg"]},
    {"name":"Mefenamic Acid","aliases":["Ponstan"],"category":"NSAID","doses":["250mg","500mg"]},
    {"name":"Naproxen","aliases":["Naprosyn"],"category":"NSAID","doses":["250mg","500mg"]},
    {"name":"Tramadol","aliases":["Tramal"],"category":"Opioid Analgesic","doses":["50mg","100mg"]},
    {"name":"Codeine","category":"Opioid Analgesic","doses":["15mg","30mg","60mg"]},
    # Cardiovascular
    {"name":"Amlodipine","aliases":["Norvasc","Amlip"],"category":"CCB","doses":["2.5mg","5mg","10mg"]},
    {"name":"Atenolol","aliases":["Tenormin"],"category":"Beta-blocker","doses":["25mg","50mg","100mg"]},
    {"name":"Propranolol","aliases":["Inderal"],"category":"Beta-blocker","doses":["10mg","40mg","80mg"]},
    {"name":"Lisinopril","aliases":["Zestril","Prinivil"],"category":"ACE Inhibitor","doses":["5mg","10mg","20mg"]},
    {"name":"Losartan","aliases":["Cozaar"],"category":"ARB","doses":["25mg","50mg","100mg"]},
    {"name":"Nifedipine","aliases":["Adalat"],"category":"CCB","doses":["5mg","10mg","20mg"]},
    {"name":"Furosemide","aliases":["Lasix","Frusemide"],"category":"Diuretic","doses":["20mg","40mg","80mg"]},
    {"name":"Spironolactone","aliases":["Aldactone"],"category":"Diuretic","doses":["25mg","50mg","100mg"]},
    {"name":"Digoxin","aliases":["Lanoxin"],"category":"Cardiac Glycoside","doses":["0.125mg","0.25mg"]},
    {"name":"Aspirin","aliases":["Disprin"],"category":"Antiplatelet","doses":["75mg","150mg","300mg"]},
    {"name":"Clopidogrel","aliases":["Plavix"],"category":"Antiplatelet","doses":["75mg"]},
    {"name":"Atorvastatin","aliases":["Lipitor","Storvas"],"category":"Statin","doses":["10mg","20mg","40mg","80mg"]},
    {"name":"Simvastatin","aliases":["Zocor"],"category":"Statin","doses":["10mg","20mg","40mg"]},
    # Diabetes
    {"name":"Metformin","aliases":["Glucophage","Diaformin"],"category":"Antidiabetic","doses":["500mg","850mg","1000mg"]},
    {"name":"Glibenclamide","aliases":["Daonil","Euglucon"],"category":"Antidiabetic","doses":["2.5mg","5mg"]},
    {"name":"Glipizide","aliases":["Minidiab"],"category":"Antidiabetic","doses":["5mg","10mg"]},
    {"name":"Gliclazide","aliases":["Diamicron"],"category":"Antidiabetic","doses":["40mg","80mg"]},
    {"name":"Insulin","aliases":["Actrapid","Insulatard","Mixtard","Humulin"],"category":"Insulin"},
    # Respiratory
    {"name":"Salbutamol","aliases":["Ventolin","Albuterol"],"category":"Bronchodilator","doses":["2mg","4mg","100mcg"]},
    {"name":"Montelukast","aliases":["Singulair"],"category":"Leukotriene antagonist","doses":["4mg","5mg","10mg"]},
    {"name":"Cetirizine","aliases":["Zyrtec","Zirtec"],"category":"Antihistamine","doses":["5mg","10mg"]},
    {"name":"Levocetirizine","aliases":["Xyzal"],"category":"Antihistamine","doses":["2.5mg","5mg"]},
    {"name":"Chlorphenamine","aliases":["Piriton","Chlorpheniramine"],"category":"Antihistamine","doses":["4mg"]},
    {"name":"Prednisolone","category":"Corticosteroid","doses":["5mg","10mg","20mg","40mg"]},
    {"name":"Dexamethasone","category":"Corticosteroid","doses":["0.5mg","1mg","4mg","8mg"]},
    # GI
    {"name":"Omeprazole","aliases":["Losec","Prilosec"],"category":"PPI","doses":["10mg","20mg","40mg"]},
    {"name":"Pantoprazole","aliases":["Pantoloc"],"category":"PPI","doses":["20mg","40mg"]},
    {"name":"Esomeprazole","aliases":["Nexium"],"category":"PPI","doses":["20mg","40mg"]},
    {"name":"Ranitidine","aliases":["Zantac"],"category":"H2 Blocker","doses":["75mg","150mg","300mg"]},
    {"name":"Metoclopramide","aliases":["Maxolon","Reglan"],"category":"Antiemetic","doses":["5mg","10mg"]},
    {"name":"Ondansetron","aliases":["Zofran"],"category":"Antiemetic","doses":["4mg","8mg"]},
    {"name":"Domperidone","aliases":["Motilium"],"category":"Antiemetic","doses":["10mg"]},
    {"name":"Loperamide","aliases":["Imodium"],"category":"Antidiarrhoeal","doses":["2mg"]},
    # Vitamins
    {"name":"Folic Acid","aliases":["Folate"],"category":"Vitamin","doses":["0.4mg","1mg","5mg"]},
    {"name":"Ferrous Sulphate","aliases":["Iron","Ferrous Sulfate"],"category":"Iron Supplement","doses":["200mg","325mg"]},
    {"name":"Vitamin D","aliases":["Cholecalciferol","Calciferol"],"category":"Vitamin","doses":["400IU","1000IU","2000IU"]},
    {"name":"Calcium Carbonate","aliases":["Calcirol","Calcium"],"category":"Supplement","doses":["500mg","1000mg"]},
    {"name":"Vitamin B Complex","category":"Vitamin"},
    {"name":"Vitamin C","aliases":["Ascorbic Acid"],"category":"Vitamin","doses":["250mg","500mg"]},
    # Antiparasitics
    {"name":"Albendazole","aliases":["Zentel"],"category":"Antiparasitic","doses":["200mg","400mg"]},
    {"name":"Mebendazole","aliases":["Vermox"],"category":"Antiparasitic","doses":["100mg","500mg"]},
    # Antifungals
    {"name":"Fluconazole","aliases":["Diflucan","Forcan"],"category":"Antifungal","doses":["50mg","100mg","150mg","200mg"]},
    {"name":"Ketoconazole","aliases":["Nizoral"],"category":"Antifungal","doses":["200mg"]},
    {"name":"Clotrimazole","aliases":["Canesten"],"category":"Antifungal"},
    # Antivirals
    {"name":"Acyclovir","aliases":["Zovirax"],"category":"Antiviral","doses":["200mg","400mg","800mg"]},
    # Thyroid
    {"name":"Levothyroxine","aliases":["Eltroxin","Thyroxine","Synthroid"],"category":"Thyroid","doses":["25mcg","50mcg","100mcg","150mcg"]},
    # CNS
    {"name":"Amitriptyline","aliases":["Tryptanol","Elavil"],"category":"Antidepressant","doses":["10mg","25mg","50mg"]},
    {"name":"Diazepam","aliases":["Valium","Stesolid"],"category":"Benzodiazepine","doses":["2mg","5mg","10mg"]},
    {"name":"Lorazepam","aliases":["Ativan"],"category":"Benzodiazepine","doses":["0.5mg","1mg","2mg"]},
]

# Build lookup structures
MEDICINE_NAMES   = [m["name"] for m in MEDICINE_DB]
_ALIAS_TO_CANON: Dict[str, str] = {}
_NAME_TO_INFO:   Dict[str, Dict] = {}
for _m in MEDICINE_DB:
    _NAME_TO_INFO[_m["name"].lower()] = _m
    for _alias in _m.get("aliases", []):
        _ALIAS_TO_CANON[_alias.lower()] = _m["name"]
        _NAME_TO_INFO[_alias.lower()]   = _m

# Lines that are definitely NOT medicine lines
_SKIP_RE = re.compile(
    r"^(?:date|d/o|age|address|phone|tel|fax|rx|prescription|signature|stamp"
    r"|hospital|clinic|dear|to\s+whom|please|note:|page\s+\d|ref\s*no"
    r"|serial|ward|ip\s*no|op\s*no|registration)",
    re.I,
)


# ═══════════════════════════════════════════════════════════════════════════════
# ENTITY LINKER — OCR correction via fuzzy matching
# ═══════════════════════════════════════════════════════════════════════════════

def _link_medicine(raw: str, threshold: int = 78) -> Optional[str]:
    """
    Map a raw OCR string → canonical medicine name.
    Handles typical OCR errors: letter substitutions, missing chars, etc.
    """
    if not raw or len(raw) < 3:
        return None
    low = raw.lower().strip()

    # 1. Exact match
    if low in _NAME_TO_INFO:
        return _NAME_TO_INFO[low]["name"]

    # 2. Fuzzy match across all names + aliases
    all_names = MEDICINE_NAMES + list(_ALIAS_TO_CANON.keys())
    result = fuzz_proc.extractOne(raw, all_names, scorer=fuzz.WRatio)
    if result and result[1] >= threshold:
        matched = result[0]
        # Resolve alias → canonical
        return _ALIAS_TO_CANON.get(matched.lower(), matched)
    return None


# ═══════════════════════════════════════════════════════════════════════════════
# STAGE 1: BERT NER → medicine name candidates
# ═══════════════════════════════════════════════════════════════════════════════

def _bert_candidates(text: str) -> List[Dict[str, Any]]:
    """Run BERT NER and return medicine-entity candidates."""
    raw = bert_ner_extract(text, min_score=0.50)
    candidates = []
    for ent in raw:
        if ent["label"] != "MEDICINE":
            continue
        # Link to canonical name
        canonical = _link_medicine(ent["word"])
        if canonical:
            candidates.append({"raw": ent["word"], "canonical": canonical, "score": ent["score"]})
        elif len(ent["word"]) > 4:
            # Keep unmatched BERT entities — they might be valid
            candidates.append({"raw": ent["word"], "canonical": ent["word"].title(), "score": ent["score"] * 0.6})
    return candidates


# ═══════════════════════════════════════════════════════════════════════════════
# STAGE 2: Rule-based line-by-line extraction (fallback + enrichment)
# ═══════════════════════════════════════════════════════════════════════════════

def _rule_candidates(text: str) -> List[str]:
    """
    Extract medicine-candidate words from text using rule heuristics.
    Returns list of raw candidate strings.
    """
    lines = [l.strip() for l in text.splitlines() if l.strip()]
    cands: List[str] = []
    seen_lower: set = set()

    for line in lines:
        if _SKIP_RE.match(line):
            continue

        # Lines with dosage data are most likely medicine lines
        if not DOSAGE_RE.search(line) and len(line) > 80:
            continue

        # Remove leading number/bullet
        clean = re.sub(r"^[\d]+[.):\-]\s*", "", line).strip()

        # Extract the first multi-char token (most likely the medicine name)
        tokens = re.split(r"[\s,/]+", clean)
        for tok in tokens[:3]:                         # check first 3 tokens
            tok = re.sub(r"[^a-zA-Z\s\-]", "", tok).strip()
            if len(tok) < 4:
                continue
            linked = _link_medicine(tok)
            if linked and linked.lower() not in seen_lower:
                seen_lower.add(linked.lower())
                cands.append(linked)

        # Also check multi-word (e.g. "Amoxicillin Clavulanate")
        for length in (2, 3):
            for start in range(max(0, len(tokens) - length + 1)):
                phrase = " ".join(tokens[start: start + length])
                phrase = re.sub(r"[^a-zA-Z\s\-]", "", phrase).strip()
                if len(phrase) < 6:
                    continue
                linked = _link_medicine(phrase)
                if linked and linked.lower() not in seen_lower:
                    seen_lower.add(linked.lower())
                    cands.append(linked)

    return cands


# ═══════════════════════════════════════════════════════════════════════════════
# STAGE 3: Merge + Enrich medicine records
# ═══════════════════════════════════════════════════════════════════════════════

def _build_medicine_record(
    name: str,
    text: str,
    bert_score: float = 0.0,
) -> Dict[str, Any]:
    """
    Given a confirmed medicine name, extract all associated fields
    from the surrounding text context.
    """
    # Find the context window around the medicine name mention
    pattern = re.escape(name.split()[0])            # match on first word
    spans = list(re.finditer(pattern, text, re.I))
    if spans:
        s = spans[0].start()
        window = text[max(0, s - 30): min(len(text), s + 200)]
    else:
        window = text

    dosage       = rule_extract_dosage(window)
    frequency    = rule_extract_frequency(window)
    duration     = rule_extract_duration(window)
    qty          = rule_extract_qty(window)
    instructions = rule_extract_instructions(window)

    # Compute quantity from freq × duration when not explicit
    if not qty and frequency and duration:
        freq_map = {
            "Once daily":1, "Twice daily":2, "Three times daily":3, "Four times daily":4,
        }
        dur_re = re.search(r"(\d+)\s*(day|week|month)", duration, re.I)
        if dur_re:
            n   = int(dur_re.group(1))
            unit = dur_re.group(2).lower()
            mult = {"day":1,"week":7,"month":30}.get(unit, 0)
            f   = freq_map.get(frequency, 0)
            if f and mult:
                qty = f * n * mult

    # Confidence scoring
    info = _NAME_TO_INFO.get(name.lower(), {})
    confidence = 50
    if bert_score > 0.7:  confidence += 20
    elif bert_score > 0.5: confidence += 10
    if dosage:       confidence += 15
    if frequency:    confidence += 12
    if duration:     confidence += 8
    if info:         confidence += 10    # confirmed in DB
    confidence = min(confidence, 100)

    return {
        "name":         name,
        "dosage":       dosage,
        "frequency":    frequency,
        "duration":     duration,
        "quantity":     qty,
        "instructions": instructions,
        "confidence":   confidence,
        "category":     info.get("category", ""),
        "common_doses": info.get("doses", []),
    }


# ═══════════════════════════════════════════════════════════════════════════════
# PUBLIC API
# ═══════════════════════════════════════════════════════════════════════════════

def extract_medicines(text: str) -> List[Dict[str, Any]]:
    """
    Full BERT + Rule pipeline for medicine extraction.
    Returns deduplicated, enriched medicine records.
    """
    bert_cands = _bert_candidates(text)
    rule_cands = _rule_candidates(text)

    # Merge: BERT candidates take priority (higher confidence)
    bert_score_map = {c["canonical"].lower(): c["score"] for c in bert_cands}
    seen:  set = set()
    names: List[Tuple] = []

    for c in bert_cands:
        key = c["canonical"].lower()
        if key not in seen:
            seen.add(key)
            names.append((c["canonical"], c["score"]))

    for name in rule_cands:
        key = name.lower()
        if key not in seen:
            seen.add(key)
            names.append((name, 0.0))   # no BERT score

    medicines = [
        _build_medicine_record(name, text, score)
        for name, score in names
    ]

    # Sort by confidence descending
    medicines.sort(key=lambda x: x["confidence"], reverse=True)
    return medicines


def extract_patient_info(text: str) -> Dict[str, Any]:
    return rule_extract_patient(text)


def extract_doctor_info(text: str) -> Dict[str, Any]:
    return rule_extract_doctor(text)


def extract_prescription_date(text: str) -> Optional[str]:
    return rule_extract_date(text)


# ─── Writing style analysis ───────────────────────────────────────────────────
def analyze_writing_style(ocr_words: List[Dict]) -> Dict[str, Any]:
    """
    Classify handwriting style from word-level Tesseract data.
    Categories: printed | semi-cursive | cursive-handwritten
    """
    if not ocr_words:
        return {"style": "unknown", "avg_confidence": 0, "word_count": 0,
                "readability": "unknown", "is_handwritten": False}

    confs    = [w["conf"] for w in ocr_words if isinstance(w.get("conf"), (int, float)) and w["conf"] > 0]
    avg_conf = round(sum(confs) / len(confs), 1) if confs else 0

    widths = [w.get("width", 0) / max(len(w.get("word", "x")), 1) for w in ocr_words]
    if widths:
        mean_w  = sum(widths) / len(widths)
        variance = (max(widths) - min(widths)) / mean_w if mean_w else 0
    else:
        variance = 0

    style = "printed" if avg_conf >= 72 else "semi-cursive" if avg_conf >= 52 else "cursive-handwritten"

    return {
        "style":            style,
        "avg_confidence":   avg_conf,
        "word_count":       len(ocr_words),
        "char_width_variance": round(variance, 2),
        "is_handwritten":   avg_conf < 72,
        "readability":      "high" if avg_conf >= 70 else "medium" if avg_conf >= 50 else "low",
    }
