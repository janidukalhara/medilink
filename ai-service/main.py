"""
MediLink AI Service v4.1
=========================
Fixes from v4.0:
  - SDK: google-generativeai (deprecated) → google-genai (new official GA SDK)
  - Model: gemini-2.5-flash-preview-05-20 → gemini-2.5-flash (stable)
  - Medicine DB: expanded to 200+ worldwide + 100+ Sri Lanka medicines

Run:
  uvicorn main:app --reload --host 0.0.0.0 --port 8000

First time:
  pip install -r requirements.txt
  (No spaCy, no torch, no BERT needed)
"""
import logging
import os
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from dotenv import load_dotenv

load_dotenv()
logging.basicConfig(
    level=logging.INFO,
    format="%(levelname)-8s %(name)s — %(message)s",
)

from routers import ocr, nlp, process

app = FastAPI(
    title="MediLink AI Service",
    description="""
### Prescription Intelligence — v4.1

**Pipeline:**
```
Image → Gemini 2.5 Flash Vision → Structured JSON (medicines, patient, doctor, date)
```

**Fallback** (no API key): Tesseract OCR + fuzzy medicine matching

**Medicine database:** 200+ worldwide + 100+ Sri Lanka specific medicines

**Get free Gemini API key:** https://aistudio.google.com/apikey
(1,500 free requests/day)
    """,
    version="4.1.0",
    docs_url="/docs",
)

_origins = os.getenv("ALLOWED_ORIGINS", "http://localhost:3000,http://localhost:5000").split(",")
app.add_middleware(
    CORSMiddleware,
    allow_origins=_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(ocr.router,     prefix="/api/ocr",     tags=["OCR"])
app.include_router(nlp.router,     prefix="/api/nlp",     tags=["NLP"])
app.include_router(process.router, prefix="/api/process", tags=["Pipeline"])


@app.on_event("startup")
async def startup():
    logger = logging.getLogger("startup")
    from services.vlm_service import init_gemini
    ok = init_gemini()
    if ok:
        logger.info("✅ Engine: Gemini 2.5 Flash Vision (VLM) — SDK: google-genai")
    else:
        logger.warning("⚠️  Engine: OCR fallback")
        logger.warning("   Set GEMINI_API_KEY in ai-service/.env")
        logger.warning("   Get free key: https://aistudio.google.com/apikey")


@app.get("/health", tags=["Health"])
async def health():
    from services.vlm_service import is_ready
    return {
        "status":    "ok",
        "version":   "4.1.0",
        "sdk":       "google-genai (new official)",
        "model":     "gemini-2.5-flash",
        "engine":    "gemini-2.5-flash-vision" if is_ready() else "ocr-fallback",
        "vlm_ready": is_ready(),
    }


@app.get("/", tags=["Health"])
async def root():
    from services.vlm_service import is_ready
    return {
        "service": "MediLink AI v4.1",
        "engine":  "Gemini 2.5 Flash" if is_ready() else "OCR Fallback",
        "docs":    "/docs",
    }
