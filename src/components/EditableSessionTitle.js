"use client";

import { useState, useRef, useEffect } from "react";

export default function EditableSessionTitle({ sessionId, initialTitle }) {
  const [editing, setEditing]   = useState(false);
  const [title,   setTitle]     = useState(initialTitle);
  const [draft,   setDraft]     = useState(initialTitle);
  const [saving,  setSaving]    = useState(false);
  const [error,   setError]     = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  function enterEdit() {
    setDraft(title);
    setError(null);
    setEditing(true);
  }

  function cancelEdit() {
    setEditing(false);
    setError(null);
  }

  async function save() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    if (trimmed === title) { setEditing(false); return; }
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/session/rename", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, title: trimmed }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Save failed");
      setTitle(trimmed);
      setEditing(false);
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  }

  function onKeyDown(e) {
    if (e.key === "Enter") save();
    if (e.key === "Escape") cancelEdit();
  }

  if (editing) {
    return (
      <div>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem", flexWrap: "wrap" }}>
          <input
            ref={inputRef}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            style={{
              fontSize: "clamp(1.4rem, 3.5vw, 2.2rem)",
              fontWeight: 700,
              color: "var(--fg)",
              background: "var(--surface-2)",
              border: "2px solid var(--primary)",
              borderRadius: "8px",
              padding: "0.3rem 0.75rem",
              outline: "none",
              flex: 1,
              minWidth: "200px",
              fontFamily: "inherit",
            }}
            disabled={saving}
          />
          <div style={{ display: "flex", gap: "0.5rem", flexShrink: 0 }}>
            <button
              onClick={save}
              disabled={saving || !draft.trim()}
              style={{
                padding: "0.45rem 1rem",
                background: "var(--primary)",
                color: "#fff",
                border: "none",
                borderRadius: "7px",
                fontWeight: 600,
                fontSize: "0.85rem",
                cursor: saving ? "not-allowed" : "pointer",
                display: "flex",
                alignItems: "center",
                gap: "0.35rem",
              }}
            >
              {saving ? <><span className="spinner" style={{ width: "12px", height: "12px", borderWidth: "2px" }} /> Saving…</> : "✓ Save"}
            </button>
            <button
              onClick={cancelEdit}
              disabled={saving}
              style={{
                padding: "0.45rem 0.85rem",
                background: "transparent",
                color: "var(--fg-3)",
                border: "1px solid var(--border)",
                borderRadius: "7px",
                fontWeight: 500,
                fontSize: "0.85rem",
                cursor: "pointer",
              }}
            >
              Cancel
            </button>
          </div>
        </div>
        {error && (
          <p style={{ color: "#f87171", fontSize: "0.8rem", marginTop: "0.4rem" }}>{error}</p>
        )}
      </div>
    );
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
      <h1 style={{ fontSize: "clamp(1.6rem, 4vw, 2.4rem)", marginBottom: 0 }}>{title}</h1>
      <button
        onClick={enterEdit}
        title="Rename session"
        style={{
          background: "none",
          border: "none",
          cursor: "pointer",
          color: "var(--fg-3)",
          padding: "0.25rem",
          borderRadius: "5px",
          lineHeight: 1,
          fontSize: "0.95rem",
          flexShrink: 0,
          transition: "color 0.15s",
        }}
        onMouseOver={(e) => e.currentTarget.style.color = "var(--fg)"}
        onMouseOut={(e) => e.currentTarget.style.color = "var(--fg-3)"}
      >
        ✏️
      </button>
    </div>
  );
}
