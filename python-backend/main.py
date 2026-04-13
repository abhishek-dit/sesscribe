"""
Live Transcript App — Python ML Backend
Live streaming via Deepgram Nova-2 (real-time diarized transcription).
Falls back to faster-whisper if DEEPGRAM_API_KEY is not set.
"""

import asyncio
import json
import logging
import os
import subprocess
import tempfile
from contextlib import asynccontextmanager

import redis.asyncio as aioredis
import ssl
import certifi
import websockets
from dotenv import load_dotenv
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "..", ".env"))

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
log = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------
WHISPER_MODEL_SIZE = os.getenv("WHISPER_MODEL_SIZE", "base")
HF_TOKEN           = os.getenv("HUGGINGFACE_TOKEN", "")
REDIS_URL          = os.getenv("REDIS_URL", "redis://localhost:6379")
DEEPGRAM_API_KEY   = os.getenv("DEEPGRAM_API_KEY", "")
REDIS_AUDIO_TTL    = 3600  # 1 hour

whisper_model      = None
pyannote_pipeline  = None
redis_pool         = None

USE_DEEPGRAM = bool(DEEPGRAM_API_KEY)

# ---------------------------------------------------------------------------
# Startup / shutdown
# ---------------------------------------------------------------------------
@asynccontextmanager
async def lifespan(app: FastAPI):
    global whisper_model, pyannote_pipeline, redis_pool

    if USE_DEEPGRAM:
        log.info("DEEPGRAM_API_KEY found — Deepgram mode enabled. Whisper skipped for live streaming.")
    else:
        # Load Whisper for local fallback
        import torch
        from faster_whisper import WhisperModel

        device       = "cuda" if torch.cuda.is_available() else "cpu"
        compute_type = "float16" if device == "cuda" else "int8"
        log.info(f"Loading Whisper '{WHISPER_MODEL_SIZE}' on {device} ({compute_type})…")
        whisper_model = WhisperModel(WHISPER_MODEL_SIZE, device=device, compute_type=compute_type)
        log.info("Whisper model ready.")

        if HF_TOKEN:
            try:
                from pyannote.audio import Pipeline
                pyannote_pipeline = Pipeline.from_pretrained(
                    "pyannote/speaker-diarization-3.1",
                    use_auth_token=HF_TOKEN,
                )
                if torch.cuda.is_available():
                    pyannote_pipeline = pyannote_pipeline.to(torch.device("cuda"))
                log.info("Pyannote pipeline ready.")
            except Exception as exc:
                log.warning(f"Pyannote unavailable: {exc}. Speaker labels will be generic.")

    redis_pool = aioredis.ConnectionPool.from_url(REDIS_URL, max_connections=20)
    log.info(f"Redis pool created for {REDIS_URL}")

    yield

    await redis_pool.disconnect()
    log.info("Redis pool closed.")


