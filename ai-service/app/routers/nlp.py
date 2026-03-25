"""
NLP Router — standalone NLP analysis endpoint
"""
from fastapi import APIRouter, HTTPException
import time
import logging

from app.models.schemas import NLPAnalysisRequest, NLPAnalysisResult, MedicineEntry
from app.utils.nlp_engine import nlp_engine

router = APIRouter()
logger = logging.getLogger(__name__)


@router.post("/analyze", response_model=NLPAnalysisResult)
async def analyze_text(request: NLPAnalysisRequest):
    """
    Run NLP analysis on prescription text.
    Can be used after OCR or for plain-text prescriptions.
    """
    start_time = time.time()

    try:
        result = NLPAnalysisResult()

        if request.extract_medicines:
            medicines_raw = nlp_engine.extract_medicines(request.text)
            result.medicines = [MedicineEntry(**m) for m in medicines_raw]

        if request.extract_entities:
            entities = {}
            patient = nlp_engine.extract_patient_info(request.text)
            doctor = nlp_engine.extract_doctor_info(request.text)
            diagnosis = nlp_engine.extract_diagnosis(request.text)
            entities['patient'] = [str(v) for v in patient.values() if v]
            entities['doctor'] = [str(v) for v in doctor.values() if v]
            if diagnosis:
                entities['diagnosis'] = [diagnosis]
            result.entities = entities

        result.confidence = (
            sum(m.confidence for m in result.medicines) / len(result.medicines)
            if result.medicines else 0.0
        )
        result.processing_time_ms = (time.time() - start_time) * 1000

        return result

    except Exception as e:
        logger.error(f"NLP analysis failed: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/parse-medicines")
async def parse_medicines_only(text: str):
    """Lightweight endpoint to just parse medicine names from text."""
    try:
        medicines = nlp_engine.extract_medicines(text)
        return {
            "medicines": medicines,
            "count": len(medicines),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
