"use client";

import React from "react";

export default function CanvaExportButton({ actionPoints, sessionTitle }) {
  if (!actionPoints || actionPoints.length === 0) return null;

  return (
    <button
      className="btn badge-purple"
      style={{
        marginBottom: "1rem",
        display: "inline-flex",
        width: "fit-content",
        padding: "0.5rem 1rem",
      }}
      onClick={() => {
        const textToCopy = `Key Highlights - ${sessionTitle}\n\n${actionPoints.join("\n")}`;
        
        navigator.clipboard.writeText(textToCopy).then(() => {
            alert("Highlights copied to clipboard! Paste them into the Canva slide.");
            window.open("https://www.canva.com/create/presentation/", "_blank");
        }).catch(err => {
            alert("Failed to copy text. Opening Canva anyway...");
            window.open("https://www.canva.com/create/presentation/", "_blank");
        });
      }}
    >
      <span>🎨</span> Open in Canva
    </button>
  );
}
