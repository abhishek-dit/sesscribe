# Live Transcript App

Real-time meeting transcription with speaker diarization, AI-powered summaries, and automatic notifications via Email and WhatsApp.

## Architecture

```
Browser (mic) ──WebSocket──► Python ML Backend :8000 (Whisper + Pyannote + Redis)
Next.js :3000 ──────────────► PostgreSQL (sessions, attendees)
Next.js API ────────────────► Gemini (summaries) + Resend (email) + AiSensy (WhatsApp)
```

Parallel-safe: audio buffers in Redis, sessions in PostgreSQL — multiple devices/workers can run simultaneously.

## Prerequisites

- Node.js 18+
- Python 3.11+ (tested on 3.14)
- PostgreSQL 16+ running locally
- Redis running locally
- `ffmpeg` installed

## 1. Install System Dependencies

```bash
# On macOS
brew install ffmpeg redis
brew services start redis
```

**PostgreSQL** — you already have PostgreSQL 18 running (Postgres.app / EnterpriseDB).

## 2. Database Setup

Open a terminal and connect to PostgreSQL:

```bash
# If using Postgres.app or EnterpriseDB (with password):
/Library/PostgreSQL/18/bin/psql -U postgres

# If using Homebrew's PostgreSQL:
psql -U $(whoami) -d postgres
```

Then run:

```sql
CREATE DATABASE live_transcript;
\q
```

## 3. Configure Environment

Copy and fill in `.env`:

```bash
cp .env .env.local   # or just edit .env directly
```

Key variables to fill in:

| Variable | Where to get it |
|---|---|
| `DATABASE_URL` | Your PostgreSQL connection string |
| `REDIS_URL` | Default: `redis://localhost:6379` |
| `GEMINI_API_KEY` | [Google AI Studio](https://makersuite.google.com/app/apikey) |
| `HUGGINGFACE_TOKEN` | [HuggingFace Settings](https://huggingface.co/settings/tokens) — must accept [pyannote/speaker-diarization-3.1](https://huggingface.co/pyannote/speaker-diarization-3.1) terms |
| `RESEND_API_KEY` | [Resend](https://resend.com) |
| `RESEND_FROM_EMAIL` | Your verified sender email |
| `AISENSY_API_KEY` | [AiSensy](https://aisensy.com) |
| `AISENSY_CAMPAIGN` | Your campaign name (template params: meeting title, URL) |
| `NEXT_PUBLIC_APP_URL` | `http://localhost:3000` (or your public URL) |

**DATABASE_URL formats:**
```
# EnterpriseDB / Postgres.app (password required):
postgresql://postgres:YOUR_PASSWORD@localhost:5432/live_transcript

# Homebrew (no password):
postgresql://apple@localhost:5432/live_transcript
```

## 4. Set Up Next.js (Frontend + API)

```bash
npm install
npx prisma generate
npx prisma db push        # Creates tables in PostgreSQL
npm run dev               # Starts on http://localhost:3000
```

## 5. Set Up Python ML Backend

```bash
bash python-backend/setup.sh   # One-time: creates venv, installs packages
bash python-backend/start.sh   # Starts ML server on :8000
```

**First run** downloads the Whisper model (~140MB for `base`). With `HUGGINGFACE_TOKEN` set, it also downloads the Pyannote diarization model (~1GB).

## 6. Running Everything Together

Open 3 terminals:

```bash
# Terminal 1 — Next.js
npm run dev

# Terminal 2 — Python ML backend  
bash python-backend/start.sh

# Terminal 3 — Redis (if not running as a service)
redis-server
```

## Running in Parallel on Multiple Devices

Since state lives in Redis (audio) and PostgreSQL (sessions):

- Run **multiple Python workers**: `ML_WORKERS=4 bash python-backend/start.sh`
- Run **Next.js on multiple machines** pointed at the same PostgreSQL + Redis
- Each device's browser connects to any available backend — sessions are fully isolated by `session_id`

## Flow

1. **`/session/setup`** — Enter title and attendees (name, email, WhatsApp)
2. **`/session/live`** — Browser streams mic audio via WebSocket to Python backend; live interim transcription appears in real time
3. On **End Meeting**:
   - Python runs full Whisper on all audio
   - If `HUGGINGFACE_TOKEN` set: Pyannote diarizes speakers
   - Gemini generates 2-paragraph summary + 4-5 action points
   - Transcript + summary saved to PostgreSQL
   - Email sent via Resend + WhatsApp via AiSensy (fire-and-forget)
4. **`/session/:id`** — View full diarized transcript, AI summary, action points

## Whisper Model Sizes

Set `WHISPER_MODEL_SIZE` in `.env`:

| Model | VRAM | Speed | Accuracy |
|---|---|---|---|
| `tiny` | ~1GB | Very fast | Low |
| `base` | ~1GB | Fast | OK |  
| `small` | ~2GB | Medium | Good ← recommended |
| `medium` | ~5GB | Slow | Great |
| `large-v3` | ~10GB | Very slow | Best |

## Notification Setup

### Email (Resend)
1. Sign up at [resend.com](https://resend.com)
2. Add and verify your sending domain
3. Set `RESEND_API_KEY` and `RESEND_FROM_EMAIL`

### WhatsApp (AiSensy)
1. Sign up at [aisensy.com](https://aisensy.com)
2. Create a WhatsApp template campaign called `meeting_update` with:
   - Param `{{1}}` = meeting title
   - Param `{{2}}` = transcript URL
3. Set `AISENSY_API_KEY` and `AISENSY_CAMPAIGN`
