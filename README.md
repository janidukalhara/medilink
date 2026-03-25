# 🏥 MediLink — AI-Powered Smart Prescription Management SaaS

> Digitizing handwritten prescriptions, automating pharmacy quotations, and bridging the gap between patients and pharmacies in Sri Lanka using AI-driven OCR + NLP.

---

## 📁 Project Structure

```
medilink/
├── frontend/          # React.js + TypeScript + Tailwind CSS
├── backend/           # Node.js + Express.js (MERN)
├── ai-service/        # Python FastAPI + OCR + NLP
└── README.md
```

---

## ⚙️ Prerequisites

| Tool        | Version    |
|-------------|------------|
| Node.js     | v22.19.0   |
| Python      | 3.13.x     |
| npm         | 10+        |
| MongoDB Atlas | Cloud    |
| Git         | Latest     |

---

## 🗄️ MongoDB Atlas Setup

1. Go to https://cloud.mongodb.com and sign in.
2. Create a new **Project** → Create a **Free Cluster** (M0 Sandbox).
3. Under **Database Access** → Add a new user with **Read/Write** role.
4. Under **Network Access** → Add IP `0.0.0.0/0` (allow all) or your specific IP.
5. Click **Connect** → **Connect your application** → Copy the connection string:
   ```
   mongodb+srv://<username>:<password>@cluster0.xxxxx.mongodb.net/medilink?retryWrites=true&w=majority
   ```
6. Paste this URI into `backend/.env` as `MONGO_URI`.

---

## 🔧 Backend Setup (Node.js + Express)

```bash
cd backend
npm install
```

Create `.env` file:
```env
PORT=5000
MONGO_URI=mongodb+srv://<user>:<password>@cluster0.xxxxx.mongodb.net/medilink?retryWrites=true&w=majority
JWT_SECRET=your_super_secret_jwt_key_here
JWT_EXPIRES_IN=7d
AI_SERVICE_URL=http://localhost:8000
CLIENT_URL=http://localhost:3000
EMAIL_USER=your_gmail@gmail.com
EMAIL_PASS=your_gmail_app_password
CLOUDINARY_CLOUD_NAME=your_cloudinary_name
CLOUDINARY_API_KEY=your_cloudinary_api_key
CLOUDINARY_API_SECRET=your_cloudinary_api_secret
```

Run:
```bash
npm run dev
```

---

## 🤖 AI Service Setup (Python FastAPI)

```bash
cd ai-service
python -m venv venv
source venv/bin/activate        # macOS/Linux
venv\Scripts\activate           # Windows

pip install -r requirements.txt
python -m spacy download en_core_web_sm
```

Install Tesseract (Ubuntu):
```bash
sudo apt-get install tesseract-ocr tesseract-ocr-eng
```

Run:
```bash
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

---

## 🎨 Frontend Setup

```bash
cd frontend
npm install
```

Create `.env` file:
```env
VITE_API_URL=http://localhost:5000/api
VITE_SOCKET_URL=http://localhost:5000
```

Run:
```bash
npm run dev
```

---

## 👤 User Roles

| Role     | Access                                      |
|----------|---------------------------------------------|
| Patient  | Upload prescriptions, view quotes, chat     |
| Pharmacy | View requests, submit quotes, update orders |
| Admin    | Approve pharmacies, manage users, analytics |

Seed Admin (first time only):
```bash
cd backend && node utils/seedAdmin.js
```
Default: `admin@medilink.lk` / `Admin@123`

---

## 🌐 Sri Lanka Specific

- Grama Niladhari Division field for patients and pharmacies
- Province/District/GN Division hierarchy

## 📡 Services

| Service    | URL                         |
|------------|-----------------------------|
| Backend    | http://localhost:5000/api   |
| AI Service | http://localhost:8000       |
| Frontend   | http://localhost:3000       |

## 📝 License

MIT License — MediLink 2024
