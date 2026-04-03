# Backend Setup Guide

> Step-by-step guide for all team members to set up and run the backend locally.

---

## Architecture Overview

The backend consists of **two services** that must run together:

| Service | Language | Port | Purpose |
|---|---|---|---|
| **Node.js / Express API** | TypeScript | `3001` | REST API, auth, DB, WebSocket proxy |
| **Python FastAPI ML Service** | Python | `8000` | AI/ML endpoints — transcription, analysis, question generation, roadmap |

The Express server proxies WebSocket connections from the frontend (`ws://localhost:3001/ws/transcribe/:responseId`) to the Python ML service (`ws://localhost:8000/ws/transcribe/:responseId`) for real-time audio transcription.

```
┌──────────┐     HTTP/WS      ┌──────────────┐    HTTP/WS     ┌───────────────┐
│ Frontend │ ──────────────► │  Express API  │ ────────────► │  FastAPI ML   │
│ :5173    │                  │  :3001        │                │  :8000        │
└──────────┘                  └──────────────┘                └───────────────┘
                                     │
                                     ▼
                              ┌──────────────┐
                              │ PostgreSQL   │
                              │ :5432        │
                              └──────────────┘
```

---

## Prerequisites

- **Node.js** v18+ → [Download](https://nodejs.org/)
- **Python** 3.10+ → [Download](https://www.python.org/)
- **PostgreSQL** v14+ → See installation below
- **ffmpeg** → Required by the ML service for audio processing
- **Firebase project** → For authentication (credentials shared via team)

---

## Step 1: Install PostgreSQL

### Windows
1. Download from https://www.postgresql.org/download/windows/
2. Run the installer (use **Stack Builder** is optional — skip it)
3. During installation:
   - Set a **superuser password** for the `postgres` user (remember this!)
   - Keep the default port: **5432**
   - Leave locale as default
4. After installation, **add PostgreSQL to PATH**:
   - Open **System Environment Variables** → Edit `Path`
   - Add: `C:\Program Files\PostgreSQL\<version>\bin` (e.g., `C:\Program Files\PostgreSQL\16\bin`)
5. Open a **new terminal** and verify:
   ```bash
   psql --version
   ```

### macOS
```bash
brew install postgresql@16
brew services start postgresql@16
```

### Linux (Ubuntu/Debian)
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
```

---

## Step 2: Create the Database

Open a terminal and run:

```bash
# Connect as postgres superuser
psql -U postgres

# Inside psql, run:
CREATE DATABASE interview_ai;

# (Optional) Create a dedicated user:
CREATE USER your_username WITH PASSWORD 'your_password';
GRANT ALL PRIVILEGES ON DATABASE interview_ai TO your_username;

# Exit psql
\q
```

> **Tip:** On Windows, if `psql` is not found, open **SQL Shell (psql)** from the Start Menu instead.

---

## Step 3: Configure Environment Variables

1. Copy the example env file:
   ```bash
   cp .env.example .env
   ```
2. Edit `.env` and update:
   ```
   DATABASE_URL=postgresql://your_username:your_password@localhost:5432/interview_ai
   ```
   - Replace `your_username` and `your_password` with your PostgreSQL credentials
   - If using the default `postgres` user: `postgresql://postgres:yourpassword@localhost:5432/interview_ai`

---

## Step 4: Install Dependencies

### Node.js (Express API)
```bash
cd backend
npm install
```

### Python (ML Service)
```bash
# From the project root
python -m venv venv

# Activate virtual environment
# macOS / Linux:
source venv/bin/activate
# Windows:
venv\Scripts\activate

pip install -r requirements.txt
```

> **Note:** The Python ML service requires `ffmpeg` to be installed on your system for audio conversion.
> - macOS: `brew install ffmpeg`
> - Ubuntu: `sudo apt install ffmpeg`
> - Windows: Download from https://ffmpeg.org/download.html and add to PATH

---

## Step 5: Run Prisma Migrations

This creates all tables in your database based on `prisma/schema.prisma`:

```bash
cd backend
npx prisma migrate dev
```

You should see output like:
```
✅ Your database is now in sync with your schema.
✅ Generated Prisma Client
```

---

## Step 6: Start the Services

### Start both services (two terminals needed):

**Terminal 1 — Express API (Node.js):**
```bash
cd backend
npm run dev
```

You should see:
```
✅ Database connected
✅ Seeded 38 questions        ← only on first run
🚀 Server running on http://localhost:3001
🔌 WebSocket proxy ready on ws://localhost:3001/ws/transcribe
```

**Terminal 2 — ML Service (Python):**
```bash
# From project root, with venv activated
python -m backend.main
```

You should see:
```
INFO:     Uvicorn running on http://0.0.0.0:8000
```

> ⚠️ **Both services must be running** for full functionality. The Express API handles REST routes and proxies WebSocket connections to the ML service.

---

## Step 7: Verify Everything Works

### Check Express API health:
```bash
curl http://localhost:3001/health
```
Expected: `{"status":"ok","message":"Server is running"}`

### Check database connectivity:
```bash
curl http://localhost:3001/health/db
```
Expected: `{"status":"ok","message":"Database connection is healthy"}`

### Check ML service health:
```bash
curl http://localhost:8000/health
```
Expected: `{"status":"ok"}`

---

## Database Seeding

The Express server **automatically seeds** the question bank on first startup via `backend/src/modules/questions/seed.ts`. It inserts ~38 pre-defined interview questions (Technical, HR, Communication) across Easy/Medium/Hard difficulties.

- Seeding runs once and is skipped if questions already exist in the DB.
- No manual seed command is needed.
- To re-seed, delete existing questions from the `Question` table and restart the server.

---

## WebSocket Proxy

The Express server acts as a WebSocket proxy between the frontend and the Python ML service:

| Connection | Path | Purpose |
|---|---|---|
| Frontend → Express | `ws://localhost:3001/ws/transcribe/:responseId` | Client connects here |
| Express → ML Service | `ws://localhost:8000/ws/transcribe/:responseId` | Proxied transparently |

The proxy is implemented in `backend/src/websocket.ts` and handles:
- Forwarding binary audio chunks from client to ML
- Forwarding JSON transcription results (partial & final) from ML to client
- Graceful cleanup on disconnect or error

---

## Python ML Service Endpoints

The FastAPI service (`backend/main.py`) exposes these internal endpoints:

| Method | Path | Purpose |
|---|---|---|
| `GET` | `/health` | ML service health check |
| `POST` | `/internal/transcribe` | Transcribe audio from URL |
| `POST` | `/internal/analyze-response` | Analyze a transcript |
| `POST` | `/internal/generate-report` | Generate session report |
| `POST` | `/internal/generate-questions` | AI-generate interview questions |
| `POST` | `/internal/generate-questions-from-resume` | Generate questions from resume text |
| `POST` | `/internal/generate-roadmap` | Generate skill roadmap |
| `POST` | `/internal/generate-node-info` | Get info for a roadmap node |
| `WS`   | `/ws/transcribe/:response_id` | Real-time audio transcription |

These endpoints are called by the Express API (via `backend/src/services/mlClient.service.ts`), not directly by the frontend.

---

## Available Scripts

### Node.js (Express API)

| Command | Description |
|---|---|
| `npm run dev` | Start dev server with hot reload (nodemon + ts-node) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled production build |
| `npx prisma migrate dev` | Apply pending migrations |
| `npx prisma studio` | Open Prisma Studio (visual DB editor) |
| `npx prisma generate` | Regenerate Prisma Client after schema changes |

### Python (ML Service)

| Command | Description |
|---|---|
| `python -m backend.main` | Start ML service on port 8000 |

---

## Troubleshooting

### Error: P1000 — Authentication failed
- Check your `DATABASE_URL` in `.env` — username/password might be wrong
- Try connecting with `psql -U postgres -d interview_ai` to verify credentials

### Error: P1001 — Can't reach database server
- Make sure PostgreSQL is running: `pg_isready`
- On Windows: Check **Services** app → look for "postgresql" → Start it

### Error: P1003 — Database does not exist
- Create it: `psql -U postgres -c "CREATE DATABASE interview_ai;"`

### Error: Cannot find module '@prisma/client'
- Run `npx prisma generate` to regenerate the client

### ML Service: ModuleNotFoundError
- Make sure you activated the virtual environment
- Run `pip install -r requirements.txt` from the project root

### WebSocket: "ML service unavailable"
- Make sure the Python ML service is running on port 8000
- Check: `curl http://localhost:8000/health`

### ffmpeg not found
- Install ffmpeg (required for audio processing in the ML service)
- macOS: `brew install ffmpeg`
- Verify: `ffmpeg -version`
