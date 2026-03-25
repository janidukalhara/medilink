"""
MediLink — VLM Service v4.1
============================
Uses the NEW Google Gen AI SDK (google-genai) with gemini-2.5-flash.

Two fixes from v4.0:
  1. SDK: google-generativeai (deprecated) → google-genai (new official)
  2. Model: gemini-2.5-flash-preview-05-20 → gemini-2.5-flash

Medicine database: 200+ worldwide + 100+ Sri Lanka specific medicines.
"""
from __future__ import annotations

import json
import logging
import os
import re
from typing import Any

from PIL import Image
import io

logger = logging.getLogger(__name__)

_client      = None
_gemini_ready = False
_MODEL        = "gemini-2.5-flash"   # correct stable model name


def init_gemini() -> bool:
    """Initialise Gemini client with new google-genai SDK."""
    global _client, _gemini_ready

    api_key = os.getenv("GEMINI_API_KEY", "").strip()
    if not api_key:
        logger.warning("⚠️  GEMINI_API_KEY not set — using OCR fallback")
        return False

    try:
        from google import genai
        _client = genai.Client(api_key=api_key)
        _gemini_ready = True
        logger.info(f"✅ Gemini client ready — model: {_MODEL}")
        return True
    except Exception as e:
        logger.error(f"❌ Gemini init failed: {e}")
        return False


def is_ready() -> bool:
    return _gemini_ready and _client is not None


# ─── Extraction prompt ────────────────────────────────────────────────────────
_PROMPT = """You are an expert medical prescription reader and pharmacist assistant.
Carefully analyse this prescription image and extract ALL information.

READING INSTRUCTIONS:
- Read every piece of text: handwritten, printed, stamped, typed
- Interpret doctor abbreviations: Tab=Tablet, Cap=Capsule, Syr=Syrup, Inj=Injection
- Frequency codes: OD=Once daily, BD=Twice daily, TDS=Three times daily, QID=Four times daily, PRN/SOS=As needed, Nocte=At night, Mane=Morning, Stat=Immediately, AC=Before meals, PC=After meals
- Duration codes: 5/7=5 days, 2/52=2 weeks, 1/12=1 month
- If handwriting is unclear, use medical knowledge to make your best interpretation
- Calculate quantity = frequency_per_day × duration_days when not written

CONFIDENCE SCORING:
- 90-100: Text clearly readable, medicine name confirmed
- 70-89: Slightly unclear but confident in interpretation
- 50-69: Uncertain, used medical context to guess
- Below 50: Very unclear, low confidence

Return ONLY a valid JSON object — no markdown, no explanation, just the JSON:

{
  "medicines": [
    {
      "name": "Amoxicillin",
      "dosage": "500mg",
      "frequency": "Three times daily",
      "duration": "7 days",
      "quantity": 21,
      "instructions": "Take after meals",
      "confidence": 95,
      "category": "Antibiotic"
    }
  ],
  "patient_info": {
    "name": "John Perera",
    "age": 35,
    "gender": "Male"
  },
  "doctor_info": {
    "name": "Dr. K. Fernando",
    "reg_no": "SLMC/12345",
    "hospital": "National Hospital Colombo"
  },
  "prescription_date": "2024-01-15",
  "diagnosis": "",
  "notes": "",
  "overall_confidence": 88,
  "extraction_notes": "Handwritten prescription, 3 medicines identified"
}

IMPORTANT: If you can see ANY medicine text at all, include it in the medicines array.
Use empty string "" for missing text, null for missing numbers.
Return ONLY the JSON object, nothing else."""


# ─── Main extraction ──────────────────────────────────────────────────────────

