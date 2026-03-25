from fastapi import APIRouter
from pydantic import BaseModel
import pytesseract
import spacy

router = APIRouter()


class HealthResponse(BaseModel):
    status: str
    tesseract_available: bool
    spacy_model: str
    version: str


@router.get("/health", response_model=HealthResponse)
async def health_check():
    tesseract_ok = False
    try:
        pytesseract.get_tesseract_version()
        tesseract_ok = True
    except Exception:
        pass

    spacy_model = "none"
    try:
        nlp = spacy.load("en_core_web_md")
        spacy_model = "en_core_web_md"
    except OSError:
        try:
            nlp = spacy.load("en_core_web_sm")
            spacy_model = "en_core_web_sm"
        except OSError:
            pass

    return {
        "status": "healthy",
        "tesseract_available": tesseract_ok,
        "spacy_model": spacy_model,
        "version": "1.0.0",
    }
