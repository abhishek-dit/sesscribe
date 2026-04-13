"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

function SetupForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const eventId = searchParams.get("eventId");
  
  const [title, setTitle] = useState("");
  const [isStarting, setIsStarting] = useState(false);

  const handleStart = async (e) => {
    e.preventDefault();
    if (!title.trim()) return alert("Please enter a meeting title.");
    setIsStarting(true);
    try {
      const payload = { title, attendees: [] };
      if (eventId) payload.eventId = eventId;

      const res = await fetch("/api/session/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const session = await res.json();
      if (session.id) {
        router.push(`/session/live?id=${session.id}`);
      } else {
        alert("Failed to create session.");
        setIsStarting(false);
      }
    } catch (err) {
      console.error(err);
      alert("Error creating session.");
      setIsStarting(false);
    }
  };

  return (
    <div className="page-shell">
      {/* Nav */}
      <nav className="topnav">
        <Link href="/" className="nav-logo">
          <div className="nav-logo-icon">🎙</div>
          SesScribe
        </Link>
        <Link href="/" className="btn btn-ghost" style={{ fontSize: "0.85rem" }}>
          ← Dashboard
        </Link>
      </nav>

      <div className="page-content-narrow">
        {/* Header */}
        <div style={{ marginBottom: "2.5rem", animation: "fadeUp 0.5s ease-out both" }}>
          <p className="section-label">New Recording</p>
          <h1 style={{ fontSize: "2.2rem", marginBottom: "0.5rem" }}>Meeting Setup</h1>
          <p style={{ color: "var(--fg-2)", fontSize: "0.95rem" }}>
            Give your session a name, then go live. When you end the meeting the AI will generate a summary automatically.
          </p>
        </div>

        <form onSubmit={handleStart} style={{ display: "flex", flexDirection: "column", gap: "1.5rem", animation: "fadeUp 0.5s ease-out 0.1s both" }}>

          {/* Session title */}
          <div className="card">
            <label className="field-label">Meeting Title</label>
            <input
              required
              className="field-input"
              placeholder="e.g. Q3 Planning, Weekly Sync, Design Review…"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{ fontSize: "1rem", padding: "0.9rem 1.1rem" }}
              autoFocus
            />
          </div>

          {/* Info banner */}
          <div style={{
            padding: "1rem 1.2rem",
            background: "rgba(139,92,246,0.07)",
            border: "1px solid rgba(139,92,246,0.2)",
            borderRadius: "var(--radius-sm)",
            fontSize: "0.85rem",
            color: "var(--fg-2)",
            lineHeight: 1.75,
            display: "flex",
            gap: "0.75rem",
            alignItems: "flex-start",
          }}>
            <span style={{ fontSize: "1.1rem", flexShrink: 0 }}>💡</span>
            <span>
              <strong style={{ color: "var(--primary-2)" }}>How it works:</strong>{" "}
              After setup, you&apos;ll go to the live recording page. Speak naturally — transcription streams in real-time every few seconds. Hit <em>End Meeting</em> when done and Gemini will produce a summary and action points.
            </span>
          </div>

          {/* Submit */}
          <div style={{ display: "flex", justifyContent: "flex-end" }}>
            <button
              type="submit"
              className="btn btn-primary btn-lg"
              disabled={isStarting}
              style={{ minWidth: "220px" }}
            >
              {isStarting ? (
                <><div className="spinner" style={{ width: 16, height: 16 }} /> Creating session…</>
              ) : (
                "▶  Begin Live Transcription"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function SetupSession() {
  return (
    <Suspense fallback={<div style={{ padding: "4rem", textAlign: "center", color: "var(--fg-3)" }}>Loading setup engine...</div>}>
      <SetupForm />
    </Suspense>
  );
}
