# Backend Setup Guide

> Step-by-step guide for all team members to set up and run the backend locally.

---

## Prerequisites

- **Node.js** v18+ → [Download](https://nodejs.org/)
- **PostgreSQL** v14+ → See installation below
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

```bash
cd backend
npm install
```

---

## Step 5: Run Prisma Migrations

This creates all tables in your database based on `prisma/schema.prisma`:

```bash
npx prisma migrate dev
```

You should see output like:
```
✅ Your database is now in sync with your schema.
✅ Generated Prisma Client
```

---

## Step 6: Start the Backend

```bash
npm run dev
```

You should see:
```
✅ Database connected
🚀 Server running on http://localhost:3001
```

### Verify it works:
```bash
curl http://localhost:3001/health
```
Expected: `{"status":"ok","message":"Server is running"}`

---

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start dev server with hot reload (nodemon + ts-node) |
| `npm run build` | Compile TypeScript to `dist/` |
| `npm start` | Run compiled production build |
| `npx prisma migrate dev` | Apply pending migrations |
| `npx prisma studio` | Open Prisma Studio (visual DB editor) |
| `npx prisma generate` | Regenerate Prisma Client after schema changes |

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
