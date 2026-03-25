"""
Image preprocessing utilities for improved OCR accuracy
"""
import cv2
import numpy as np
from PIL import Image, ImageEnhance, ImageFilter
import io
import logging
from typing import Tuple

logger = logging.getLogger(__name__)


def preprocess_image_for_ocr(image_bytes: bytes) -> Image.Image:
    """
    Apply a comprehensive preprocessing pipeline to maximize OCR accuracy.
    """
    # Convert bytes to numpy array
    nparr = np.frombuffer(image_bytes, np.uint8)
    img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)

    if img is None:
        raise ValueError("Could not decode image")

    # Step 1: Resize if too small
    h, w = img.shape[:2]
    if w < 1000:
        scale = 1500 / w
        img = cv2.resize(img, None, fx=scale, fy=scale, interpolation=cv2.INTER_CUBIC)

    # Step 2: Convert to grayscale
    gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

    # Step 3: Deskew
    gray = deskew(gray)

    # Step 4: Denoise
    gray = cv2.fastNlMeansDenoising(gray, h=10, templateWindowSize=7, searchWindowSize=21)

    # Step 5: Adaptive thresholding for handwritten text
    binary = cv2.adaptiveThreshold(
        gray, 255,
        cv2.ADAPTIVE_THRESH_GAUSSIAN_C,
        cv2.THRESH_BINARY,
        31, 10
    )

    # Step 6: Morphological operations to clean up noise
    kernel = np.ones((1, 1), np.uint8)
    binary = cv2.morphologyEx(binary, cv2.MORPH_CLOSE, kernel)
    binary = cv2.morphologyEx(binary, cv2.MORPH_OPEN, kernel)

    # Step 7: Border padding
    binary = cv2.copyMakeBorder(binary, 20, 20, 20, 20, cv2.BORDER_CONSTANT, value=255)

    # Convert back to PIL
    pil_image = Image.fromarray(binary)

    # Step 8: Enhance sharpness
    enhancer = ImageEnhance.Sharpness(pil_image)
    pil_image = enhancer.enhance(2.0)

    # Step 9: Enhance contrast
    enhancer = ImageEnhance.Contrast(pil_image)
    pil_image = enhancer.enhance(1.5)

    return pil_image


def deskew(image: np.ndarray) -> np.ndarray:
    """
    Detect and correct image skew for better OCR results.
    """
    try:
        coords = np.column_stack(np.where(image < 128))
        if len(coords) == 0:
            return image
        angle = cv2.minAreaRect(coords)[-1]
        if angle < -45:
            angle = -(90 + angle)
        else:
            angle = -angle

        # Only deskew if skew is significant
        if abs(angle) < 0.5:
            return image

        h, w = image.shape[:2]
        center = (w // 2, h // 2)
        M = cv2.getRotationMatrix2D(center, angle, 1.0)
        rotated = cv2.warpAffine(
            image, M, (w, h),
            flags=cv2.INTER_CUBIC,
            borderMode=cv2.BORDER_REPLICATE
        )
        return rotated
    except Exception as e:
        logger.warning(f"Deskew failed: {e}")
        return image


def remove_background_noise(image: np.ndarray) -> np.ndarray:
    """Remove background noise from prescription images."""
    # CLAHE for contrast enhancement
    clahe = cv2.createCLAHE(clipLimit=2.0, tileGridSize=(8, 8))
    return clahe.apply(image)


def extract_text_regions(image: np.ndarray) -> list:
    """Find and return bounding boxes of text regions."""
    # Dilate to find text blocks
    kernel = cv2.getStructuringElement(cv2.MORPH_RECT, (20, 3))
    dilated = cv2.dilate(image, kernel, iterations=1)

    contours, _ = cv2.findContours(
        cv2.bitwise_not(dilated),
        cv2.RETR_EXTERNAL,
        cv2.CHAIN_APPROX_SIMPLE
    )

    regions = []
    for cnt in contours:
        x, y, w, h = cv2.boundingRect(cnt)
        if w > 50 and h > 10:  # Filter small noise
            regions.append((x, y, w, h))

    return sorted(regions, key=lambda r: r[1])  # Sort top to bottom


def bytes_to_pil(image_bytes: bytes) -> Image.Image:
    """Convert raw bytes to PIL Image."""
    return Image.open(io.BytesIO(image_bytes))


def pdf_page_to_image(pdf_bytes: bytes, page_num: int = 0) -> bytes:
    """Convert PDF page to image bytes."""
    try:
        import fitz  # PyMuPDF
        doc = fitz.open(stream=pdf_bytes, filetype="pdf")
        page = doc[page_num]
        mat = fitz.Matrix(2.0, 2.0)  # 2x zoom for better quality
        pix = page.get_pixmap(matrix=mat)
        return pix.tobytes("png")
    except Exception as e:
        logger.error(f"PDF conversion failed: {e}")
        raise
