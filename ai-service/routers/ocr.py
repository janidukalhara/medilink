from fastapi import APIRouter, File, UploadFile, HTTPException
from pydantic import BaseModel
from services.ocr_service import extract_text_from_bytes
from utils.image_utils import download_image, convert_to_rgb

router = APIRouter()


class ImageURLRequest(BaseModel):
    image_url: str


@router.post("/extract")
async def extract_from_upload(file: UploadFile = File(...)):
    try:
        contents = await file.read()
        rgb = convert_to_rgb(contents)
        text, conf, words = extract_text_from_bytes(rgb)
        return {"success": True, "raw_text": text, "confidence": conf,
                "word_count": len(words), "words": words[:20]}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/extract-url")
async def extract_from_url(request: ImageURLRequest):
    try:
        img = await download_image(request.image_url)
        rgb = convert_to_rgb(img)
        text, conf, words = extract_text_from_bytes(rgb)
        return {"success": True, "raw_text": text, "confidence": conf, "word_count": len(words)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
