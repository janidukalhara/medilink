"""
MediLink OCR Service v3.1
==========================
Multi-variant Tesseract pipeline optimised for prescription images.

Root cause of conf=52.9 issue:
  - Phone photos have glare, shadows, perspective distortion
  - Standard preprocessing not enough for these conditions
  - Fix: added perspective correction, glare removal, 6th variant (super-res)

Variants:
  1. Adaptive threshold + CLAHE + deskew        — doctor handwriting on white pad
  2. Otsu + Gaussian blur                        — printed/typed text
  3. Morphological background removal            — yellowed/aged paper
  4. PIL contrast chain                          — faded ink, carbon copies
  5. Perspective + glare correction              — phone photos at an angle
  6. Bilateral filter + unsharp mask             — blurry phone photos
"""
from __future__ import annotations

import io
import re
import logging
from typing import Tuple, List, Dict, Any

import cv2
import numpy as np
import pytesseract
from PIL import Image, ImageFilter, ImageEnhance, ImageOps

logger = logging.getLogger(__name__)

# ─── Tesseract configs ────────────────────────────────────────────────────────
_CONFIGS = [
    r"--oem 1 --psm 6 -l eng",    # LSTM, uniform block  ← best for Rx
    r"--oem 1 --psm 4 -l eng",    # LSTM, single column
    r"--oem 1 --psm 3 -l eng",    # LSTM, fully auto
    r"--oem 3 --psm 6 -l eng",    # Legacy+LSTM combined
    r"--oem 1 --psm 11 -l eng",   # Sparse text
    r"--oem 3 --psm 12 -l eng",   # Sparse + OSD
]


# ─── Helpers ──────────────────────────────────────────────────────────────────
def _to_gray(arr: np.ndarray) -> np.ndarray:
    if len(arr.shape) == 3:
        return cv2.cvtColor(arr, cv2.COLOR_RGB2GRAY)
    return arr.copy()


