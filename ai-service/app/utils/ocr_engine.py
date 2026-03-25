"""
OCR Engine — Tesseract + preprocessing for prescription text extraction
"""
import pytesseract
import logging
import time
import os
from PIL import Image
from typing import Tuple, Dict, Any
from app.utils.image_processing import preprocess_image_for_ocr, pdf_page_to_image
from app.config import settings

logger = logging.getLogger(__name__)

# Configure Tesseract path
if os.path.exists(settings.TESSERACT_CMD):
    pytesseract.pytesseract.tesseract_cmd = settings.TESSERACT_CMD


# Tesseract config for prescriptions
TESSERACT_CONFIGS = {
    'default': '--oem 3 --psm 6 -l eng',
    'single_block': '--oem 3 --psm 6 -l eng',
    'sparse': '--oem 3 --psm 11 -l eng',
    'single_line': '--oem 3 --psm 7 -l eng',
    'handwritten': '--oem 1 --psm 6 -l eng',  # LSTM only
}


class OCREngine:
    def __init__(self):
        self._check_tesseract()

    def _check_tesseract(self):
        """Verify Tesseract installation."""
        try:
            version = pytesseract.get_tesseract_version()
            logger.info(f"Tesseract version: {version}")
        except Exception as e:
            logger.error(f"Tesseract not found: {e}")
            raise RuntimeError(
                "Tesseract OCR is not installed or not in PATH. "
                "Install it with: sudo apt-get install tesseract-ocr"
            )

    def extract_text(self, image_bytes: bytes, is_pdf: bool = False) -> Dict[str, Any]:
        """
        Extract text from prescription image using multi-pass OCR.
        Returns raw text and confidence score.
        """
        start_time = time.time()

        if is_pdf:
            image_bytes = pdf_page_to_image(image_bytes)

        # Preprocess image
        processed_image = preprocess_image_for_ocr(image_bytes)

        # Multi-pass OCR with different configs
        results = []
        for config_name, config in TESSERACT_CONFIGS.items():
            try:
                text = pytesseract.image_to_string(processed_image, config=config)
                data = pytesseract.image_to_data(
                    processed_image,
                    config=config,
                    output_type=pytesseract.Output.DICT
                )
                conf = self._calculate_confidence(data)
                results.append((text, conf, config_name))
                logger.debug(f"Config '{config_name}': confidence={conf:.2f}, chars={len(text)}")
            except Exception as e:
                logger.warning(f"OCR config '{config_name}' failed: {e}")

        # Pick best result
        if not results:
            raise RuntimeError("All OCR configurations failed")

        best_text, best_conf, best_config = max(results, key=lambda x: (x[1], len(x[0])))

        # Also try the original image if confidence is low
        if best_conf < 0.5:
            try:
                orig_image = Image.open(__import__('io').BytesIO(image_bytes)) if not is_pdf else processed_image
                fallback_text = pytesseract.image_to_string(
                    orig_image, config=TESSERACT_CONFIGS['default']
                )
                if len(fallback_text.strip()) > len(best_text.strip()):
                    best_text = fallback_text
            except Exception:
                pass

        elapsed_ms = (time.time() - start_time) * 1000
        word_count = len(best_text.split())

        logger.info(
            f"OCR complete: {word_count} words, "
            f"confidence={best_conf:.2f}, config={best_config}, "
            f"time={elapsed_ms:.0f}ms"
        )

        return {
            'raw_text': best_text,
            'confidence_score': best_conf,
            'word_count': word_count,
            'language': 'en',
            'processing_time_ms': elapsed_ms,
            'config_used': best_config,
        }

    def _calculate_confidence(self, ocr_data: Dict) -> float:
        """Calculate average confidence from Tesseract word-level data."""
        confidences = [
            c for c in ocr_data.get('conf', [])
            if isinstance(c, (int, float)) and c >= 0
        ]
        if not confidences:
            return 0.0
        avg = sum(confidences) / len(confidences)
        return round(avg / 100.0, 4)  # Tesseract returns 0-100


# ─── Singleton ───────────────────────────────────────────────────────────────
ocr_engine = OCREngine()
