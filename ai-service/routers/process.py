"""
Full pipeline router — new VLM-first architecture

Priority:
  1. Gemini 2.5 Flash Vision (VLM)  ← primary, best accuracy
  2. OCR + Rule-based NLP           ← fallback if no API key

All heavy work runs in thread pool (never blocks FastAPI event loop).
"""
from __future__ import annotations

import asyncio
import logging
from concurrent.futures import ThreadPoolExecutor

from fastapi import APIRouter, File, UploadFile, HTTPException
from pydantic import BaseModel
from typing import Optional

from services.vlm_service import extract_with_gemini, is_ready as vlm_ready
from services.ocr_fallback import extract_with_ocr_fallback
from utils.image_utils import download_image, convert_to_rgb

logger   = logging.getLogger(__name__)
router   = APIRouter()
_executor = ThreadPoolExecutor(max_workers=4)


# ─── Core pipeline (sync, runs in thread pool) ───────────────────────────────

def _pipeline(image_bytes: bytes) -> dict:
    """
    Try VLM first, fall back to OCR if VLM unavailable.
    Returns structured prescription JSON.
    """
    if vlm_ready():
        logger.info("🤖 Using Gemini 2.5 Flash Vision (VLM)")
        result = extract_with_gemini(image_bytes)
        if result.get("success"):
            return result
        # VLM failed — fall through to OCR
        logger.warning(f"VLM failed: {result.get('error')} — trying OCR fallback")

    logger.info("📄 Using OCR + Rule-based fallback")
    return extract_with_ocr_fallback(image_bytes)


# ─── Routes ──────────────────────────────────────────────────────────────────

class FullProcessRequest(BaseModel):
    image_url: str
    prescription_id: Optional[str] = None


@router.post("/full")
async def full_process_url(request: FullProcessRequest):
    """Download image URL → VLM/OCR pipeline → structured JSON."""
    try:
        image_bytes = await download_image(request.image_url)
        rgb_bytes   = convert_to_rgb(image_bytes)

        loop   = asyncio.get_event_loop()
        result = await loop.run_in_executor(_executor, _pipeline, rgb_bytes)
        result["prescription_id"] = request.prescription_id
        return result

    except Exception as e:
        logger.error(f"Pipeline error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/upload")
async def full_process_upload(file: UploadFile = File(...)):
    """Upload file → VLM/OCR pipeline → structured JSON."""
    try:
        contents  = await file.read()
        rgb_bytes = convert_to_rgb(contents)

        loop   = asyncio.get_event_loop()
        result = await loop.run_in_executor(_executor, _pipeline, rgb_bytes)
        return result

    except Exception as e:
        logger.error(f"Upload error: {e}", exc_info=True)
        raise HTTPException(status_code=500, detail=str(e))
