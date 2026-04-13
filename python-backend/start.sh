#!/usr/bin/env bash
# ============================================================
# start.sh — Start the Python ML backend
# Run from the repo root: bash python-backend/start.sh
# ============================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV="$SCRIPT_DIR/venv"

if [ ! -f "$VENV/bin/activate" ]; then
  echo "ERROR: venv not found. Run 'bash python-backend/setup.sh' first."
  exit 1
fi

source "$VENV/bin/activate"

# Workers: 1 per available CPU core is fine here since the bottleneck is
# GPU/CPU inference, not I/O. State is in Redis so multiple workers are safe.
WORKERS=${ML_WORKERS:-1}

# Free port 8000 if something is already holding it
if lsof -ti :8000 &>/dev/null; then
  echo "==> Port 8000 in use — killing existing process…"
  lsof -ti :8000 | xargs kill -9 2>/dev/null || true
  sleep 1
fi

echo "==> Starting ML backend on :8000 with $WORKERS worker(s)…"
cd "$SCRIPT_DIR"
exec uvicorn main:app \
  --host 0.0.0.0 \
  --port 8000 \
  --workers "$WORKERS" \
  --log-level info
