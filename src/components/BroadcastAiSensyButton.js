"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function BroadcastAiSensyButton({ sessionId, disabled }) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const router = useRouter();

  async function handleBroadcast() {
    if (!confirm("Send session summary to ALL untagged contacts in AiSensy?\n\nThis will broadcast the WhatsApp template to every contact without a tag.")) return;

    setLoading(true);
    setResult(null);
    try {
      const res = await fetch("/api/session/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);

      setResult(data);
      router.refresh();
    } catch (err) {
      alert("Broadcast failed: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleBroadcast}
        disabled={disabled || loading}
        style={{
          marginTop: "1rem",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.5rem",
          padding: "0.85rem 1rem",
          background: disabled ? "rgba(255,255,255,0.05)" : "linear-gradient(135deg, #FF6B6B, #FF8E53)",
          border: "none",
          borderRadius: "8px",
          color: disabled ? "rgba(255,255,255,0.3)" : "#fff",
          fontSize: "0.9rem",
          fontWeight: "600",
          cursor: disabled || loading ? "not-allowed" : "pointer",
          transition: "all 0.2s",
          boxShadow: disabled ? "none" : "0 4px 15px rgba(255, 107, 107, 0.4)",
          width: "100%",
        }}
      >
        {loading ? (
          <span style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
            <div className="spinner" style={{ width: "14px", height: "14px", borderWidth: "2px", borderTopColor: "#fff" }} />
            Broadcasting…
          </span>
        ) : (
          <>
            <span>📣</span> Send All
          </>
        )}
      </button>

      {disabled && (
        <p style={{ fontSize: "0.75rem", color: "var(--fg-3)", marginTop: "0.4rem" }}>
          Requires: Event linked + AiSensy API key + Project ID configured
        </p>
      )}

      {result && (
        <div style={{
          marginTop: "0.75rem",
          padding: "0.75rem 1rem",
          background: "rgba(16,185,129,0.1)",
          border: "1px solid rgba(16,185,129,0.25)",
          borderRadius: "8px",
          fontSize: "0.85rem",
          color: "#34d399",
        }}>
          Sent to {result.sent}/{result.total} contacts
          {result.broadcastResults.some((r) => r.status === "failed") && (
            <span style={{ color: "#fb923c", marginLeft: "0.5rem" }}>
              ({result.total - result.sent} failed)
            </span>
          )}
        </div>
      )}
    </div>
  );
}