app = FastAPI(title="Live Transcript ML Backend", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ---------------------------------------------------------------------------
# Redis helper
# ---------------------------------------------------------------------------
def get_redis() -> aioredis.Redis:
    return aioredis.Redis(connection_pool=redis_pool)


# ---------------------------------------------------------------------------
# Audio helpers (used for Whisper fallback path only)
# ---------------------------------------------------------------------------
def _webm_bytes_to_wav_sync(audio_bytes: bytes) -> bytes | None:
    try:
        result = subprocess.run(
            ["ffmpeg", "-y", "-i", "pipe:0", "-ar", "16000", "-ac", "1", "-f", "wav", "pipe:1"],
            input=audio_bytes, capture_output=True, timeout=60,
        )
        if result.returncode == 0 and len(result.stdout) > 44:
            return result.stdout
        log.debug(f"ffmpeg stderr: {result.stderr.decode(errors='replace')[:200]}")
        return None
    except Exception as exc:
        log.error(f"ffmpeg error: {exc}")
        return None


async def webm_bytes_to_wav(audio_bytes: bytes) -> bytes | None:
    return await asyncio.get_event_loop().run_in_executor(None, _webm_bytes_to_wav_sync, audio_bytes)


def _whisper_transcribe_sync(wav_path: str) -> list[dict]:
    segments, _ = whisper_model.transcribe(
        wav_path, beam_size=5, language=None,
        vad_filter=True, vad_parameters={"min_silence_duration_ms": 200, "speech_pad_ms": 100},
        temperature=0, condition_on_previous_text=True,
        no_speech_threshold=0.5, compression_ratio_threshold=2.4,
    )
    return [{"start": s.start, "end": s.end, "text": s.text.strip()} for s in segments if s.text.strip()]


async def transcribe_wav_file(wav_path: str) -> list[dict]:
    return await asyncio.get_event_loop().run_in_executor(None, _whisper_transcribe_sync, wav_path)


def _extract_segment_wav_sync(wav_path: str, start: float, duration: float) -> bytes:
    result = subprocess.run(
        ["ffmpeg", "-y", "-i", wav_path, "-ss", str(start), "-t", str(duration),
         "-ar", "16000", "-ac", "1", "-f", "wav", "pipe:1"],
        capture_output=True, timeout=30,
    )
    return result.stdout if result.returncode == 0 else b""


# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@app.get("/")
def health():
    return {
        "status": "ML Server Running",
        "mode": "deepgram" if USE_DEEPGRAM else "whisper",
        "diarization_enabled": USE_DEEPGRAM or pyannote_pipeline is not None,
    }


# ---------------------------------------------------------------------------
# WebSocket: Deepgram streaming proxy
# ---------------------------------------------------------------------------
# Deepgram Nova-2 base URL — sample_rate is added dynamically per connection
# because the browser's AudioContext rate depends on the OS audio device
# (44100 Hz on macOS, 48000 Hz on most other systems).
DEEPGRAM_BASE_URL = (
    "wss://api.deepgram.com/v1/listen"
    "?model=nova-2"
    "&diarize=true"
    "&interim_results=true"
    "&smart_format=true"
    "&punctuate=true"
    "&encoding=linear16"
    "&channels=1"
    "&endpointing=100"
)


@app.websocket("/transcribe/stream/{session_id}")
async def transcribe_stream(websocket: WebSocket, session_id: str):
    # Browser passes its AudioContext.sampleRate so Deepgram gets the right rate.
    sample_rate = int(websocket.query_params.get("sample_rate", "44100"))
    await websocket.accept()

    if USE_DEEPGRAM:
        await _deepgram_stream(websocket, session_id, sample_rate)
    else:
        await _whisper_stream(websocket, session_id)


# ── Deepgram path ────────────────────────────────────────────────────────────
async def _deepgram_stream(websocket: WebSocket, session_id: str, sample_rate: int = 44100):
    """
    Proxy PCM audio from the browser → Deepgram → back to browser.
    sample_rate comes from the browser's AudioContext.sampleRate (44100 or 48000).
    """
    r = get_redis()
    transcript_key = f"transcript:{session_id}"

    # Build URL with the correct sample rate for this connection.
    dg_url = DEEPGRAM_BASE_URL + f"&sample_rate={sample_rate}"
    log.info(f"[{session_id}] Deepgram stream starting at {sample_rate} Hz.")

    # macOS Python does not use the system keychain — supply certifi's bundle.
    _ssl_ctx = ssl.create_default_context(cafile=certifi.where())

    try:
        async with websockets.connect(
            dg_url,
            additional_headers={"Authorization": f"Token {DEEPGRAM_API_KEY}"},
            ssl=_ssl_ctx,
            ping_interval=15,
            ping_timeout=20,
        ) as dg_ws:
            log.info(f"[{session_id}] Connected to Deepgram ({sample_rate} Hz).")

            # ── Browser → Deepgram ──────────────────────────────────────────
            async def browser_to_dg():
                try:
                    while True:
                        data = await websocket.receive_bytes()
                        await dg_ws.send(data)
                except WebSocketDisconnect:
                    log.info(f"[{session_id}] Browser disconnected.")
                except Exception as e:
                    log.warning(f"[{session_id}] b→dg error: {e}")
                finally:
                    # Tell Deepgram the stream is over
                    try:
                        await dg_ws.send(json.dumps({"type": "CloseStream"}))
                    except Exception:
                        pass

            # ── Deepgram → Browser ──────────────────────────────────────────
            async def dg_to_browser():
                try:
                    async for raw_msg in dg_ws:
                        result = json.loads(raw_msg)

                        msg_type = result.get("type")
                        if msg_type == "Metadata":
                            log.info(f"[{session_id}] DG metadata: {result}")
                            continue
                        if msg_type != "Results":
                            continue

                        channel   = result.get("channel", {})
                        alts      = channel.get("alternatives", [{}])
                        alt       = alts[0] if alts else {}
                        text      = alt.get("transcript", "").strip()

                        if not text:
                            continue

                        words        = alt.get("words", [])
                        is_final     = result.get("is_final", False)
                        speech_final = result.get("speech_final", False)
                        start        = round(result.get("start", 0.0), 2)
                        duration     = result.get("duration", 0.0)
                        end          = round(start + duration, 2)

                        # Determine dominant speaker across words
                        speaker_num = 0
                        if words:
                            counts: dict[int, int] = {}
                            for w in words:
                                sp = w.get("speaker", 0)
                                counts[sp] = counts.get(sp, 0) + 1
                            speaker_num = max(counts, key=counts.get)

                        payload = {
                            "text":         text,
                            "speaker":      f"Speaker {speaker_num + 1}",
                            "start":        start,
                            "end":          end,
                            "is_final":     is_final,
                            "speech_final": speech_final,
                        }

                        # Persist every is_final result to Redis.
                        # speech_final may never fire during continuous speech,
                        # so we can't rely on it for completeness.
                        if is_final:
                            await r.rpush(transcript_key, json.dumps(payload))
                            await r.expire(transcript_key, REDIS_AUDIO_TTL)

                        # Forward to browser
                        await websocket.send_text(json.dumps(payload))

                except Exception as e:
                    log.warning(f"[{session_id}] dg→browser error: {e}")

            await asyncio.gather(browser_to_dg(), dg_to_browser())

    except WebSocketDisconnect:
        log.info(f"[{session_id}] Client disconnected before Deepgram connected.")
    except Exception as e:
        log.error(f"[{session_id}] Deepgram connection failed: {e}")
        try:
            await websocket.send_text(json.dumps({"error": f"Deepgram unavailable: {e}"}))
        except Exception:
            pass
    finally:
        await r.aclose()


# ── Whisper local fallback path ────────────────────────────────────────────
from collections import deque

CHUNK_DURATION_S          = 0.25
CHUNKS_BEFORE_TRANSCRIPTION = 20
LIVE_WINDOW_CHUNKS        = 100


async def _whisper_stream(websocket: WebSocket, session_id: str):
    """Rolling-window Whisper transcription (used when no Deepgram key)."""
    r = get_redis()
    redis_key = f"audio:{session_id}"
    log.info(f"[{session_id}] Whisper (local) stream starting.")

    webm_header:      bytes | None = None
    rolling:          deque[bytes] = deque(maxlen=LIVE_WINDOW_CHUNKS)
    chunks_received:  int          = 0
    chunks_since_last: int         = 0
    last_reported_end: float       = 0.0

    try:
        while True:
            data = await websocket.receive_bytes()

            await r.rpush(redis_key, data)
            await r.expire(redis_key, REDIS_AUDIO_TTL)

            if webm_header is None:
                webm_header = data
                log.info(f"[{session_id}] WebM header captured ({len(data):,} B).")

            rolling.append(data)
            chunks_received  += 1
            chunks_since_last += 1

            if chunks_since_last < CHUNKS_BEFORE_TRANSCRIPTION:
                continue
            chunks_since_last = 0

            window_bytes = b"".join(rolling)
            batch = (
                webm_header + window_bytes
                if webm_header and not window_bytes.startswith(webm_header[:32])
                else window_bytes
            )

            window_start_abs = max(0.0, (chunks_received - len(rolling)) * CHUNK_DURATION_S)

            wav = await webm_bytes_to_wav(batch)
            if not wav:
                continue

            with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as tmp:
                tmp.write(wav)
                tmp_path = tmp.name

            try:
                for seg in await transcribe_wav_file(tmp_path):
                    abs_start = round(window_start_abs + seg["start"], 2)
                    abs_end   = round(window_start_abs + seg["end"],   2)
                    if abs_end <= last_reported_end + 0.3:
                        continue
                    last_reported_end = abs_end
                    await websocket.send_text(json.dumps({
                        "text":         seg["text"],
                        "speaker":      "Speaker 1",
                        "start":        abs_start,
                        "end":          abs_end,
                        "is_final":     True,
                        "speech_final": True,
                    }))
            finally:
                os.unlink(tmp_path)

    except WebSocketDisconnect:
        log.info(f"[{session_id}] WebSocket disconnected (Whisper path).")
    finally:
        await r.aclose()


# ---------------------------------------------------------------------------
# Get stored transcript (used by session/complete if browser transcript missing)
# ---------------------------------------------------------------------------
@app.get("/get_transcript/{session_id}")
async def get_transcript(session_id: str):
    r = get_redis()
    try:
        raw = await r.lrange(f"transcript:{session_id}", 0, -1)
        return {"status": "success", "transcript": [json.loads(s) for s in raw]}
    finally:
        await r.aclose()


# ---------------------------------------------------------------------------
# Analyze audio (Whisper fallback for final transcript — legacy & non-Deepgram)
# ---------------------------------------------------------------------------
@app.post("/analyze_audio/{session_id}")
async def analyze_audio(session_id: str):
    r = get_redis()
    try:
        # 1. Try stored Deepgram transcript first
        raw_dg = await r.lrange(f"transcript:{session_id}", 0, -1)
        if raw_dg:
            transcript = [json.loads(s) for s in raw_dg]
            log.info(f"[{session_id}] Returning {len(transcript)} Deepgram segments from Redis.")
            await r.delete(f"transcript:{session_id}")
            return {"status": "success", "transcript": transcript}

        # 2. Whisper fallback (requires WebM audio in Redis)
        if whisper_model is None:
            return {"error": "No transcript found and Whisper is not loaded.", "transcript": []}

        raw_chunks = await r.lrange(f"audio:{session_id}", 0, -1)
        if not raw_chunks:
            return {"error": "No audio found for session.", "transcript": []}

        audio_bytes = b"".join(raw_chunks)
        log.info(f"[{session_id}] Running Whisper on {len(audio_bytes):,} bytes of audio.")

        wav_bytes = await webm_bytes_to_wav(audio_bytes)
        if not wav_bytes:
            return {"error": "Could not decode audio", "transcript": []}

        with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as f:
            f.write(wav_bytes)
            wav_path = f.name

        transcript = []
        try:
            if pyannote_pipeline is not None:
                log.info(f"[{session_id}] Running pyannote diarization…")
                diarization = await asyncio.get_event_loop().run_in_executor(
                    None, pyannote_pipeline, wav_path
                )
                for turn, _, speaker in diarization.itertracks(yield_label=True):
                    duration = turn.end - turn.start
                    if duration < 0.3:
                        continue
                    seg_wav = await asyncio.get_event_loop().run_in_executor(
                        None, _extract_segment_wav_sync, wav_path, turn.start, duration
                    )
                    if not seg_wav:
                        continue
                    with tempfile.NamedTemporaryFile(suffix=".wav", delete=False) as sf:
                        sf.write(seg_wav)
                        seg_path = sf.name
                    try:
                        for seg in await transcribe_wav_file(seg_path):
                            transcript.append({
                                "speaker": speaker,
                                "text":    seg["text"],
                                "start":   round(turn.start + seg["start"], 2),
                                "end":     round(turn.start + seg["end"],   2),
                            })
                    finally:
                        os.unlink(seg_path)
            else:
                for seg in await transcribe_wav_file(wav_path):
                    transcript.append({"speaker": "Speaker 1", "text": seg["text"],
                                       "start": seg["start"], "end": seg["end"]})
        finally:
            os.unlink(wav_path)

        transcript.sort(key=lambda x: x.get("start", 0))
        await r.delete(f"audio:{session_id}")
        return {"status": "success", "transcript": transcript}

    finally:
        await r.aclose()


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False, workers=1)
