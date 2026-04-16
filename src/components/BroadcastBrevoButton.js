"use client";

import { useState } from "react";

export default function BroadcastBrevoButton({ sessionId, disabled }) {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);

  async function handleSend() {
    if (!confirm("Send this session summary to your Brevo email list? This will create and send a campaign immediately.")) return;

    setLoading(true);
    setError(null);
    setSent(false);
    try {
      const res = await fetch("/api/session/broadcast-brevo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Unknown error");
      setSent(true);
      setTimeout(() => setSent(false), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleSend}
        disabled={disabled || loading}
        style={{
          marginTop: "0.75rem",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.5rem",
          padding: "0.85rem 1rem",
          background: disabled
            ? "rgba(255,255,255,0.05)"
            : sent
              ? "linear-gradient(135deg, #10b981, #059669)"
              : "linear-gradient(135deg, #3b82f6, #6366f1)",
          border: "none",
          borderRadius: "8px",
          color: disabled ? "rgba(255,255,255,0.3)" : "#fff",
          fontSize: "0.9rem",
          fontWeight: "600",
          cursor: disabled || loading ? "not-allowed" : "pointer",
          transition: "all 0.2s",
          boxShadow: disabled ? "none" : sent ? "0 4px 15px rgba(16,185,129,0.4)" : "0 4px 15px rgba(59,130,246,0.4)",
          width: "100%",
        }}
      >
        {loading ? (
          <span style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
            <div className="spinner" style={{ width: "14px", height: "14px", borderWidth: "2px", borderTopColor: "#fff" }} />
            Sending…
          </span>
        ) : sent ? (
          "✓ Sent!"
        ) : (
          <>
            <span>📧</span> Send Email Broadcast
          </>
        )}
      </button>

      {disabled && (
        <p style={{ fontSize: "0.75rem", color: "var(--fg-3)", marginTop: "0.4rem" }}>
          Requires: Event linked + Brevo API key + sender email + list ID configured
        </p>
      )}

      {error && (
        <div style={{
          marginTop: "0.75rem",
          padding: "0.75rem 1rem",
          background: "rgba(239,68,68,0.1)",
          border: "1px solid rgba(239,68,68,0.25)",
          borderRadius: "8px",
          fontSize: "0.82rem",
          color: "#f87171",
        }}>
          {error}
        </div>
      )}
    </div>
  );
}
