from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
from services.nlp_service import (
    extract_medicines, extract_doctor_info,
    extract_patient_info, extract_prescription_date,
)

router = APIRouter()


class TextRequest(BaseModel):
    text: str
    prescription_id: Optional[str] = None


@router.post("/parse-medicines")
async def parse_medicines(request: TextRequest):
    try:
        medicines = extract_medicines(request.text)
        return {"success": True, "medicines": medicines, "count": len(medicines)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/parse-full")
async def parse_full(request: TextRequest):
    try:
        medicines = extract_medicines(request.text)
        doctor = extract_doctor_info(request.text)
        patient = extract_patient_info(request.text)
        date = extract_prescription_date(request.text)
        conf = sum(m.get("confidence", 0) for m in medicines) / len(medicines) if medicines else 0
        return {
            "success": True,
            "medicines": medicines,
            "doctor_info": doctor,
            "patient_info": patient,
            "prescription_date": date,
            "overall_confidence": round(conf, 1),
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
