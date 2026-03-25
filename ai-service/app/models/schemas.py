from pydantic import BaseModel, Field
from typing import List, Optional, Dict, Any
from enum import Enum


class MedicineEntry(BaseModel):
    name: str
    generic_name: Optional[str] = None
    dosage: Optional[str] = None
    frequency: Optional[str] = None
    duration: Optional[str] = None
    quantity: Optional[int] = None
    route: Optional[str] = None  # oral, topical, injection
    instructions: Optional[str] = None
    confidence: float = Field(default=0.0, ge=0.0, le=1.0)


class PatientInfo(BaseModel):
    name: Optional[str] = None
    age: Optional[str] = None
    gender: Optional[str] = None
    date: Optional[str] = None


class DoctorInfo(BaseModel):
    name: Optional[str] = None
    registration_number: Optional[str] = None
    hospital: Optional[str] = None
    contact: Optional[str] = None


class OCRResult(BaseModel):
    raw_text: str
    confidence_score: float = Field(ge=0.0, le=1.0)
    language: str = "en"
    word_count: int = 0
    processing_time_ms: float = 0.0


class ExtractionResult(BaseModel):
    success: bool
    ocr: OCRResult
    patient_info: PatientInfo = PatientInfo()
    doctor_info: DoctorInfo = DoctorInfo()
    medicines: List[MedicineEntry] = []
    diagnosis: Optional[str] = None
    overall_confidence: float = 0.0
    warnings: List[str] = []
    metadata: Dict[str, Any] = {}


class NLPAnalysisRequest(BaseModel):
    text: str
    extract_medicines: bool = True
    extract_entities: bool = True
    check_interactions: bool = False


class NLPAnalysisResult(BaseModel):
    medicines: List[MedicineEntry] = []
    entities: Dict[str, List[str]] = {}
    drug_interactions: List[Dict[str, Any]] = []
    confidence: float = 0.0
    processing_time_ms: float = 0.0
