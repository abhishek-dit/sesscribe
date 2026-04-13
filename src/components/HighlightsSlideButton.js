"use client";

import React, { useState } from "react";

export default function HighlightsSlideButton({ sessionId, actionPoints }) {
  const [loading, setLoading] = useState(false);
  const [slideUrl, setSlideUrl] = useState(null);

  if (!actionPoints || actionPoints.length === 0) return null;

  async function generateSlide() {
    setLoading(true);
    setSlideUrl(null);

    try {
      const res = await fetch("/api/session/slide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to generate slide");
        return;
      }

      // Convert base64 to blob URL for download/preview
      const byteChars = atob(data.image.data);
      const byteArray = new Uint8Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) {
        byteArray[i] = byteChars.charCodeAt(i);
      }
      const blob = new Blob([byteArray], { type: data.image.mimeType });
      const url = URL.createObjectURL(blob);
      setSlideUrl(url);

      // Auto-trigger download
      const link = document.createElement("a");
      link.href = url;
      link.download = `${data.sessionTitle || "highlights"} - ${data.eventName || "slide"}.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    } catch (err) {
      console.error("Slide generation error:", err);
      alert("Failed to generate slide. Check console for details.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        className="btn badge-purple"
        style={{
          marginBottom: slideUrl ? "0.75rem" : "1rem",
          display: "inline-flex",
          alignItems: "center",
          gap: "0.5rem",
          width: "fit-content",
          padding: "0.5rem 1rem",
          opacity: loading ? 0.6 : 1,
          pointerEvents: loading ? "none" : "auto",
        }}
        onClick={generateSlide}
        disabled={loading}
      >
        {loading ? (
          <>
            <span className="spinner" style={{ width: "14px", height: "14px" }} />
            Generating Slide…
          </>
        ) : (
          <>
            <span>🖼</span> Generate Highlights Slide
          </>
        )}
      </button>

      {slideUrl && (
        <div style={{
          marginBottom: "1rem",
          borderRadius: "var(--radius-sm)",
          overflow: "hidden",
          border: "1px solid var(--border)",
          background: "var(--surface-2)",
        }}>
          <img
            src={slideUrl}
            alt="Highlights slide"
            style={{ width: "100%", display: "block" }}
          />
          <div style={{ padding: "0.5rem 0.75rem", display: "flex", gap: "0.5rem" }}>
            <a
              href={slideUrl}
              download="highlights-slide.png"
              className="btn btn-ghost"
              style={{ fontSize: "0.8rem", padding: "0.35rem 0.75rem" }}
            >
              Download
            </a>
          </div>
        </div>
      )}
    </div>
  );
}
