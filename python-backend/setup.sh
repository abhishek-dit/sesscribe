#!/usr/bin/env bash
# ============================================================
# setup.sh — One-time setup for the Python ML backend
# Run from the repo root: bash python-backend/setup.sh
# ============================================================
set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
VENV="$SCRIPT_DIR/venv"

echo "==> Checking system dependencies…"
if ! command -v ffmpeg &>/dev/null; then
  echo "  ffmpeg not found — installing via Homebrew…"
  brew install ffmpeg
fi
echo "  ffmpeg: $(ffmpeg -version 2>&1 | head -1)"

echo "==> Creating/refreshing Python virtual environment…"
python3 -m venv "$VENV"
source "$VENV/bin/activate"

echo "==> Upgrading pip…"
pip install --upgrade pip

echo "==> Installing Python requirements…"
pip install -r "$SCRIPT_DIR/requirements.txt"

echo ""
echo "✅ Setup complete."
echo ""
echo "Next steps:"
echo "  1. Fill in your .env (HUGGINGFACE_TOKEN, GEMINI_API_KEY, etc.)"
echo "  2. Start PostgreSQL and Redis (see README)"
echo "  3. Run the backend:  bash python-backend/start.sh"
