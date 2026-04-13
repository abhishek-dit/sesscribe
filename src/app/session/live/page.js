"use client";

import { Suspense } from "react";
import { useState, useEffect, useRef, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";

/* ─── helpers ──────────────────────────────────────────────────────────────── */
function formatTime(secs = 0) {
  const m = Math.floor(secs / 60).toString().padStart(2, "0");
  const s = Math.floor(secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

const SPEAKER_COLORS = [
  { bg: "rgba(139,92,246,0.15)", border: "rgba(139,92,246,0.4)",  text: "#a78bfa", dot: "#8b5cf6" },
  { bg: "rgba(217,70,239,0.13)", border: "rgba(217,70,239,0.4)",  text: "#e879f9", dot: "#d946ef" },
  { bg: "rgba(59,130,246,0.13)", border: "rgba(59,130,246,0.4)",  text: "#60a5fa", dot: "#3b82f6" },
  { bg: "rgba(16,185,129,0.13)", border: "rgba(16,185,129,0.4)",  text: "#34d399", dot: "#10b981" },
  { bg: "rgba(251,146,60,0.13)", border: "rgba(251,146,60,0.4)",  text: "#fb923c", dot: "#f97316" },
];
const speakerColor = (label = "") => {
  // Extract numeric suffix: "Speaker 2" → index 1
  const n = parseInt(label.replace(/\D/g, ""), 10) || 1;
  return SPEAKER_COLORS[(n - 1) % SPEAKER_COLORS.length];
};

/* ─── Waveform canvas ─────────────────────────────────────────────────────── */
function Waveform({ analyser, isActive }) {
  const canvasRef = useRef(null);
  const animRef   = useRef(null);

  useEffect(() => {
    if (!isActive || !analyser) {
      cancelAnimationFrame(animRef.current);
      const c = canvasRef.current;
      if (c) c.getContext("2d").clearRect(0, 0, c.width, c.height);
      return;
    }
    const canvas = canvasRef.current;
    const ctx    = canvas.getContext("2d");
    const data   = new Uint8Array(analyser.frequencyBinCount);

    const draw = () => {
      animRef.current = requestAnimationFrame(draw);
      analyser.getByteFrequencyData(data);
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const bw = (canvas.width / data.length) * 2.5;
      let x = 0;
      for (let i = 0; i < data.length; i++) {
        const h = (data[i] / 255) * canvas.height * 0.88;
        const g = ctx.createLinearGradient(0, canvas.height, 0, canvas.height - h);
        g.addColorStop(0, "rgba(139,92,246,0.95)");
        g.addColorStop(1, "rgba(217,70,239,0.5)");
        ctx.fillStyle = g;
        ctx.beginPath();
        ctx.roundRect(x, canvas.height - h, bw - 1, h, 2);
        ctx.fill();
        x += bw + 1;
      }
    };
    draw();
    return () => cancelAnimationFrame(animRef.current);
  }, [isActive, analyser]);

  return (
    <canvas
      ref={canvasRef}
      width={700}
      height={72}
      style={{ width: "100%", height: "72px" }}
    />
  );
}

/* ─── Single transcript row ───────────────────────────────────────────────── */
function TranscriptRow({ seg, pending }) {
  const col = speakerColor(seg.speaker || "Speaker 1");
  return (
    <div style={{
      display: "flex",
      gap: "0.85rem",
      padding: "0.85rem 0",
      borderBottom: "1px solid var(--border)",
      opacity: pending ? 0.55 : 1,
      animation: pending ? "none" : "fadeUp 0.25s ease-out both",
    }}>
      {/* Speaker avatar */}
      <div style={{
        width: 34, height: 34, borderRadius: "50%", flexShrink: 0,
        background: col.bg, border: `1px solid ${col.border}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "0.7rem", fontWeight: 700, color: col.text,
      }}>
        {(seg.speaker || "S1")[0]}
      </div>

      <div style={{ flex: 1, minWidth: 0 }}>
        {/* Header row */}
        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "0.25rem" }}>
          <span style={{ fontSize: "0.75rem", fontWeight: 700, color: col.text, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            {seg.speaker || "Speaker 1"}
          </span>
          {seg.start != null && (
            <span style={{
              fontSize: "0.68rem", color: "var(--fg-3)",
              background: "var(--surface-2)", padding: "0.1rem 0.45rem",
              borderRadius: "4px", fontVariantNumeric: "tabular-nums",
            }}>
              {formatTime(seg.start)}
            </span>
          )}
          {pending && (
            <span style={{ fontSize: "0.68rem", color: "var(--fg-3)", fontStyle: "italic" }}>
              typing…
            </span>
          )}
        </div>
        {/* Text */}
        <p style={{ fontSize: "0.92rem", color: pending ? "var(--fg-2)" : "var(--fg)", lineHeight: 1.65 }}>
          {seg.text}
        </p>
      </div>
    </div>
  );
}

/* ─── Main ────────────────────────────────────────────────────────────────── */
function LiveSessionInner() {
  const router      = useRouter();
  const searchParams = useSearchParams();
  const sessionId   = searchParams.get("id");

  // status: idle | connecting | recording | paused | processing
  const [status,      setStatus]      = useState("idle");
  const [segments,    setSegments]    = useState([]);   // final confirmed segments
  const [pending,     setPending]     = useState(null); // current interim segment
  const [elapsed,     setElapsed]     = useState(0);
  const [analyser,    setAnalyser]    = useState(null);
  // "mic" = physical microphone, "system" = tab/screen audio via getDisplayMedia
  const [audioSource, setAudioSource] = useState("mic");

  const wsRef           = useRef(null);
  const audioCtxRef     = useRef(null);
  const processorRef    = useRef(null);
  const sourceRef       = useRef(null);
  const streamRef       = useRef(null);
  const recorderRef     = useRef(null);
  const audioChunksRef  = useRef([]);
  const timerRef        = useRef(null);
  const startTimeRef    = useRef(null);
  const bottomRef       = useRef(null);
  const isPausedRef     = useRef(false); // track pause without state closure issues

  // Auto-scroll
  useEffect(() => { bottomRef.current?.scrollIntoView({ behavior: "smooth" }); }, [segments, pending]);

  // Elapsed timer
  useEffect(() => {
    if (status === "recording") {
      if (!startTimeRef.current) startTimeRef.current = Date.now() - elapsed * 1000;
      timerRef.current = setInterval(() => {
        setElapsed(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 500);
    } else {
      clearInterval(timerRef.current);
      if (status !== "paused") startTimeRef.current = null;
    }
    return () => clearInterval(timerRef.current);
  }, [status, elapsed]);

  /* ── Cleanup helper ────────────────────────────────────────────────────── */
  const cleanup = useCallback((keepSegs = false) => {
    clearInterval(timerRef.current);
    if (recorderRef.current && recorderRef.current.state !== "inactive") { recorderRef.current.stop(); }
    if (processorRef.current) { processorRef.current.onaudioprocess = null; processorRef.current.disconnect(); }
    if (sourceRef.current) sourceRef.current.disconnect();
    if (audioCtxRef.current) audioCtxRef.current.close().catch(() => {});
    if (wsRef.current) wsRef.current.close();
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    setAnalyser(null);
    setPending(null);
    if (!keepSegs) { setSegments([]); setElapsed(0); startTimeRef.current = null; audioChunksRef.current = []; }
    audioCtxRef.current = processorRef.current = sourceRef.current = streamRef.current = recorderRef.current = null;
  }, []);

  /* ── PCM capture helpers ───────────────────────────────────────────────── */
  const float32ToInt16 = (f32) => {
    const i16 = new Int16Array(f32.length);
    for (let i = 0; i < f32.length; i++) {
      i16[i] = Math.max(-32768, Math.min(32767, Math.round(f32[i] * 32767)));
    }
    return i16;
  };

  /* ── Start recording (or resume from pause) ───────────────────────────── */
  // reset=true  → clear segments/elapsed (new session)
  // reset=false → keep existing segments (resume after pause)
  const startRecording = useCallback(async (reset = true) => {
    if (!sessionId) return alert("No session ID found.");

    try {
      // ── Acquire audio stream FIRST (before any setState) ──────────────────
      // getDisplayMedia() and getUserMedia() MUST be the first async call so
      // the browser's user-gesture security token is still valid.
      // React 18 concurrent setState can invalidate that token if called first.
      let stream;
      if (audioSource === "system") {
        console.log("[Share] Requesting getDisplayMedia...");
        let display;
        try {
          display = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
          });
        } catch (shareErr) {
          console.error("[Share] getDisplayMedia failed:", shareErr);
          setStatus("idle");
          return;
        }
        console.log("[Share] Got display stream, audio tracks:", display.getAudioTracks().length, "video tracks:", display.getVideoTracks().length);
        const audioTracks = display.getAudioTracks();
        if (!audioTracks.length) {
          display.getTracks().forEach(t => t.stop());
          alert("No audio was shared.\n\nIn Chrome's share dialog: select a tab, then check the \"Share tab audio\" box before clicking Share.");
          return;
        }
        // Keep video track alive but muted — stopping it kills the entire capture
        // session on Chrome 120+. We'll clean it up when recording stops.
        display.getVideoTracks().forEach(t => { t.enabled = false; });
        stream = display;
      } else {
        stream = await navigator.mediaDevices.getUserMedia({
          audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: true, channelCount: 1 },
        });
      }

      // Stream secured — now safe to update React state.
      if (reset) {
        setSegments([]);
        setElapsed(0);
        startTimeRef.current = null;
        audioChunksRef.current = [];
      }
      setStatus("connecting");
      isPausedRef.current = false;
      streamRef.current = stream;

      // ── Start Local MediaRecorder for Batch Fallback ─────────────────────
      // Record the raw browser audio into WebM format. We start writing chunks
      // every 1s so data is available instantly when stopping.
      try {
        const recorder = new MediaRecorder(stream);
        recorder.ondataavailable = (e) => {
          if (e.data.size > 0) audioChunksRef.current.push(e.data);
        };
        recorder.start(1000);
        recorderRef.current = recorder;
      } catch (e) {
        console.error("Local recording failed to initialize:", e);
      }

      // Use browser's native rate (48 kHz on most systems).
      const audioCtx = new AudioContext();
      audioCtxRef.current = audioCtx;

      const source = audioCtx.createMediaStreamSource(stream);
      sourceRef.current = source;

      // Waveform analyser
      const viz = audioCtx.createAnalyser();
      viz.fftSize = 512;
      source.connect(viz);
      setAnalyser(viz);

      // ScriptProcessor → raw PCM Int16
      const processor = audioCtx.createScriptProcessor(4096, 1, 1);
      processorRef.current = processor;

      // ⚠️ Read the ACTUAL sample rate from the AudioContext — it may be 44100 or 48000
      // depending on the system audio device. We pass it to the backend so Deepgram
      // is told the correct rate. Mismatch = VAD hears nothing, 0 transcriptions.
      const actualSampleRate = audioCtx.sampleRate;
      console.log(`[AudioContext] sample rate: ${actualSampleRate} Hz`);

      const mlUrl = process.env.NEXT_PUBLIC_ML_SERVER_URL || "ws://localhost:8000";
      const ws = new WebSocket(
        `${mlUrl}/transcribe/stream/${sessionId}?sample_rate=${actualSampleRate}`
      );
      wsRef.current = ws;
      ws.binaryType = "arraybuffer";

      ws.onopen = () => {
        setStatus("recording");
        processor.onaudioprocess = (e) => {
          if (isPausedRef.current) return;
          if (ws.readyState !== WebSocket.OPEN) return;
          const i16 = float32ToInt16(e.inputBuffer.getChannelData(0));
          ws.send(i16.buffer);
        };
        source.connect(processor);
        // Silent destination keeps the ScriptProcessor alive (no speaker output).
        const silentDest = audioCtx.createMediaStreamDestination();
        processor.connect(silentDest);
      };

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.error) { console.error("Deepgram error:", data.error); return; }

          if (data.is_final && data.text) {
            // ── is_final=true means Deepgram has committed to this text.
            // Add to permanent list immediately — do NOT wait for speech_final.
            // Waiting for speech_final causes sentences to be lost when the user
            // speaks continuously or pauses the recording.
            setSegments((prev) => [...prev, data]);
            setPending(null);
          } else if (!data.is_final && data.text) {
            // Interim only — update the live typing indicator.
            setPending(data);
          }
        } catch (_) {}
      };

      ws.onerror = () => {
        console.error("WebSocket error — ML server may be down.");
        cleanup(true); // keep segments
        setStatus("idle");
      };

      ws.onclose = () => {
        // Only auto-transition to idle when actively recording (not paused/processing).
        setStatus((prev) => (prev === "recording" ? "idle" : prev));
      };
    } catch (err) {
      console.error(err);
      setStatus("idle");
      alert("Microphone access denied or ML server is not running.");
    }
  }, [sessionId, audioSource, cleanup]);

  /* ── Pause ─────────────────────────────────────────────────────────────── */
  const pauseRecording = useCallback(() => {
    // Full teardown of audio graph + WebSocket, but keep all accumulated segments.
    // This prevents Deepgram billing for silence and avoids the WS dying mid-pause.
    if (recorderRef.current && recorderRef.current.state !== "inactive") { recorderRef.current.stop(); }
    if (processorRef.current) { processorRef.current.onaudioprocess = null; processorRef.current.disconnect(); }
    if (sourceRef.current) sourceRef.current.disconnect();
    if (audioCtxRef.current) audioCtxRef.current.close().catch(() => {});
    if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    audioCtxRef.current = processorRef.current = sourceRef.current = streamRef.current = recorderRef.current = null;
    setAnalyser(null);
    setPending(null);
    setStatus("paused");
  }, []);

  /* ── Resume ────────────────────────────────────────────────────────────── */
  const resumeRecording = useCallback(async () => {
    // Open a fresh connection while keeping all previously recorded segments.
    await startRecording(false);
  }, [startRecording]);

  /* ── Restart ───────────────────────────────────────────────────────────── */
  const restartRecording = useCallback(async () => {
    cleanup(false);
    wsRef.current = null;
    setStatus("idle");
    await new Promise((r) => setTimeout(r, 300));
    startRecording();
  }, [cleanup, startRecording]);

  /* ── End session ───────────────────────────────────────────────────────── */
  const endSession = useCallback(async () => {
    // Snapshot segments NOW before cleanup (state is captured in this closure).
    const finalTranscript = segments;
    setStatus("processing");
    
    // We must wait for MediaRecorder to fire its final onstop event so we guarantee
    // we have the absolute final chunk in audioChunksRef.
    const finalBlobPromise = new Promise((resolve) => {
      let resolved = false;
      if (!recorderRef.current || recorderRef.current.state === "inactive") {
        resolve(); // already stopped or never started (like resuming after pause with no new audio)
        resolved = true;
      } else {
        recorderRef.current.onstop = () => {
          if (!resolved) resolve();
        };
        recorderRef.current.stop();
      }
      setTimeout(() => { if (!resolved) resolve() }, 1500); // safety fallback
    });

    await finalBlobPromise;

    // Teardown everything else
    if (processorRef.current) { processorRef.current.onaudioprocess = null; processorRef.current.disconnect(); }
    if (sourceRef.current) sourceRef.current.disconnect();
    if (audioCtxRef.current) audioCtxRef.current.close().catch(() => {});
    if (wsRef.current) { wsRef.current.close(); wsRef.current = null; }
    if (streamRef.current) streamRef.current.getTracks().forEach((t) => t.stop());
    audioCtxRef.current = processorRef.current = sourceRef.current = streamRef.current = recorderRef.current = null;
    setAnalyser(null);
    setPending(null);

    try {
      const finalBlob = new Blob(audioChunksRef.current, { type: "audio/webm" });
      const formData = new FormData();
      formData.append("sessionId", sessionId);
      formData.append("transcript", JSON.stringify(finalTranscript));
      if (finalBlob.size > 0) {
        formData.append("audioFile", finalBlob, "recording.webm");
      }

      console.log(`[Frontend] Sending ${finalBlob.size} bytes to final upload.`);
      const res = await fetch("/api/session/complete", {
        method: "POST",
        body: formData, // JSON is no longer used
      });
      const data = await res.json();
      if (data.success) {
        router.push(`/session/${sessionId}`);
      } else {
        alert("Error completing session: " + data.error);
        setStatus("idle");
      }
    } catch (err) {
      console.error(err);
      alert("Error processing session.");
      setStatus("idle");
    }
  }, [sessionId, segments, router]);

  const isIdle       = status === "idle";
  const isConnecting = status === "connecting";
  const isRecording  = status === "recording";
  const isPaused     = status === "paused";
  const isProcessing = status === "processing";
  const isActive     = isRecording || isPaused;

  // Unique speaker list for the legend
  const speakerList = [...new Set(segments.map((s) => s.speaker || "Speaker 1"))];
  return (
    <div className="live-shell">

        {/* ── Top nav ──────────────────────────────────────────────────────── */}
        <nav className="live-nav">
          <div style={{ display: "flex", alignItems: "center", gap: "1rem" }}>
            <Link href="/" style={{ display: "flex", alignItems: "center", gap: "0.5rem", textDecoration: "none" }}>
              <div style={{ width:28,height:28,borderRadius:8,background:"linear-gradient(135deg,#8b5cf6,#d946ef)",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"0.85rem" }}>🎙</div>
              <span style={{ fontWeight:700,color:"#fafafa",fontSize:"0.95rem" }}>SesScribe</span>
            </Link>
            <span style={{ color:"rgba(255,255,255,0.2)", fontSize:"0.9rem" }}>|</span>
            <span style={{ color:"rgba(255,255,255,0.5)", fontSize:"0.85rem" }}>Live Session</span>

            {isRecording  && <div className="rec-badge"><div className="rec-dot" /> Live</div>}
            {isPaused     && <div className="paused-badge">⏸ Paused</div>}
            {isConnecting && <div className="paused-badge">Connecting…</div>}
          </div>

          {/* Controls */}
          <div style={{ display:"flex", gap:"0.6rem" }}>
            {isActive && <>
              {isRecording
                ? <button className="ctrl-btn" onClick={pauseRecording}>⏸ Pause</button>
                : <button className="ctrl-btn primary" onClick={resumeRecording}>▶ Resume</button>
              }
              <button className="ctrl-btn" onClick={restartRecording}>↺ Restart</button>
              <button className="ctrl-btn danger" onClick={endSession} disabled={isProcessing}>
                ■ End Meeting
              </button>
            </>}
          </div>
        </nav>

        {/* ── Waveform ─────────────────────────────────────────────────────── */}
        {isActive && (
          <div className="waveform-bar">
            <Waveform analyser={analyser} isActive={isRecording} />
          </div>
        )}

        {/* ── Content with sidebar ─────────────────────────────────────────── */}
        <div className="content-area">

          {/* Sidebar */}
          <div className="sidebar">
            {/* Stats */}
            <div>
              <p className="sidebar-section-label">Stats</p>
              <div className="stat-item"><span>Segments</span><span>{segments.length}</span></div>
              <div className="stat-item"><span>Speakers</span><span>{speakerList.length || "—"}</span></div>
              <div className="stat-item"><span>Duration</span><span style={{ color: isRecording ? "#a78bfa" : undefined }}>{formatTime(elapsed)}</span></div>
            </div>

            {/* Speaker legend */}
            {speakerList.length > 0 && (
              <div>
                <p className="sidebar-section-label">Speakers</p>
                {speakerList.map((sp) => {
                  const col = speakerColor(sp);
                  return (
                    <div key={sp} className="speaker-chip" style={{ background: col.bg, border: `1px solid ${col.border}` }}>
                      <div className="speaker-dot" style={{ background: col.dot }} />
                      <span style={{ color: col.text, fontWeight: 600, fontSize: "0.8rem" }}>{sp}</span>
                    </div>
                  );
                })}
              </div>
            )}

            {/* Info */}
            <div style={{ marginTop:"auto", fontSize:"0.72rem", color:"rgba(255,255,255,0.2)", lineHeight:1.7 }}>
              {isIdle && "Press Start Microphone to begin."}
              {isRecording && "Deepgram Nova-2 • Real-time diarized transcription"}
              {isPaused && "Recording paused. Resume to continue."}
              {isProcessing && "Generating AI summary with Gemini…"}
            </div>
          </div>

          {/* Transcript history panel */}
          <div className="transcript-pane" style={{ paddingBottom: pending ? "130px" : "80px" }}>
            {segments.length === 0 && !pending ? (
              <div className="empty-state">
                <div style={{ fontSize:"2.5rem", marginBottom:"0.25rem" }}>🎙</div>
                {isIdle
                  ? <><div style={{ fontSize:"1rem",fontWeight:600,color:"rgba(255,255,255,0.4)" }}>Ready to record</div>
                       <div style={{ fontSize:"0.83rem" }}>Click &ldquo;Start Microphone&rdquo; below</div></>
                  : isConnecting
                  ? <div style={{ fontSize:"0.9rem",color:"rgba(255,255,255,0.3)" }}>Connecting to Deepgram…</div>
                  : <div style={{ fontSize:"0.9rem",color:"rgba(255,255,255,0.3)" }}>Listening for speech…</div>
                }
              </div>
            ) : (
              segments.map((seg, i) => (
                <TranscriptRow key={i} seg={seg} pending={false} />
              ))
            )}
            {isProcessing && (
              <div style={{ display:"flex",alignItems:"center",gap:"0.75rem",marginTop:"1.5rem",padding:"1rem 1.25rem",background:"rgba(139,92,246,0.08)",border:"1px solid rgba(139,92,246,0.2)",borderRadius:"10px",color:"#c4b5fd",fontSize:"0.88rem" }}>
                <div className="spinner" />
                Running AI analysis…
              </div>
            )}
            <div ref={bottomRef} />
          </div>
        </div>

        {/* ── Google Meet style LIVE NOW bar ───────────────────────────────── */}
        {pending && isRecording && (() => {
          const col = speakerColor(pending.speaker || "Speaker 1");
          return (
            <div className="live-now-bar">
              <div className="live-dot-ring" />
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="live-now-speaker" style={{ color: col.text }}>
                  {pending.speaker || "Speaker 1"}
                </div>
                <div className="live-now-text">{pending.text}</div>
              </div>
            </div>
          );
        })()}

        {/* ── Bottom bar ───────────────────────────────────────────────────── */}
        <div className="bottom-bar">
          <div style={{ fontSize:"0.75rem",color:"rgba(255,255,255,0.2)",fontFamily:"monospace" }}>
            ID: {sessionId}
          </div>

          <div style={{ display:"flex",alignItems:"center",gap:"0.75rem" }}>
            <span className={`elapsed ${isRecording ? "active" : ""}`}>{formatTime(elapsed)}</span>

            {(isIdle || isConnecting) && !isProcessing && (<>
              {/* Audio source picker */}
              <div style={{ display:"flex",borderRadius:"8px",overflow:"hidden",border:"1px solid rgba(255,255,255,0.1)" }}>
                <button
                  onClick={() => setAudioSource("mic")}
                  style={{
                    padding:"0.45rem 0.85rem", fontSize:"0.78rem", fontFamily:"inherit",
                    cursor:"pointer", border:"none", transition:"background 0.15s",
                    background: audioSource === "mic" ? "rgba(139,92,246,0.35)" : "rgba(255,255,255,0.04)",
                    color: audioSource === "mic" ? "#c4b5fd" : "rgba(255,255,255,0.4)",
                    fontWeight: audioSource === "mic" ? 700 : 400,
                  }}
                  title="Capture from your physical microphone (live event / room audio)"
                >
                  🎙 Mic
                </button>
                <button
                  onClick={() => setAudioSource("system")}
                  style={{
                    padding:"0.45rem 0.85rem", fontSize:"0.78rem", fontFamily:"inherit",
                    cursor:"pointer", border:"none", borderLeft:"1px solid rgba(255,255,255,0.08)",
                    transition:"background 0.15s",
                    background: audioSource === "system" ? "rgba(139,92,246,0.35)" : "rgba(255,255,255,0.04)",
                    color: audioSource === "system" ? "#c4b5fd" : "rgba(255,255,255,0.4)",
                    fontWeight: audioSource === "system" ? 700 : 400,
                  }}
                  title="Capture a browser tab or window (YouTube, podcast, etc.)"
                >
                  🖥 Tab / Screen
                </button>
              </div>

              <button
                className="ctrl-btn primary"
                onClick={() => startRecording(true)}
                disabled={isConnecting}
                style={{ padding:"0.65rem 1.6rem",fontSize:"0.9rem" }}
              >
                {isConnecting
                  ? <><div className="spinner" /> Connecting…</>
                  : audioSource === "system" ? "▶ Start Capture" : "🎙 Start Microphone"
                }
              </button>
            </>)}
          </div>
        </div>

      </div>
  );
}

export default function LiveSession() {
  return (
    <Suspense fallback={
      <div style={{ minHeight:"100vh",background:"#08080c",display:"flex",alignItems:"center",justifyContent:"center",color:"rgba(255,255,255,0.3)",fontFamily:"Inter,sans-serif" }}>
        Loading session…
      </div>
    }>
      <LiveSessionInner />
    </Suspense>
  );
}
