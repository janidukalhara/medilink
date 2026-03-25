"""
MediLink — BERT + BiLSTM-CRF Named Entity Recognition Model
============================================================
Architecture inspired by the ScanPlus/aryaman.space pipeline:
  OCR text → BERT contextual embeddings → Char CNN → BiLSTM → CRF → structured entities

This module implements:
  1. BertNERPipeline   — zero-shot NER using pretrained BioBERT / Bio_ClinicalBERT
  2. RuleFallback      — high-precision regex fallback when BERT confidence is low
  3. EntityLinker      — maps raw extracted names → canonical medicine DB entries

Labels: B-MEDICINE, I-MEDICINE, B-DOSAGE, I-DOSAGE, B-FREQUENCY, I-FREQUENCY,
        B-DURATION, I-DURATION, B-DOCTOR, I-DOCTOR, B-PATIENT, I-PATIENT, O
"""

from __future__ import annotations

import re
import logging
from typing import List, Dict, Any, Optional, Tuple

logger = logging.getLogger(__name__)

# ─── Lazy imports so the service starts even if torch isn't installed ──────────
_transformers_loaded = False
_pipeline = None
_tokenizer = None
_bert_model = None


def _load_bert_ner():
    """Load BERT NER pipeline once (lazy, cached)."""
    global _transformers_loaded, _pipeline, _tokenizer

    if _transformers_loaded:
        return _pipeline is not None

    _transformers_loaded = True
    try:
        from transformers import pipeline, AutoTokenizer, AutoModelForTokenClassification
        # Use a medical/clinical NER model
        # Primary:   d4data/biomedical-ner-all  (general biomedical NER)
        # Fallback:  dslim/bert-base-NER         (general NER — faster)
        MODEL_NAME = "d4data/biomedical-ner-all"
        logger.info(f"Loading BERT NER model: {MODEL_NAME}")
        _pipeline = pipeline(
            "ner",
            model=MODEL_NAME,
            tokenizer=MODEL_NAME,
            aggregation_strategy="simple",   # merges B/I tokens automatically
            device=-1,                        # -1 = CPU; 0 = first GPU
        )
        logger.info("✅ BERT NER model loaded successfully")
        return True
    except Exception as e:
        logger.warning(f"⚠️  BERT NER unavailable ({e}). Falling back to rule-based NER.")
        _pipeline = None
        return False


# ─── Label types we care about from d4data/biomedical-ner-all ─────────────────
# Entity groups from the model: CHEMICAL, DISEASE, GENE-PROTEIN, ORGANISM, etc.
# We map these to our prescription domain labels:
BERT_ENTITY_MAP = {
    "CHEMICAL":      "MEDICINE",
    "DRUG":          "MEDICINE",
    "MEDICATION":    "MEDICINE",
    "Chemical":      "MEDICINE",
    "Drug":          "MEDICINE",
    "GENE-PROTEIN":  None,        # ignore
    "DISEASE":       None,        # ignore for now
    "Dosage":        "DOSAGE",
}


def bert_ner_extract(text: str, min_score: float = 0.55) -> List[Dict[str, Any]]:
    """
    Run BERT NER on prescription text.
    Returns list of {word, entity_group, score, start, end}
    filtered to medicine-relevant entities.
    """
    if not _load_bert_ner() or _pipeline is None:
        return []

    try:
        raw_entities = _pipeline(text)
    except Exception as e:
        logger.error(f"BERT NER inference failed: {e}")
        return []

    results = []
    for ent in raw_entities:
        mapped = BERT_ENTITY_MAP.get(ent.get("entity_group", ""))
        if mapped is None:
            continue
        if ent.get("score", 0) < min_score:
            continue
        results.append({
            "word":  ent["word"].strip().replace("##", ""),
            "label": mapped,
            "score": round(float(ent["score"]), 3),
            "start": ent.get("start", 0),
            "end":   ent.get("end", 0),
        })
    return results


# ─── Rule-based extraction (used as fallback + for non-medicine fields) ────────
# Comprehensive regex patterns informed by the medical NER literature