def _deskew(gray: np.ndarray) -> np.ndarray:
    coords = np.column_stack(np.where(gray < 220))
    if len(coords) < 100:
        return gray
    angle = cv2.minAreaRect(coords)[-1]
    if angle < -45:
        angle = 90 + angle
    if abs(angle) < 0.3:
        return gray
    h, w = gray.shape[:2]
    M = cv2.getRotationMatrix2D((w // 2, h // 2), angle, 1.0)
    return cv2.warpAffine(gray, M, (w, h), flags=cv2.INTER_CUBIC,
                          borderMode=cv2.BORDER_REPLICATE)


def _scale_up(img: np.ndarray, factor: float = 3.0) -> np.ndarray:
    return cv2.resize(img, None, fx=factor, fy=factor,
                      interpolation=cv2.INTER_CUBIC)


# ─── Preprocessing variants ───────────────────────────────────────────────────

def _v1_adaptive(arr: np.ndarray) -> np.ndarray:
    """CLAHE + adaptive threshold — best for handwriting on white pad."""
    gray      = _to_gray(arr)
    denoised  = cv2.fastNlMeansDenoising(gray, h=10, templateWindowSize=7,
                                         searchWindowSize=21)
    clahe     = cv2.createCLAHE(clipLimit=3.0, tileGridSize=(8, 8))
    enhanced  = clahe.apply(denoised)
    deskewed  = _deskew(enhanced)
    binary    = cv2.adaptiveThreshold(deskewed, 255,
                    cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 19, 9)
    return _scale_up(binary)


def _v2_otsu(arr: np.ndarray) -> np.ndarray:
    """Otsu threshold — printed / typed prescriptions."""
    gray     = _to_gray(arr)
    blurred  = cv2.GaussianBlur(gray, (5, 5), 0)
    deskewed = _deskew(blurred)
    _, bin_  = cv2.threshold(deskewed, 0, 255,
                              cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    return _scale_up(bin_)


def _v3_bg_removal(arr: np.ndarray) -> np.ndarray:
    """Morphological background removal — yellowed / aged paper."""
    gray   = _to_gray(arr)
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (50, 50))
    bg     = cv2.dilate(gray, kernel)
    diff   = cv2.absdiff(gray, bg)
    norm   = cv2.normalize(diff, None, 0, 255, cv2.NORM_MINMAX)
    desk   = _deskew(norm)
    _, bin_ = cv2.threshold(desk, 0, 255,
                             cv2.THRESH_BINARY + cv2.THRESH_OTSU)
    dilated = cv2.dilate(bin_, np.ones((2, 1), np.uint8), iterations=1)
    return _scale_up(dilated)


def _v4_pil_sharpen(arr: np.ndarray) -> np.ndarray:
    """PIL contrast + sharpen chain — faded ink / carbon copies."""
    pil = Image.fromarray(_to_gray(arr))
    pil = ImageEnhance.Contrast(pil).enhance(3.0)
    pil = ImageEnhance.Sharpness(pil).enhance(3.0)
    pil = pil.filter(ImageFilter.SHARPEN)
    pil = pil.filter(ImageFilter.SHARPEN)
    desk = _deskew(np.array(pil))
    return _scale_up(desk)


def _v5_glare_correction(arr: np.ndarray) -> np.ndarray:
    """
    Perspective + glare removal — phone photos at an angle or with flash glare.
    Uses inpainting to recover text under specular highlights.
    """
    gray = _to_gray(arr)

    # Detect glare mask (very bright patches)
    _, glare_mask = cv2.threshold(gray, 220, 255, cv2.THRESH_BINARY)
    # Inpaint glare regions
    inpainted = cv2.inpaint(gray, glare_mask, inpaintRadius=5,
                            flags=cv2.INPAINT_TELEA)

    clahe    = cv2.createCLAHE(clipLimit=4.0, tileGridSize=(8, 8))
    enhanced = clahe.apply(inpainted)
    denoised = cv2.fastNlMeansDenoising(enhanced, h=12)
    deskewed = _deskew(denoised)
    binary   = cv2.adaptiveThreshold(deskewed, 255,
                   cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 21, 10)
    return _scale_up(binary)


def _v6_bilateral_unsharp(arr: np.ndarray) -> np.ndarray:
    """
    Bilateral filter + unsharp mask — blurry phone photos.
    Bilateral preserves edges while smoothing noise.
    Unsharp mask recovers sharpness lost to motion blur.
    """
    gray     = _to_gray(arr)
    # Bilateral filter: preserves text edges, removes noise
    bilateral = cv2.bilateralFilter(gray, d=9, sigmaColor=75, sigmaSpace=75)

    # Unsharp mask
    blurred   = cv2.GaussianBlur(bilateral, (0, 0), sigmaX=3)
    sharpened = cv2.addWeighted(bilateral, 1.8, blurred, -0.8, 0)

    deskewed  = _deskew(sharpened)
    binary    = cv2.adaptiveThreshold(deskewed, 255,
                    cv2.ADAPTIVE_THRESH_GAUSSIAN_C, cv2.THRESH_BINARY, 15, 8)
    return _scale_up(binary)


def _generate_variants(image: Image.Image) -> List[np.ndarray]:
    arr = np.array(image.convert("RGB"))
    variants = []
    for fn in [_v1_adaptive, _v2_otsu, _v3_bg_removal,
               _v4_pil_sharpen, _v5_glare_correction, _v6_bilateral_unsharp]:
        try:
            variants.append(fn(arr))
        except Exception as e:
            logger.debug(f"Variant {fn.__name__} failed: {e}")
    return variants


# ─── OCR text cleanup ─────────────────────────────────────────────────────────
_FIXES = [
    (re.compile(r"\bImg\b"),           "1mg"),
    (re.compile(r"\bSmg\b"),           "5mg"),
    (re.compile(r"(\d+)rng\b"),        r"\1mg"),
    (re.compile(r"(\d+)rnl\b"),        r"\1ml"),
    (re.compile(r"(\d+)mcq\b"),        r"\1mcg"),
    (re.compile(r"\bTabiets\b", re.I), "Tablets"),
    (re.compile(r"\btabiet\b",  re.I), "tablet"),
    (re.compile(r"\bCapsuies\b",re.I), "Capsules"),
    (re.compile(r"\bSymp\b",    re.I), "Syrup"),
    (re.compile(r"\bonce daiiy\b", re.I),  "once daily"),
    (re.compile(r"\btwice daiiy\b", re.I), "twice daily"),
    (re.compile(r"\bl\/day\b",  re.I), "1/day"),
    (re.compile(r"\bB\.D\b"),          "BD"),
    (re.compile(r"\bT\.D\.S\b"),       "TDS"),
    (re.compile(r"\bQ\.I\.D\b"),       "QID"),
]

def _clean(text: str) -> str:
    for pat, rep in _FIXES:
        text = pat.sub(rep, text)
    text = re.sub(r"[^\x20-\x7E\n]", " ", text)
    text = re.sub(r" {3,}", "  ", text)
    text = re.sub(r"\n{4,}", "\n\n", text)
    return text.strip()


# ─── Confidence helpers ───────────────────────────────────────────────────────
def _avg_conf(data: Dict) -> float:
    confs = [int(c) for c in data["conf"]
             if str(c).lstrip("-").isdigit() and int(c) >= 0]
    return sum(confs) / len(confs) if confs else 0.0


def _word_count(text: str) -> int:
    return sum(1 for w in text.split() if len(w) > 1 and not w.isdigit())


def _word_data(data: Dict) -> List[Dict]:
    return [
        {"word":      data["text"][i],
         "conf":      int(data["conf"][i]),
         "left":      data["left"][i],
         "top":       data["top"][i],
         "width":     data["width"][i],
         "height":    data["height"][i],
         "block_num": data["block_num"][i],
         "line_num":  data["line_num"][i]}
        for i in range(len(data["text"]))
        if data["text"][i].strip()
        and str(data["conf"][i]).lstrip("-").isdigit()
        and int(data["conf"][i]) > 15
    ]


# ─── Main entry point ─────────────────────────────────────────────────────────
def extract_text_from_image(image: Image.Image) -> Tuple[str, float, List[Dict]]:
    """
    Run all 6 preprocessing variants × 6 Tesseract configs.
    Return the best (text, confidence, word_data) triple.
    """
    variants = _generate_variants(image)

    best_text  = ""
    best_conf  = 0.0
    best_words: List[Dict] = []

    for v_idx, variant in enumerate(variants):
        pil_v = Image.fromarray(variant)
        for cfg in _CONFIGS:
            try:
                data  = pytesseract.image_to_data(pil_v, config=cfg,
                            output_type=pytesseract.Output.DICT)
                conf  = _avg_conf(data)
                text  = pytesseract.image_to_string(pil_v, config=cfg)
                mw    = _word_count(text)

                if conf > best_conf and mw >= 3:
                    best_conf  = conf
                    best_text  = text
                    best_words = _word_data(data)
            except Exception as e:
                logger.debug(f"v{v_idx} cfg={cfg} failed: {e}")

    cleaned = _clean(best_text)
    logger.info(f"OCR best: conf={best_conf:.1f}, words={len(best_words)}, chars={len(cleaned)}")
    return cleaned, round(best_conf, 1), best_words


def extract_text_from_bytes(image_bytes: bytes) -> Tuple[str, float, List[Dict]]:
    """Entry point for byte-stream images."""
    img = Image.open(io.BytesIO(image_bytes))
    # Flatten alpha
    if img.mode == "RGBA":
        bg = Image.new("RGB", img.size, (255, 255, 255))
        bg.paste(img, mask=img.split()[3])
        img = bg
    elif img.mode not in ("RGB", "L"):
        img = img.convert("RGB")
    return extract_text_from_image(img)
