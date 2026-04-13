"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function EventSelector({ sessionId, currentEventId, events }) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  async function handleChange(e) {
    setLoading(true);
    try {
      await fetch("/api/session/set-event", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId, eventId: e.target.value || null }),
      });
      router.refresh();
    } catch (err) {
      alert("Failed to update event: " + err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{ marginBottom: "1.5rem" }}>
      <label style={{ display: "block", fontSize: "0.85rem", fontWeight: "600", color: "var(--fg-3)", marginBottom: "0.4rem" }}>
        Link to Event 🗓️
      </label>
      <select
        value={currentEventId || ""}
        onChange={handleChange}
        disabled={loading}
        style={{
          width: "100%",
          padding: "0.6rem 0.8rem",
          background: "var(--surface)",
          border: "1px solid var(--border)",
          borderRadius: "6px",
          color: "var(--fg)",
          fontSize: "0.9rem",
          cursor: loading ? "wait" : "pointer"
        }}
      >
        <option value="">— No event —</option>
        {events.map((ev) => (
          <option key={ev.id} value={ev.id}>{ev.name}</option>
        ))}
      </select>
    </div>
  );
}