def extract_with_gemini(image_bytes: bytes) -> dict[str, Any]:
    if not is_ready():
        return {"success": False, "error": "Gemini not configured", "medicines": []}

    try:
        from google import genai
        from google.genai import types

        # Convert bytes to PIL Image
        pil_image = Image.open(io.BytesIO(image_bytes))
        if pil_image.mode not in ("RGB", "RGBA"):
            pil_image = pil_image.convert("RGB")

        # Convert PIL image to bytes for the new SDK
        img_buf = io.BytesIO()
        pil_image.save(img_buf, format="JPEG", quality=95)
        img_bytes = img_buf.getvalue()

        response = _client.models.generate_content(
            model=_MODEL,
            contents=[
                types.Part.from_text(text=_PROMPT),
                types.Part.from_bytes(data=img_bytes, mime_type="image/jpeg"),
            ],
            config=types.GenerateContentConfig(
                temperature=0.1,
                max_output_tokens=4096,
            ),
        )

        raw = response.text.strip()
        logger.info(f"Gemini response: {len(raw)} chars")

        extracted = _parse_json(raw)
        if not extracted:
            logger.warning("JSON parse failed, attempting repair...")
            extracted = _repair_json(raw)
        if not extracted:
            return {
                "success": False,
                "error": "Gemini returned invalid JSON",
                "raw_response": raw[:300],
                "medicines": [],
            }

        medicines = [_enrich(m) for m in extracted.get("medicines", [])]

        return {
            "success":            True,
            "medicines":          medicines,
            "medicine_count":     len(medicines),
            "patient_info":       extracted.get("patient_info", {}),
            "doctor_info":        extracted.get("doctor_info", {}),
            "prescription_date":  extracted.get("prescription_date", ""),
            "diagnosis":          extracted.get("diagnosis", ""),
            "notes":              extracted.get("notes", ""),
            "overall_confidence": extracted.get("overall_confidence", 0),
            "extraction_notes":   extracted.get("extraction_notes", ""),
            "ocr_confidence":     extracted.get("overall_confidence", 0),
            "engine":             f"gemini-{_MODEL}",
        }

    except Exception as e:
        logger.error(f"Gemini error: {e}", exc_info=True)
        return {"success": False, "error": str(e), "medicines": []}


def _parse_json(text: str) -> dict | None:
    # Strip markdown code fences
    text = re.sub(r"^```(?:json)?\s*", "", text, flags=re.MULTILINE)
    text = re.sub(r"\s*```$",          "", text, flags=re.MULTILINE)
    text = text.strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError:
        m = re.search(r"\{.*\}", text, re.DOTALL)
        if m:
            try: return json.loads(m.group(0))
            except: pass
    return None


def _repair_json(text: str) -> dict | None:
    text = re.sub(r",\s*}", "}", text)
    text = re.sub(r",\s*]", "]", text)
    try: return json.loads(text)
    except: return None


