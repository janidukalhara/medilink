# MediLink v4 — Setup Guide

## New Architecture (v4) — VLM-First Pipeline

User uploads prescription image
          ↓
  ┌─────────────────────────────────────────┐
  │     Gemini 2.5 Flash Vision (VLM)       │  ← PRIMARY engine
  │  • Reads handwriting directly           │
  │  • Understands BD, TDS, OD, PRN etc.    │
  │  • Extracts all fields in one API call  │
  │  • Returns structured JSON directly     │
  └─────────────────────────────────────────┘
          ↓ (fallback if no API key)
  ┌─────────────────────────────────────────┐
  │   Tesseract OCR + Rule-based NLP        │  ← FALLBACK
  │  • 3 preprocessing variants             │
  │  • Regex patterns + fuzzy matching      │
  └─────────────────────────────────────────┘
          ↓
  Medicine DB enrichment → Structured JSON


Why VLM is better: OCR reads characters; VLM understands meaning.
It handles blurry, angled, handwritten prescriptions that OCR fails on.

---

## Quick Start (5 Steps)

### Step 1: Get Free Gemini API Key
1. Go to: https://aistudio.google.com/apikey
2. Sign in with Google account
3. Click "Create API key"
4. Copy the key (starts with AIza...)

Free tier limits (more than enough for development):
- 1,500 requests per day
- 1 million tokens per minute

### Step 2: MongoDB Atlas
1. https://cloud.mongodb.com → Sign Up → Create Free Cluster (M0)
2. Database Access → Add User → Atlas Admin role
3. Network Access → Allow from Anywhere (0.0.0.0/0)
4. Connect → Drivers → Copy connection string

### Step 3: Start AI Service
cd ai-service
python -m venv venv
venv\Scripts\activate        # Windows
# source venv/bin/activate   # Linux/macOS

pip install -r requirements.txt


Create ai-service/.env:
GEMINI_API_KEY=AIzaSy...your_key_here
ALLOWED_ORIGINS=http://localhost:3000,http://localhost:5000


uvicorn main:app --reload --host 0.0.0.0 --port 8000


You should see:
✅ Engine: Gemini 2.5 Flash Vision (VLM)


If you see ⚠️ Engine: OCR fallback — your API key is missing or wrong.

Verify: http://localhost:8000/health

### Step 4: Start Backend
cd backend
npm install


Create backend/.env:
PORT=5000
MONGO_URI=mongodb+srv://USER:PASS@cluster0.XXXXX.mongodb.net/medilink?retryWrites=true&w=majority
JWT_SECRET=change_this_to_any_32_plus_char_random_string
JWT_EXPIRES_IN=7d
AI_SERVICE_URL=http://localhost:8000
AI_TIMEOUT_MS=60000
CLIENT_URL=http://localhost:3000
EMAIL_USER=youremail@gmail.com
EMAIL_PASS=your_app_password
CLOUDINARY_CLOUD_NAME=your_name
CLOUDINARY_API_KEY=your_key
CLOUDINARY_API_SECRET=your_secret


Note: AI_TIMEOUT_MS is now only 60 seconds because VLM responds in 3-8 seconds
(much faster than the old BERT approach which needed 5 minutes).

node utils/seedAdmin.js
npm run dev


### Step 5: Start Frontend
cd frontend
npm install


Create frontend/.env:
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000


npm run dev


Open: http://localhost:3000  
Login: admin@medilink.lk / Admin@123

---

## Expected Performance (VLM mode)

| Metric | VLM (Gemini) | OCR Fallback |
|--------|-------------|--------------|
| Processing time | 3–8 seconds | 15–30 seconds |
| Handwriting accuracy | 90–95% | 40–60% |
| Medicine extraction rate | 95%+ | 60–70% |
| Field coverage | All fields | Medicines only |
| Cost | Free (1500/day) | Free |

---

## Tesseract install (for OCR fallback only)

If you don't set a Gemini API key, install Tesseract for the fallback:

Windows: Download from https://github.com/UB-Mannheim/tesseract/wiki
Add C:\Program Files\Tesseract-OCR\ to PATH

Ubuntu: sudo apt-get install tesseract-ocr tesseract-ocr-eng

macOS: brew install tesseract

---

## Login Credentials

| Role     | Email             | Password  |
|----------|-------------------|-----------|
| Admin    | admin@medilink.lk | Admin@123 |

---

## API Reference

| Service    | URL                         |
|------------|-----------------------------|
| Backend    | http://localhost:5000/api   |
| AI Service | http://localhost:8000       |
| API Docs   | http://localhost:8000/docs  |
| Frontend   | http://localhost:3000       |

Key AI endpoints:
POST /api/process/full    — {image_url: "..."} → structured prescription JSON
POST /api/process/upload  — multipart file → structured prescription JSON
GET  /health              — shows which engine is active (VLM or OCR fallback)
GET  /docs                — interactive API documentation