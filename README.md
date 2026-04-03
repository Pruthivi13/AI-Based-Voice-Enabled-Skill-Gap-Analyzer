# AI Voice Skill Gap Analyzer

A comprehensive AI-driven platform for conducting mock technical interviews via voice. The system evaluates skill gaps by analyzing semantics, structural logic, and acoustic confidence in real-time.

## Architecture

The project is a full-stack application with three main components:

```
┌──────────────────┐       HTTP/WS       ┌───────────────────┐      HTTP/WS      ┌────────────────────┐
│   React Frontend │ ──────────────────► │  Express API       │ ──────────────► │  FastAPI ML Service │
│   (Vite :5173)   │                     │  (Node.js :3001)   │                  │  (Python :8000)     │
└──────────────────┘                     └───────────────────┘                  └────────────────────┘
                                                  │
                                                  ▼
                                         ┌────────────────┐
                                         │  PostgreSQL DB  │
                                         │  (:5432)        │
                                         └────────────────┘
```

| Component | Stack | Description |
|---|---|---|
| **Frontend** | React, Vite | User interface for interviews, dashboard, analytics |
| **Express API** | Node.js, TypeScript, Prisma | REST API, Firebase auth, DB access, WebSocket proxy |
| **ML Service** | Python, FastAPI | AI-powered transcription, analysis, question generation, roadmaps |
| **Database** | PostgreSQL | User data, sessions, questions, reports |

## Prerequisites

- **Node.js** v18+
- **Python** 3.10+
- **PostgreSQL** v14+
- **ffmpeg** (for audio processing)
- **Firebase project** (for authentication)

## Quick Start

### 1. Clone & Install

```bash
git clone <repo-url>
cd AI-Based-Voice-Enabled-Skill-Gap-Analyzer

# Python dependencies
python -m venv venv
source venv/bin/activate  # or venv\Scripts\activate on Windows
pip install -r requirements.txt

# Backend (Express API)
cd backend
npm install
cp .env.example .env     # Edit with your credentials
npx prisma migrate dev
cd ..

# Frontend
cd frontend/web
npm install
cd ../..
```

### 2. Configure Environment

Edit `backend/.env` with your credentials:
- `DATABASE_URL` — PostgreSQL connection string
- `FIREBASE_*` — Firebase Admin SDK credentials
- `SUPABASE_*` — Supabase credentials (for file storage)

### 3. Start All Services (3 terminals)

```bash
# Terminal 1 — Express API
cd backend && npm run dev

# Terminal 2 — Python ML Service
source venv/bin/activate && python -m backend.main

# Terminal 3 — React Frontend
cd frontend/web && npm run dev
```

### 4. Verify

| Check | Command | Expected |
|---|---|---|
| Express API | `curl http://localhost:3001/health` | `{"status":"ok"}` |
| Database | `curl http://localhost:3001/health/db` | `{"status":"ok"}` |
| ML Service | `curl http://localhost:8000/health` | `{"status":"ok"}` |
| Frontend | Open `http://localhost:5173` | App loads |

## Key Features

- 🎤 **Voice-based interviews** with real-time transcription (WebSocket)
- 🤖 **AI-generated interview questions** tailored to role & experience
- 📄 **Resume-based question generation**
- 📊 **Detailed performance analysis** (clarity, fluency, confidence, relevance)
- 🗺️ **Skill roadmap generation** with learning resources
- 📈 **Analytics dashboard** with score trends & competency tracking
- 🔐 **Firebase authentication** with email verification

## Detailed Setup

See [`backend/SETUP.md`](backend/SETUP.md) for comprehensive backend setup instructions including:
- PostgreSQL installation on all platforms
- Environment variable configuration
- Database seeding (automatic on first startup)
- WebSocket proxy architecture
- Python ML service endpoints
- Troubleshooting guide