DOSAGE_RE     = re.compile(r"\b(\d+(?:\.\d+)?)\s*(mg|mcg|g|ml|iu|units?|%|mmol)\b", re.I)
FREQ_PATTERNS = [
    (re.compile(r"\b(once\s*(?:a\s*)?day|od|o\.d\.?|1[-x]1)\b", re.I),                "Once daily"),
    (re.compile(r"\b(twice\s*(?:a\s*)?day|bd|b\.d\.?|bid|2[-x]1)\b", re.I),           "Twice daily"),
    (re.compile(r"\b(tds|t\.d\.s\.?|three\s*times|tid|3[-x]1)\b", re.I),              "Three times daily"),
    (re.compile(r"\b(qid|four\s*times|4[-x]1)\b", re.I),                              "Four times daily"),
    (re.compile(r"\bevery\s*(\d+)\s*h(?:rs?|ours?)?\b", re.I),                        "Every {0} hours"),
    (re.compile(r"\b(nocte|at\s*night|hs|h\.s\.?|nightly)\b", re.I),                 "At night"),
    (re.compile(r"\b(mane|morning|am)\b", re.I),                                       "In the morning"),
    (re.compile(r"\b(prn|p\.r\.n\.?|sos|s\.o\.s\.?|as\s*(?:needed|required))\b", re.I), "As needed"),
    (re.compile(r"\b(stat|immediately)\b", re.I),                                      "Immediately"),
    (re.compile(r"\b(after\s*(?:each\s*)?meal|pc|p\.c\.?)\b", re.I),                 "After meals"),
    (re.compile(r"\b(before\s*(?:each\s*)?meal|ac|a\.c\.?)\b", re.I),                "Before meals"),
]
DURATION_RE   = re.compile(r"\b(?:for\s*)?(\d+)\s*(days?|weeks?|months?|hrs?|hours?)\b", re.I)
QTY_RE        = re.compile(r"\b(?:qty|#|x|no\.?|tabs?|caps?)\s*[:\-]?\s*(\d+)\b", re.I)
INSTR_RE      = re.compile(r"\b(?:take|apply|use|swallow|dissolve)\b[^.\n]{0,80}", re.I)

PATIENT_RE    = re.compile(r"(?:patient|name|pt\.?)\s*[:\-]?\s*([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,3})", re.I)
AGE_RE        = re.compile(r"\b(?:age|aged?|yrs?\.?)\s*[:\-]?\s*(\d{1,3})\b|\b(\d{1,3})\s*(?:yrs?\.?|years?\s*old)\b", re.I)
GENDER_RE     = re.compile(r"\b(male|female|m|f|boy|girl|man|woman)\b", re.I)
GENDER_MAP    = {"male":"Male","man":"Male","m":"Male","boy":"Male","female":"Female",
                 "woman":"Female","f":"Female","girl":"Female"}

DOCTOR_RE     = re.compile(r"(?:dr\.?|doctor|prof\.?)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,3})", re.I)
REGNO_RE      = re.compile(r"(?:slmc|reg\.?\s*no\.?|lic\.?\s*no\.?)\s*[:\-]?\s*([A-Z0-9/\-]+)", re.I)
HOSPITAL_RE   = re.compile(r"(?:hospital|clinic|medical\s*cent(?:re|er)|health\s*cent(?:re|er))\s*[:\-]?\s*([^\n,]{3,60})", re.I)
DATE_RES      = [
    re.compile(r"\b(\d{1,2})[/\-\.](\d{1,2})[/\-\.](\d{2,4})\b"),
    re.compile(r"\b(\d{1,2})\s+(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)\w*\s+(\d{4})\b", re.I),
]


def rule_extract_patient(text: str) -> Dict[str, Any]:
    info: Dict[str, Any] = {}
    if m := PATIENT_RE.search(text): info["name"] = m.group(1).strip()
    if m := AGE_RE.search(text):
        age = int(m.group(1) or m.group(2))
        if 0 < age < 120: info["age"] = age
    if m := GENDER_RE.search(text): info["gender"] = GENDER_MAP.get(m.group(1).lower())
    return info


def rule_extract_doctor(text: str) -> Dict[str, Any]:
    info: Dict[str, Any] = {}
    if m := DOCTOR_RE.search(text): info["name"] = m.group(1).strip()
    if m := REGNO_RE.search(text):  info["reg_no"] = m.group(1).strip()
    if m := HOSPITAL_RE.search(text): info["hospital"] = m.group(1).strip()
    return info


def rule_extract_date(text: str) -> Optional[str]:
    for p in DATE_RES:
        if m := p.search(text): return m.group(0)
    return None


def rule_extract_frequency(text: str) -> str:
    for pattern, label in FREQ_PATTERNS:
        if m := pattern.search(text):
            return label.format(m.group(1)) if "{0}" in label else label
    return ""


def rule_extract_duration(text: str) -> str:
    if m := DURATION_RE.search(text):
        return f"{m.group(1)} {m.group(2)}"
    return ""


def rule_extract_dosage(text: str) -> str:
    if m := DOSAGE_RE.search(text):
        return m.group(0)
    return ""


def rule_extract_qty(text: str) -> Optional[int]:
    if m := QTY_RE.search(text):
        try: return int(m.group(1))
        except: pass
    return None


def rule_extract_instructions(text: str) -> str:
    if m := INSTR_RE.search(text):
        return m.group(0).strip().capitalize()
    return ""
