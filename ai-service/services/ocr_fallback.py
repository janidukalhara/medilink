"""
MediLink — OCR Fallback Service
=================================
Used ONLY when Gemini API key is not configured or API call fails.
Performs Tesseract OCR + rule-based NLP extraction.

This is a simplified but working fallback — not as powerful as VLM.
"""
from __future__ import annotations

import io
import re
import logging
from typing import Tuple, List, Dict, Any, Optional

import cv2
import numpy as np
import pytesseract
from PIL import Image, ImageFilter, ImageEnhance
from rapidfuzz import process as fuzz_proc, fuzz

logger = logging.getLogger(__name__)

# ─── Tesseract configs ────────────────────────────────────────────────────────
_CONFIGS = [
    r"--oem 1 --psm 6 -l eng",
    r"--oem 1 --psm 4 -l eng",
    r"--oem 3 --psm 6 -l eng",
    r"--oem 1 --psm 11 -l eng",
]

# ─── Medicine database for fuzzy matching ─────────────────────────────────────
MEDICINES = [
    "Amoxicillin","Amoxicillin Clavulanate","Azithromycin","Ciprofloxacin",
    "Metronidazole","Cephalexin","Doxycycline","Erythromycin","Clarithromycin",
    "Cotrimoxazole","Paracetamol","Ibuprofen","Diclofenac","Mefenamic Acid",
    "Naproxen","Tramadol","Amlodipine","Atenolol","Propranolol","Lisinopril",
    "Losartan","Furosemide","Spironolactone","Digoxin","Aspirin","Clopidogrel",
    "Atorvastatin","Simvastatin","Metformin","Glibenclamide","Gliclazide",
    "Insulin","Salbutamol","Montelukast","Cetirizine","Levocetirizine",
    "Chlorphenamine","Prednisolone","Dexamethasone","Omeprazole","Pantoprazole",
    "Esomeprazole","Ranitidine","Metoclopramide","Ondansetron","Domperidone",
    "Folic Acid","Ferrous Sulphate","Vitamin D","Vitamin C","Calcium Carbonate",
    "Vitamin B Complex","Levothyroxine","Thyroxine","Amitriptyline","Diazepam",
    "Fluconazole","Acyclovir","Albendazole","Mebendazole","Ketoconazole",
]

FREQ_PATTERNS = [
    (re.compile(r"\b(od|o\.d\.?|once\s*daily|1[-x]1)\b", re.I),   "Once daily"),
    (re.compile(r"\b(bd|b\.d\.?|twice\s*daily|bid|2[-x]1)\b", re.I), "Twice daily"),
    (re.compile(r"\b(tds|t\.d\.s\.?|three\s*times|tid|3[-x]1)\b", re.I), "Three times daily"),
    (re.compile(r"\b(qid|four\s*times|4[-x]1)\b", re.I),          "Four times daily"),
    (re.compile(r"\bevery\s*(\d+)\s*h\b", re.I),                   "Every {0} hours"),
    (re.compile(r"\b(nocte|at\s*night|hs)\b", re.I),               "At night"),
    (re.compile(r"\b(mane|morning)\b", re.I),                      "In the morning"),
    (re.compile(r"\b(prn|sos|as\s*needed)\b", re.I),               "As needed"),
]
DOSAGE_RE   = re.compile(r"\b\d+(?:\.\d+)?\s*(?:mg|mcg|g|ml|iu|units?)\b", re.I)
DURATION_RE = re.compile(r"\b(?:for\s*)?(\d+)\s*(days?|weeks?|months?)\b", re.I)
QTY_RE      = re.compile(r"\b(?:qty|#|x)\s*[:\-]?\s*(\d+)\b", re.I)

