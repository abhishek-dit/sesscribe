"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function ExportDocsButton({ sessionId, styleOverride = {} }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleExport() {
    setLoading(true);
    try {
      const res = await fetch("/api/session/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      router.refresh();
    } catch (err) {
      alert("Failed to export to Google Docs: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={loading}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: "0.5rem",
        padding: "0.75rem 1.2rem",
        background: "rgba(16,185,129,0.1)",
        border: "1px solid rgba(16,185,129,0.2)",
        borderRadius: "8px",
        color: "#34d399",
        fontSize: "0.85rem",
        fontWeight: "600",
        cursor: loading ? "not-allowed" : "pointer",
        transition: "all 0.2s",
        ...styleOverride,
      }}
      onMouseOver={(e) => {
        if (!loading) e.currentTarget.style.background = "rgba(16,185,129,0.2)";
      }}
      onMouseOut={(e) => {
        if (!loading) e.currentTarget.style.background = "rgba(16,185,129,0.1)";
      }}
    >
      {loading ? (
        <span style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
          <div className="spinner" style={{ width: "12px", height: "12px", borderWidth: "2px", borderTopColor: "var(--primary-2)" }} />
          Creating Doc...
        </span>
      ) : (
        <>
          <span>📝</span> Create Google Doc
        </>
      )}
    </button>
  );
}
