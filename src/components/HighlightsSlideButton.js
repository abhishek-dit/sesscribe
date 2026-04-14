"use client";

import React, { useState } from "react";

export default function HighlightsSlideButton({ sessionId, actionPoints, existingSlide }) {
  const [loading, setLoading] = useState(false);
  const [slideData, setSlideData] = useState(existingSlide || null); // { mimeType, data }

  if (!actionPoints || actionPoints.length === 0) return null;

  function getDataUrl(slide) {
    return `data:${slide.mimeType};base64,${slide.data}`;
  }

  function downloadSlide(slide, filename) {
    const url = getDataUrl(slide);
    const link = document.createElement("a");
    link.href = url;
    link.download = filename || "highlights-slide.png";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }

  async function generateSlide(regenerate = false) {
    setLoading(true);
    if (regenerate) setSlideData(null);

    try {
      const res = await fetch("/api/session/slide", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, regenerate }),
      });

      const data = await res.json();
      if (!res.ok) {
        alert(data.error || "Failed to generate slide");
        return;
      }

      setSlideData(data.image);

      // Auto-download on fresh generation
      downloadSlide(data.image, `${data.sessionTitle || "highlights"} - ${data.eventName || "slide"}.png`);
    } catch (err) {
      console.error("Slide generation error:", err);
      alert("Failed to generate slide. Check console for details.");
    } finally {
      setLoading(false);
    }
  }

  if (slideData) {
    return (
      <div style={{ marginBottom: "1rem" }}>
        <div style={{
          borderRadius: "var(--radius-sm)",
          overflow: "hidden",
          border: "1px solid var(--border)",
          background: "var(--surface-2)",
          marginBottom: "0.5rem",
        }}>
          <img
            src={getDataUrl(slideData)}
            alt="Highlights slide"
            style={{ width: "100%", display: "block" }}
          />
          <div style={{ padding: "0.5rem 0.75rem", display: "flex", gap: "0.5rem" }}>
            <button
              className="btn btn-ghost"
              style={{ fontSize: "0.8rem", padding: "0.35rem 0.75rem" }}
              onClick={() => downloadSlide(slideData, "highlights-slide.png")}
            >
              Download
            </button>
            <button
              className="btn btn-ghost"
              style={{
                fontSize: "0.8rem",
                padding: "0.35rem 0.75rem",
                opacity: loading ? 0.6 : 1,
                pointerEvents: loading ? "none" : "auto",
              }}
              onClick={() => generateSlide(true)}
              disabled={loading}
            >
              {loading ? (
                <><span className="spinner" style={{ width: "12px", height: "12px" }} /> Regenerating…</>
              ) : (
                "Regenerate"
              )}
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{ marginBottom: "1rem" }}>
      <button
        className="btn badge-purple"
        style={{
          display: "inline-flex",
          alignItems: "center",
          gap: "0.5rem",
          width: "fit-content",
          padding: "0.5rem 1rem",
          opacity: loading ? 0.6 : 1,
          pointerEvents: loading ? "none" : "auto",
        }}
        onClick={() => generateSlide(false)}
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
    </div>
  );
}