# ─── Medicine database — worldwide + Sri Lanka (200+ medicines) ───────────────
_CATEGORIES: dict[str, str] = {
    # ── Antibiotics ───────────────────────────────────────────────────────────
    "amoxicillin":               "Antibiotic",
    "amoxicillin clavulanate":   "Antibiotic",
    "augmentin":                 "Antibiotic",
    "azithromycin":              "Antibiotic",
    "zithromax":                 "Antibiotic",
    "ciprofloxacin":             "Antibiotic",
    "metronidazole":             "Antibiotic",
    "flagyl":                    "Antibiotic",
    "doxycycline":               "Antibiotic",
    "erythromycin":              "Antibiotic",
    "clarithromycin":            "Antibiotic",
    "cephalexin":                "Antibiotic",
    "cefuroxime":                "Antibiotic",
    "ceftriaxone":               "Antibiotic",
    "cefixime":                  "Antibiotic",
    "cotrimoxazole":             "Antibiotic",
    "septrin":                   "Antibiotic",
    "bactrim":                   "Antibiotic",
    "trimethoprim":              "Antibiotic",
    "nitrofurantoin":            "Antibiotic",
    "clindamycin":               "Antibiotic",
    "linezolid":                 "Antibiotic",
    "meropenem":                 "Antibiotic",
    "piperacillin tazobactam":   "Antibiotic",
    "vancomycin":                "Antibiotic",
    "tetracycline":              "Antibiotic",
    "levofloxacin":              "Antibiotic",
    "moxifloxacin":              "Antibiotic",
    "phenoxymethylpenicillin":   "Antibiotic",
    "benzyl penicillin":         "Antibiotic",
    # ── Anti-TB ───────────────────────────────────────────────────────────────
    "rifampicin":                "Anti-TB",
    "isoniazid":                 "Anti-TB",
    "pyrazinamide":              "Anti-TB",
    "ethambutol":                "Anti-TB",
    "streptomycin":              "Anti-TB",
    # ── Analgesics / NSAIDs ───────────────────────────────────────────────────
    "paracetamol":               "Analgesic",
    "acetaminophen":             "Analgesic",
    "panadol":                   "Analgesic",
    "calpol":                    "Analgesic",
    "ibuprofen":                 "NSAID",
    "brufen":                    "NSAID",
    "advil":                     "NSAID",
    "nurofen":                   "NSAID",
    "diclofenac":                "NSAID",
    "voltaren":                  "NSAID",
    "cataflam":                  "NSAID",
    "mefenamic acid":            "NSAID",
    "ponstan":                   "NSAID",
    "naproxen":                  "NSAID",
    "celecoxib":                 "NSAID",
    "indomethacin":              "NSAID",
    "ketorolac":                 "NSAID",
    "piroxicam":                 "NSAID",
    "tramadol":                  "Opioid Analgesic",
    "tramal":                    "Opioid Analgesic",
    "codeine":                   "Opioid Analgesic",
    "morphine":                  "Opioid Analgesic",
    "fentanyl":                  "Opioid Analgesic",
    "pethidine":                 "Opioid Analgesic",
    "buprenorphine":             "Opioid Analgesic",
    # ── Cardiovascular ────────────────────────────────────────────────────────
    "amlodipine":                "CCB",
    "norvasc":                   "CCB",
    "nifedipine":                "CCB",
    "adalat":                    "CCB",
    "diltiazem":                 "CCB",
    "verapamil":                 "CCB",
    "atenolol":                  "Beta-blocker",
    "tenormin":                  "Beta-blocker",
    "propranolol":               "Beta-blocker",
    "inderal":                   "Beta-blocker",
    "metoprolol":                "Beta-blocker",
    "carvedilol":                "Beta-blocker",
    "bisoprolol":                "Beta-blocker",
    "nebivolol":                 "Beta-blocker",
    "lisinopril":                "ACE Inhibitor",
    "enalapril":                 "ACE Inhibitor",
    "ramipril":                  "ACE Inhibitor",
    "perindopril":               "ACE Inhibitor",
    "captopril":                 "ACE Inhibitor",
    "losartan":                  "ARB",
    "cozaar":                    "ARB",
    "valsartan":                 "ARB",
    "telmisartan":               "ARB",
    "irbesartan":                "ARB",
    "candesartan":               "ARB",
    "olmesartan":                "ARB",
    "furosemide":                "Diuretic",
    "frusemide":                 "Diuretic",
    "lasix":                     "Diuretic",
    "hydrochlorothiazide":       "Diuretic",
    "indapamide":                "Diuretic",
    "spironolactone":            "Diuretic",
    "aldactone":                 "Diuretic",
    "eplerenone":                "Diuretic",
    "digoxin":                   "Cardiac Glycoside",
    "lanoxin":                   "Cardiac Glycoside",
    "amiodarone":                "Antiarrhythmic",
    "aspirin":                   "Antiplatelet",
    "disprin":                   "Antiplatelet",
    "clopidogrel":               "Antiplatelet",
    "plavix":                    "Antiplatelet",
    "ticagrelor":                "Antiplatelet",
    "prasugrel":                 "Antiplatelet",
    "warfarin":                  "Anticoagulant",
    "heparin":                   "Anticoagulant",
    "enoxaparin":                "Anticoagulant",
    "rivaroxaban":               "Anticoagulant",
    "apixaban":                  "Anticoagulant",
    "dabigatran":                "Anticoagulant",
    "atorvastatin":              "Statin",
    "lipitor":                   "Statin",
    "simvastatin":               "Statin",
    "zocor":                     "Statin",
    "rosuvastatin":              "Statin",
    "crestor":                   "Statin",
    "pravastatin":               "Statin",
    "lovastatin":                "Statin",
    "ezetimibe":                 "Cholesterol",
    "fenofibrate":               "Lipid-lowering",
    "nitroglycerin":             "Nitrate",
    "isosorbide mononitrate":    "Nitrate",
    "ivabradine":                "Anti-anginal",
    "sacubitril valsartan":      "ARNi",
    "entresto":                  "ARNi",
    # ── Diabetes ──────────────────────────────────────────────────────────────
    "metformin":                 "Antidiabetic",
    "glucophage":                "Antidiabetic",
    "diaformin":                 "Antidiabetic",
    "glibenclamide":             "Antidiabetic",
    "daonil":                    "Antidiabetic",
    "glipizide":                 "Antidiabetic",
    "gliclazide":                "Antidiabetic",
    "diamicron":                 "Antidiabetic",
    "glimepiride":               "Antidiabetic",
    "amaryl":                    "Antidiabetic",
    "sitagliptin":               "Antidiabetic",
    "januvia":                   "Antidiabetic",
    "vildagliptin":              "Antidiabetic",
    "saxagliptin":               "Antidiabetic",
    "empagliflozin":             "SGLT2 Inhibitor",
    "dapagliflozin":             "SGLT2 Inhibitor",
    "canagliflozin":             "SGLT2 Inhibitor",
    "liraglutide":               "GLP-1 Agonist",
    "semaglutide":               "GLP-1 Agonist",
    "ozempic":                   "GLP-1 Agonist",
    "dulaglutide":               "GLP-1 Agonist",
    "pioglitazone":              "Antidiabetic",
    "acarbose":                  "Antidiabetic",
    "insulin glargine":          "Insulin",
    "insulin aspart":            "Insulin",
    "insulin lispro":            "Insulin",
    "actrapid":                  "Insulin",
    "insulatard":                "Insulin",
    "mixtard":                   "Insulin",
    "humulin":                   "Insulin",
    "lantus":                    "Insulin",
    "novomix":                   "Insulin",
    # ── Respiratory ───────────────────────────────────────────────────────────
    "salbutamol":                "Bronchodilator",
    "ventolin":                  "Bronchodilator",
    "albuterol":                 "Bronchodilator",
    "terbutaline":               "Bronchodilator",
    "bricanyl":                  "Bronchodilator",
    "formoterol":                "LABA",
    "salmeterol":                "LABA",
    "seretide":                  "ICS+LABA",
    "symbicort":                 "ICS+LABA",
    "ipratropium":               "Anticholinergic",
    "tiotropium":                "LAMA",
    "spiriva":                   "LAMA",
    "fluticasone":               "ICS",
    "budesonide":                "ICS",
    "beclomethasone":            "ICS",
    "montelukast":               "Leukotriene Antagonist",
    "singulair":                 "Leukotriene Antagonist",
    "aminophylline":             "Xanthine",
    "theophylline":              "Xanthine",
    "cetirizine":                "Antihistamine",
    "zyrtec":                    "Antihistamine",
    "levocetirizine":            "Antihistamine",
    "xyzal":                     "Antihistamine",
    "loratadine":                "Antihistamine",
    "clarityne":                 "Antihistamine",
    "fexofenadine":              "Antihistamine",
    "allegra":                   "Antihistamine",
    "chlorphenamine":            "Antihistamine",
    "piriton":                   "Antihistamine",
    "diphenhydramine":           "Antihistamine",
    "promethazine":              "Antihistamine",
    "prednisolone":              "Corticosteroid",
    "dexamethasone":             "Corticosteroid",
    "hydrocortisone":            "Corticosteroid",
    "methylprednisolone":        "Corticosteroid",
    "betamethasone":             "Corticosteroid",
    "triamcinolone":             "Corticosteroid",
    # ── GI ────────────────────────────────────────────────────────────────────
    "omeprazole":                "PPI",
    "losec":                     "PPI",
    "pantoprazole":              "PPI",
    "pantoloc":                  "PPI",
    "esomeprazole":              "PPI",
    "nexium":                    "PPI",
    "lansoprazole":              "PPI",
    "rabeprazole":               "PPI",
    "ranitidine":                "H2 Blocker",
    "zantac":                    "H2 Blocker",
    "famotidine":                "H2 Blocker",
    "cimetidine":                "H2 Blocker",
    "sucralfate":                "Gastroprotective",
    "antacid":                   "Antacid",
    "aluminium hydroxide":       "Antacid",
    "magnesium hydroxide":       "Antacid",
    "metoclopramide":            "Antiemetic",
    "maxolon":                   "Antiemetic",
    "ondansetron":               "Antiemetic",
    "zofran":                    "Antiemetic",
    "granisetron":               "Antiemetic",
    "domperidone":               "Antiemetic",
    "motilium":                  "Antiemetic",
    "prochlorperazine":          "Antiemetic",
    "loperamide":                "Antidiarrhoeal",
    "imodium":                   "Antidiarrhoeal",
    "oral rehydration salts":    "Rehydration",
    "ors":                       "Rehydration",
    "bisacodyl":                 "Laxative",
    "senna":                     "Laxative",
    "lactulose":                 "Laxative",
    "macrogol":                  "Laxative",
    "hyoscine":                  "Antispasmodic",
    "buscopan":                  "Antispasmodic",
    "mebeverine":                "Antispasmodic",
    "ursodeoxycholic acid":      "Hepatoprotective",
    "silymarin":                 "Hepatoprotective",
    # ── Vitamins / Supplements ────────────────────────────────────────────────
    "folic acid":                "Vitamin",
    "folate":                    "Vitamin",
    "ferrous sulphate":          "Iron Supplement",
    "ferrous sulfate":           "Iron Supplement",
    "iron":                      "Iron Supplement",
    "ferric carboxymaltose":     "Iron Supplement",
    "vitamin d":                 "Vitamin",
    "cholecalciferol":           "Vitamin",
    "ergocalciferol":            "Vitamin",
    "vitamin d3":                "Vitamin",
    "vitamin c":                 "Vitamin",
    "ascorbic acid":             "Vitamin",
    "vitamin b12":               "Vitamin",
    "cyanocobalamin":            "Vitamin",
    "methylcobalamin":           "Vitamin",
    "vitamin b complex":         "Vitamin",
    "vitamin b1":                "Vitamin",
    "thiamine":                  "Vitamin",
    "vitamin b6":                "Vitamin",
    "pyridoxine":                "Vitamin",
    "vitamin e":                 "Vitamin",
    "vitamin k":                 "Vitamin",
    "vitamin a":                 "Vitamin",
    "zinc":                      "Supplement",
    "zinc sulphate":             "Supplement",
    "calcium carbonate":         "Supplement",
    "calcirol":                  "Supplement",
    "calcium":                   "Supplement",
    "magnesium":                 "Supplement",
    "potassium chloride":        "Electrolyte",
    "sodium bicarbonate":        "Electrolyte",
    "omega 3":                   "Supplement",
    "fish oil":                  "Supplement",
    "multivitamin":              "Vitamin",
    # ── Antiparasitics ────────────────────────────────────────────────────────
    "albendazole":               "Antiparasitic",
    "zentel":                    "Antiparasitic",
    "mebendazole":               "Antiparasitic",
    "vermox":                    "Antiparasitic",
    "praziquantel":              "Antiparasitic",
    "ivermectin":                "Antiparasitic",
    "chloroquine":               "Antimalarial",
    "hydroxychloroquine":        "Antimalarial",
    "artesunate":                "Antimalarial",
    "artemether lumefantrine":   "Antimalarial",
    "coartem":                   "Antimalarial",
    "primaquine":                "Antimalarial",
    # ── Antifungals ───────────────────────────────────────────────────────────
    "fluconazole":               "Antifungal",
    "diflucan":                  "Antifungal",
    "itraconazole":              "Antifungal",
    "ketoconazole":              "Antifungal",
    "nizoral":                   "Antifungal",
    "clotrimazole":              "Antifungal",
    "canesten":                  "Antifungal",
    "terbinafine":               "Antifungal",
    "lamisil":                   "Antifungal",
    "nystatin":                  "Antifungal",
    "amphotericin b":            "Antifungal",
    "voriconazole":              "Antifungal",
    # ── Antivirals ────────────────────────────────────────────────────────────
    "acyclovir":                 "Antiviral",
    "zovirax":                   "Antiviral",
    "valacyclovir":              "Antiviral",
    "famciclovir":               "Antiviral",
    "oseltamivir":               "Antiviral",
    "tamiflu":                   "Antiviral",
    "remdesivir":                "Antiviral",
    "tenofovir":                 "Antiviral",
    "efavirenz":                 "Antiretroviral",
    "lopinavir ritonavir":       "Antiretroviral",
    # ── Thyroid ───────────────────────────────────────────────────────────────
    "levothyroxine":             "Thyroid",
    "thyroxine":                 "Thyroid",
    "eltroxin":                  "Thyroid",
    "synthroid":                 "Thyroid",
    "carbimazole":               "Antithyroid",
    "propylthiouracil":          "Antithyroid",
    # ── CNS / Psychiatry ──────────────────────────────────────────────────────
    "amitriptyline":             "Antidepressant",
    "tryptanol":                 "Antidepressant",
    "fluoxetine":                "Antidepressant",
    "prozac":                    "Antidepressant",
    "sertraline":                "Antidepressant",
    "zoloft":                    "Antidepressant",
    "paroxetine":                "Antidepressant",
    "escitalopram":              "Antidepressant",
    "lexapro":                   "Antidepressant",
    "citalopram":                "Antidepressant",
    "venlafaxine":               "Antidepressant",
    "duloxetine":                "Antidepressant",
    "mirtazapine":               "Antidepressant",
    "bupropion":                 "Antidepressant",
    "clomipramine":              "Antidepressant",
    "diazepam":                  "Benzodiazepine",
    "valium":                    "Benzodiazepine",
    "lorazepam":                 "Benzodiazepine",
    "ativan":                    "Benzodiazepine",
    "alprazolam":                "Benzodiazepine",
    "xanax":                     "Benzodiazepine",
    "clonazepam":                "Benzodiazepine",
    "midazolam":                 "Benzodiazepine",
    "zolpidem":                  "Hypnotic",
    "zopiclone":                 "Hypnotic",
    "quetiapine":                "Antipsychotic",
    "seroquel":                  "Antipsychotic",
    "olanzapine":                "Antipsychotic",
    "zyprexa":                   "Antipsychotic",
    "risperidone":               "Antipsychotic",
    "risperdal":                 "Antipsychotic",
    "haloperidol":               "Antipsychotic",
    "chlorpromazine":            "Antipsychotic",
    "lithium":                   "Mood Stabilizer",
    "sodium valproate":          "Anticonvulsant",
    "valproic acid":             "Anticonvulsant",
    "carbamazepine":             "Anticonvulsant",
    "tegretol":                  "Anticonvulsant",
    "phenytoin":                 "Anticonvulsant",
    "levetiracetam":             "Anticonvulsant",
    "keppra":                    "Anticonvulsant",
    "lamotrigine":               "Anticonvulsant",
    "topiramate":                "Anticonvulsant",
    "gabapentin":                "Anticonvulsant",
    "pregabalin":                "Anticonvulsant",
    "phenobarbitone":            "Anticonvulsant",
    "donepezil":                 "Dementia",
    "memantine":                 "Dementia",
    "rivastigmine":              "Dementia",
    "levodopa":                  "Parkinson's",
    "co-careldopa":              "Parkinson's",
    "madopar":                   "Parkinson's",
    "sinemet":                   "Parkinson's",
    # ── Urology / Renal ───────────────────────────────────────────────────────
    "tamsulosin":                "Alpha-blocker",
    "finasteride":               "5-alpha reductase inhibitor",
    "sildenafil":                "PDE5 Inhibitor",
    "tadalafil":                 "PDE5 Inhibitor",
    "oxybutynin":                "Anticholinergic",
    "solifenacin":               "Anticholinergic",
    "allopurinol":               "Gout",
    "colchicine":                "Gout",
    "febuxostat":                "Gout",
    # ── Ophthalmology ─────────────────────────────────────────────────────────
    "timolol eye drops":         "Glaucoma",
    "latanoprost":               "Glaucoma",
    "dorzolamide":               "Glaucoma",
    "betaxolol":                 "Glaucoma",
    "chloramphenicol eye drops": "Eye Antibiotic",
    "ciprofloxacin eye drops":   "Eye Antibiotic",
    "ofloxacin eye drops":       "Eye Antibiotic",
    "dexamethasone eye drops":   "Eye Steroid",
    "atropine eye drops":        "Mydriatic",
    "tropicamide":               "Mydriatic",
    # ── Dermatology ───────────────────────────────────────────────────────────
    "betamethasone cream":       "Topical Steroid",
    "hydrocortisone cream":      "Topical Steroid",
    "clobetasol":                "Topical Steroid",
    "mometasone":                "Topical Steroid",
    "calamine lotion":           "Topical",
    "mupirocin":                 "Topical Antibiotic",
    "fusidic acid":              "Topical Antibiotic",
    "benzoyl peroxide":          "Acne",
    "tretinoin":                 "Retinoid",
    "isotretinoin":              "Retinoid",
    # ── Oncology (common Sri Lanka) ───────────────────────────────────────────
    "tamoxifen":                 "Hormonal Therapy",
    "letrozole":                 "Hormonal Therapy",
    "anastrozole":               "Hormonal Therapy",
    "dexamethasone":             "Corticosteroid",
    # ── Sri Lanka specific / common branded ───────────────────────────────────
    "novalgin":                  "Analgesic",        # metamizole — common in LK
    "metamizole":                "Analgesic",
    "piroxicam":                 "NSAID",            # widely used in LK
    "chlorpheniramine":          "Antihistamine",
    "pheniramine":               "Antihistamine",
    "antazoline":                "Antihistamine",
    "cyproheptadine":            "Antihistamine",
    "pizotifen":                 "Migraine",
    "ergotamine":                "Migraine",
    "sumatriptan":               "Migraine",
    "mefenamic acid":            "NSAID",
    "norfloxacin":               "Antibiotic",
    "ofloxacin":                 "Antibiotic",
    "cefadroxil":                "Antibiotic",
    "cefalexin":                 "Antibiotic",
    "ampicillin":                "Antibiotic",
    "cloxacillin":               "Antibiotic",
    "dicloxacillin":             "Antibiotic",
    "fusidic acid":              "Antibiotic",
    "povidone iodine":           "Antiseptic",
    "chlorhexidine":             "Antiseptic",
    "hydrogen peroxide":         "Antiseptic",
    "zinc oxide":                "Topical",
    "calamine":                  "Topical",
    "gentian violet":            "Antiseptic",
    "permethrin":                "Antiparasitic",
    "lindane":                   "Antiparasitic",
    "benzyl benzoate":           "Antiparasitic",
    "mifepristone":              "Reproductive",
    "misoprostol":               "Reproductive",
    "oxytocin":                  "Reproductive",
    "ergometrine":               "Reproductive",
    "progesterone":              "Hormone",
    "estradiol":                 "Hormone",
    "norethisterone":            "Hormone",
    "medroxyprogesterone":       "Hormone",
    "oral contraceptive pill":   "Contraceptive",
    "depot medroxyprogesterone": "Contraceptive",
    "hyoscine butylbromide":     "Antispasmodic",
    "dicyclomine":               "Antispasmodic",
    "ranitidine":                "H2 Blocker",
    "drotaverine":               "Antispasmodic",
    "methyldopa":                "Antihypertensive",
    "hydralazine":               "Antihypertensive",
    "prazosin":                  "Alpha-blocker",
    "clonidine":                 "Antihypertensive",
    "moxonidine":                "Antihypertensive",
    "minoxidil":                 "Antihypertensive",
    "diosmin":                   "Vascular",
    "hesperidin":                "Vascular",
    "pentoxifylline":            "Vascular",
    "aescin":                    "Vascular",
    "pancreatin":                "Digestive Enzyme",
    "pepsin":                    "Digestive Enzyme",
    "papain":                    "Digestive Enzyme",
    "serratiopeptidase":         "Anti-inflammatory Enzyme",
    "bromelain":                 "Anti-inflammatory Enzyme",
    "trypsin chymotrypsin":      "Anti-inflammatory Enzyme",
    "racecadotril":              "Antidiarrhoeal",
    "kaolin pectin":             "Antidiarrhoeal",
    "activated charcoal":        "Antidote",
    "n acetylcysteine":          "Antidote",
    "naloxone":                  "Antidote",
    "glucagon":                  "Antidote",
    "atropine":                  "Anticholinergic",
    "neostigmine":               "Anticholinesterase",
    "pyridostigmine":            "Anticholinesterase",
    "theophylline":              "Bronchodilator",
    "doxofylline":               "Bronchodilator",
    "acetylcysteine":            "Mucolytic",
    "ambroxol":                  "Mucolytic",
    "bromhexine":                "Mucolytic",
    "guaifenesin":               "Expectorant",
    "codeine linctus":           "Cough Suppressant",
    "dextromethorphan":          "Cough Suppressant",
    "benzocaine":                "Local Anaesthetic",
    "lignocaine":                "Local Anaesthetic",
    "lidocaine":                 "Local Anaesthetic",
    "bupivacaine":               "Local Anaesthetic",
    "ketamine":                  "Anaesthetic",
    "propofol":                  "Anaesthetic",
    "thiopentone":               "Anaesthetic",
    "succinylcholine":           "Neuromuscular Blocker",
    "vecuronium":                "Neuromuscular Blocker",
}


def _enrich(med: dict) -> dict:
    """Add category from DB, ensure all fields present."""
    name = med.get("name", "").lower().strip()
    if not med.get("category") or med.get("category") == "Medicine":
        for key, cat in _CATEGORIES.items():
            if key in name or name in key:
                med["category"] = cat
                break
        else:
            med["category"] = "Medicine"

    med.setdefault("dosage",       "")
    med.setdefault("frequency",    "")
    med.setdefault("duration",     "")
    med.setdefault("quantity",     None)
    med.setdefault("instructions", "")
    med.setdefault("confidence",   75)

    return med