PATIENT_RE  = re.compile(r"(?:patient|name|pt\.?)\s*[:\-]?\s*([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,3})", re.I)
AGE_RE      = re.compile(r"\b(?:age|aged?)\s*[:\-]?\s*(\d{1,3})\b|\b(\d{1,3})\s*(?:yrs?|years?\s*old)\b", re.I)
DOCTOR_RE   = re.compile(r"(?:dr\.?|doctor)\s+([A-Z][a-zA-Z]+(?:\s+[A-Z][a-zA-Z]+){0,3})", re.I)
HOSPITAL_RE = re.compile(r"(?:hospital|clinic)\s*[:\-]?\s*([^\n,]{3,50})", re.I)
DATE_RE     = re.compile(r"\b(\d{1,2})[/\-\.](\d{1,2})[/\-\.](\d{2,4})\b")


# ─── Image preprocessing ──────────────────────────────────────────────────────

def _preprocess(image: Image.Image) -> List[np.ndarray]:
    arr = np.array(image.convert("RGB"))
    gray = cv2.cvtColor(arr, cv2.COLOR_RGB2GRAY) if len(arr.shape) == 3 else arr
    variants = []

    # Variant 1: adaptive threshold + CLAHE
    try:
        denoised = cv2.fastNlMeansDenoising(gray, h=10)
        clahe    = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
        enhanced = clahe.apply(denoised)
        binary   = cv2.adaptiveThreshold(enhanced, 255, cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
                                         cv2.THRESH_BINARY, 19, 9)
        variants.append(cv2.resize(binary, None, fx=3, fy=3, interpolation=cv2.INTER_CUBIC))
    except Exception: pass

    # Variant 2: Otsu
    try:
        blurred = cv2.GaussianBlur(gray, (5, 5), 0)
        _, bin2 = cv2.threshold(blurred, 0, 255, cv2.THRESH_BINARY + cv2.THRESH_OTSU)
        variants.append(cv2.resize(bin2, None, fx=3, fy=3, interpolation=cv2.INTER_CUBIC))
    except Exception: pass

    # Variant 3: PIL sharpen
    try:
        pil = Image.fromarray(gray)
        pil = ImageEnhance.Contrast(pil).enhance(2.5)
        pil = pil.filter(ImageFilter.SHARPEN)
        variants.append(cv2.resize(np.array(pil), None, fx=3, fy=3, interpolation=cv2.INTER_CUBIC))
    except Exception: pass

    return variants


def _run_ocr(image: Image.Image) -> Tuple[str, float]:
    variants = _preprocess(image)
    best_text, best_conf = "", 0.0
    for v in variants:
        pil_v = Image.fromarray(v)
        for cfg in _CONFIGS:
            try:
                data  = pytesseract.image_to_data(pil_v, config=cfg,
                            output_type=pytesseract.Output.DICT)
                confs = [int(c) for c in data["conf"]
                         if str(c).lstrip("-").isdigit() and int(c) >= 0]
                conf  = sum(confs) / len(confs) if confs else 0.0
                text  = pytesseract.image_to_string(pil_v, config=cfg)
                mw    = sum(1 for w in text.split() if len(w) > 1)
                if conf > best_conf and mw >= 3:
                    best_conf, best_text = conf, text
            except Exception:
                continue
    return best_text.strip(), round(best_conf, 1)


# ─── NLP extraction from OCR text ────────────────────────────────────────────

def _fuzzy_match(word: str) -> Optional[str]:
    if len(word) < 4: return None
    r = fuzz_proc.extractOne(word, MEDICINES, scorer=fuzz.WRatio)
    return r[0] if r and r[1] >= 80 else None


