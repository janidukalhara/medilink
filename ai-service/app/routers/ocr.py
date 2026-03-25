"""
OCR Router — handles prescription image upload and text extraction
"""
from fastapi import APIRouter, UploadFile, File, HTTPException, Form
from fastapi.responses import JSONResponse
import logging
import time
from typing import Optional

from app.models.schemas import ExtractionResult, OCRResult, PatientInfo, DoctorInfo, MedicineEntry
from app.utils.ocr_engine import ocr_engine
from app.utils.nlp_engine import nlp_engine

router = APIRouter()
logger = logging.getLogger(__name__)

ALLOWED_TYPES = {
    "image/jpeg", "image/jpg", "image/png",
    "image/webp", "image/tiff", "application/pdf"
}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB


@router.post("/extract", response_model=ExtractionResult)
async def extract_prescription(
    file: UploadFile = File(..., description="Prescription image (JPG/PNG/PDF)"),
    enhance_image: bool = Form(default=True),
):
    """
    Main endpoint: Upload prescription → OCR extraction → NLP analysis → structured result.
    """
    # Validate file type
    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(
            status_code=415,
            detail=f"Unsupported file type: {file.content_type}. Allowed: JPEG, PNG, PDF, WEBP, TIFF"
        )

    # Read file
    image_bytes = await file.read()
    if len(image_bytes) > MAX_FILE_SIZE:
        raise HTTPException(status_code=413, detail="File too large. Maximum 10MB allowed.")
    if len(image_bytes) < 100:
        raise HTTPException(status_code=400, detail="File appears to be empty or corrupt.")

    is_pdf = file.content_type == "application/pdf"

    try:
        # ── Step 1: OCR ──────────────────────────────────────────────
        ocr_result = ocr_engine.extract_text(image_bytes, is_pdf=is_pdf)
        raw_text = ocr_result['raw_text']

        if not raw_text.strip():
            return ExtractionResult(
                success=False,
                ocr=OCRResult(**ocr_result),
                warnings=["OCR produced no readable text. Image quality may be too low."],
                overall_confidence=0.0,
            )

        logger.info(f"OCR extracted {ocr_result['word_count']} words")

        # ── Step 2: NLP Extraction ───────────────────────────────────
        medicines_raw = nlp_engine.extract_medicines(raw_text)
        patient_raw = nlp_engine.extract_patient_info(raw_text)
        doctor_raw = nlp_engine.extract_doctor_info(raw_text)
        diagnosis = nlp_engine.extract_diagnosis(raw_text)

        # Convert to Pydantic models
        medicines = [MedicineEntry(**m) for m in medicines_raw]
        patient_info = PatientInfo(**patient_raw)
        doctor_info = DoctorInfo(**doctor_raw)

        # ── Step 3: Confidence calculation ───────────────────────────
        ocr_conf = ocr_result['confidence_score']
        med_conf = (
            sum(m.confidence for m in medicines) / len(medicines)
            if medicines else 0.0
        )
        overall_confidence = (ocr_conf * 0.4) + (med_conf * 0.6) if medicines else ocr_conf * 0.5

        # ── Step 4: Warnings ─────────────────────────────────────────
        warnings = []
        if ocr_conf < 0.5:
            warnings.append("Low OCR confidence. Consider uploading a clearer image.")
        if not medicines:
            warnings.append("No medicines detected. Please verify the prescription manually.")
        if any(m.confidence < 0.65 for m in medicines):
            warnings.append("Some medicines have low confidence scores — please review.")

        return ExtractionResult(
            success=True,
            ocr=OCRResult(**ocr_result),
            patient_info=patient_info,
            doctor_info=doctor_info,
            medicines=medicines,
            diagnosis=diagnosis,
            overall_confidence=round(overall_confidence, 4),
            warnings=warnings,
            metadata={
                "filename": file.filename,
                "file_size_kb": round(len(image_bytes) / 1024, 1),
                "is_pdf": is_pdf,
            }
        )

    except RuntimeError as e:
        raise HTTPException(status_code=503, detail=str(e))
    except Exception as e:
        logger.error(f"Extraction failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=f"Extraction failed: {str(e)}")


@router.post("/extract-url")
async def extract_from_url(image_url: str):
    """Extract prescription from a URL (e.g., Cloudinary URL)."""
    import httpx
    try:
        async with httpx.AsyncClient() as client:
            response = await client.get(image_url, timeout=30)
            response.raise_for_status()
            image_bytes = response.content

        content_type = response.headers.get("content-type", "image/jpeg")
        is_pdf = "pdf" in content_type

        ocr_result = ocr_engine.extract_text(image_bytes, is_pdf=is_pdf)
        raw_text = ocr_result['raw_text']

        medicines_raw = nlp_engine.extract_medicines(raw_text)
        medicines = [MedicineEntry(**m) for m in medicines_raw]

        return {
            "success": True,
            "raw_text": raw_text,
            "medicines": [m.dict() for m in medicines],
            "confidence": ocr_result['confidence_score'],
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
