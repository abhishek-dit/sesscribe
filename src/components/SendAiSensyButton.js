"use client";

import { useState } from "react";

export default function SendAiSensyButton({ sessionId, disabled }) {
  const [loading, setLoading] = useState(false);

  async function handleSend() {
    if (disabled) {
      alert("This session is not linked to an event, or the event is missing an AiSensy API key! Please select an Event first.");
      return;
    }
    
    const to = prompt("Enter recipient WhatsApp number (incl. + and country code, e.g. +14155552671):");
    if (!to) return;
    
    setLoading(true);
    try {
      const res = await fetch("/api/session/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, toNumber: to })
      });
      const data = await res.json();
      if (data.success) {
        alert("✅ Message sent successfully via AiSensy!");
      } else {
        alert("❌ Failed to send: " + data.error);
      }
    } catch (err) {
      alert("❌ Request Error: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleSend}
      disabled={loading}
      style={{
        width: "100%",
        padding: "0.75rem",
        background: "rgba(59,130,246,0.1)",
        border: "1px solid rgba(59,130,246,0.2)",
        borderRadius: "8px",
        color: "var(--primary-2)",
        fontSize: "0.85rem",
        fontWeight: "600",
        cursor: loading ? "wait" : "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.5rem",
        transition: "all 0.2s",
      }}
      onMouseOver={(e) => {
        if (!loading) e.currentTarget.style.background = "rgba(59,130,246,0.2)";
      }}
      onMouseOut={(e) => {
        if (!loading) e.currentTarget.style.background = "rgba(59,130,246,0.1)";
      }}
    >
      {loading ? (
        <span style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
          <div className="spinner" style={{ width: "12px", height: "12px", borderWidth: "2px", borderTopColor: "var(--primary-2)" }} />
          Sending...
        </span>
      ) : (
        <>
          <span>📲</span> Send WhatsApp summary
        </>
      )}
    </button>
  );
}