def _extract_medicines_from_text(text: str) -> List[Dict]:
    lines  = [l.strip() for l in text.splitlines() if l.strip()]
    found: List[Dict] = []
    seen:  set = set()

    for i, line in enumerate(lines):
        # skip header lines
        if re.match(r"^(?:date|age|name|rx|dr\.|hospital|phone|address)", line, re.I):
            continue

        tokens = re.split(r"[\s,/]+", re.sub(r"^[\d.)\-]+\s*", "", line))
        matched_name: Optional[str] = None

        for length in (3, 2, 1):
            for start in range(min(4, max(0, len(tokens) - length + 1))):
                phrase = " ".join(tokens[start:start+length]).strip()
                phrase = re.sub(r"[^a-zA-Z\s\-]", "", phrase).strip()
                if len(phrase) < 4: continue
                m = _fuzzy_match(phrase)
                if m and m.lower() not in seen:
                    matched_name = m
                    break
            if matched_name: break

        if not matched_name: continue
        seen.add(matched_name.lower())

        ctx = line + " " + (lines[i+1] if i+1 < len(lines) else "")
        dosage    = (DOSAGE_RE.search(ctx) or type('', (), {'group': lambda self, x: ''})()).group(0)  # noqa
        dosage    = DOSAGE_RE.search(ctx)
        dosage    = dosage.group(0) if dosage else ""
        freq      = ""
        for pat, label in FREQ_PATTERNS:
            m2 = pat.search(ctx)
            if m2:
                freq = label.format(m2.group(1)) if "{0}" in label else label
                break
        dur  = DURATION_RE.search(ctx)
        dur  = f"{dur.group(1)} {dur.group(2)}" if dur else ""
        qty  = QTY_RE.search(ctx)
        qty  = int(qty.group(1)) if qty else None

        conf = 50
        if dosage: conf += 20
        if freq:   conf += 15
        if dur:    conf += 10
        conf = min(conf, 95)

        found.append({
            "name":         matched_name,
            "dosage":       dosage,
            "frequency":    freq,
            "duration":     dur,
            "quantity":     qty,
            "instructions": "",
            "confidence":   conf,
            "category":     "",
        })
    return found


def _extract_info(text: str) -> Tuple[Dict, Dict, Optional[str]]:
    patient, doctor = {}, {}
    if m := PATIENT_RE.search(text): patient["name"] = m.group(1).strip()
    if m := AGE_RE.search(text):     patient["age"]  = int(m.group(1) or m.group(2))
    if m := DOCTOR_RE.search(text):  doctor["name"]  = m.group(1).strip()
    if m := HOSPITAL_RE.search(text): doctor["hospital"] = m.group(1).strip()
    date = None
    if m := DATE_RE.search(text):    date = m.group(0)
    return patient, doctor, date


# ─── Public API ───────────────────────────────────────────────────────────────

def extract_with_ocr_fallback(image_bytes: bytes) -> Dict[str, Any]:
    """Full OCR + rule-based NLP pipeline (fallback when Gemini unavailable)."""
    try:
        img = Image.open(io.BytesIO(image_bytes))
        if img.mode not in ("RGB", "L"):
            img = img.convert("RGB")

        raw_text, ocr_conf = _run_ocr(img)
        logger.info(f"OCR fallback: conf={ocr_conf}, chars={len(raw_text)}")

        if len(raw_text.strip()) < 5:
            return {
                "success": False,
                "error":   "Could not extract text. Upload a clearer image.",
                "medicines": [], "overall_confidence": 0,
                "engine": "ocr-fallback",
            }

        medicines = _extract_medicines_from_text(raw_text)
        patient, doctor, date = _extract_info(raw_text)

        nlp_conf = (
            sum(m["confidence"] for m in medicines) / len(medicines)
            if medicines else 0
        )
        overall = round(ocr_conf * 0.5 + nlp_conf * 0.5, 1)

        return {
            "success":           True,
            "raw_text":          raw_text,
            "ocr_confidence":    ocr_conf,
            "overall_confidence": overall,
            "medicines":         medicines,
            "medicine_count":    len(medicines),
            "patient_info":      patient,
            "doctor_info":       doctor,
            "prescription_date": date,
            "engine":            "ocr-tesseract-fallback",
            "extraction_notes":  f"OCR confidence {ocr_conf}%. Add GEMINI_API_KEY for better results.",
        }

    except Exception as e:
        logger.error(f"OCR fallback error: {e}", exc_info=True)
        return {
            "success": False, "error": str(e),
            "medicines": [], "engine": "ocr-fallback",
        }
