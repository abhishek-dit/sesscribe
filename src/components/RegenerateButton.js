"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function RegenerateButton({ sessionId, styleOverride = {} }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleRegenerate() {
    setLoading(true);
    try {
      const res = await fetch("/api/session/regenerate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      router.refresh();
    } catch (err) {
      alert("Failed to regenerate summary: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleRegenerate}
      disabled={loading}
      style={{
        padding: "0.75rem 1.2rem",
        background: "rgba(139,92,246,0.1)",
        border: "1px solid rgba(139,92,246,0.2)",
        borderRadius: "8px",
        color: "#a78bfa",
        fontSize: "0.85rem",
        fontWeight: "600",
        cursor: loading ? "not-allowed" : "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.5rem",
        transition: "all 0.2s",
        ...styleOverride,
      }}
      onMouseOver={(e) => {
        if(!loading) e.currentTarget.style.background = "rgba(139,92,246,0.2)";
      }}
      onMouseOut={(e) => {
        if(!loading) e.currentTarget.style.background = "rgba(139,92,246,0.1)";
      }}
    >
      {loading ? (
        <span style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
          <div className="spinner" style={{ width: "12px", height: "12px", borderWidth: "2px" }} />
          Regenerating API...
        </span>
      ) : (
        <>
          <span>🔄</span> Regenerate AI Summary
        </>
      )}
    </button>
  );
}
