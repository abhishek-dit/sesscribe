"use client";

import { useState, useEffect } from "react";

export default function AdminCleanup() {
  const [secret, setSecret] = useState("");
  const [authenticated, setAuthenticated] = useState(false);
  const [events, setEvents] = useState([]);
  const [sessions, setSessions] = useState([]);
  const [backups, setBackups] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(null);

  async function loadData() {
    setLoading(true);
    try {
      const [evRes, seRes, bkRes] = await Promise.all([
        fetch("/api/admin/list", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ secret }) }),
        fetch("/api/admin/list", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ secret, type: "sessions" }) }),
        fetch("/api/admin/backups", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ secret }) }),
      ]);
      const evData = await evRes.json();
      const seData = await seRes.json();
      const bkData = await bkRes.json();
      if (evData.error) throw new Error(evData.error);
      setEvents(evData.events || []);
      setSessions(seData.sessions || []);
      setBackups(bkData.files || []);
    } catch (e) {
      setMessage({ type: "error", text: e.message });
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(type, id, name) {
    if (!confirm(`Delete ${type}: "${name}"?\n\nThis cannot be undone.`)) return;
    try {
      const res = await fetch("/api/admin/delete", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, id, secret }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error);
      setMessage({ type: "success", text: `Deleted ${type}: ${name}` });
      loadData();
    } catch (e) {
      setMessage({ type: "error", text: e.message });
    }
  }

  if (!authenticated) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#0a0a0a" }}>
        <div style={{ background: "#111", padding: "2rem", borderRadius: "12px", border: "1px solid #222", width: "320px" }}>
          <h2 style={{ color: "#fff", marginBottom: "1rem", fontSize: "1.1rem" }}>Admin Access</h2>
          <input
            type="password"
            placeholder="Enter admin password"
            value={secret}
            onChange={(e) => setSecret(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { setAuthenticated(true); } }}
            style={{ width: "100%", padding: "0.75rem", background: "#1a1a1a", border: "1px solid #333", borderRadius: "8px", color: "#fff", fontSize: "0.9rem", marginBottom: "1rem", boxSizing: "border-box" }}
            autoFocus
          />
          <button
            onClick={() => setAuthenticated(true)}
            style={{ width: "100%", padding: "0.75rem", background: "#dc2626", border: "none", borderRadius: "8px", color: "#fff", fontWeight: 600, cursor: "pointer" }}
          >
            Enter
          </button>
        </div>
      </div>
    );
  }

  if (events.length === 0 && sessions.length === 0 && !loading) {
    loadData();
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a0a", color: "#fff", padding: "2rem" }}>
      <div style={{ maxWidth: "800px", margin: "0 auto" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2rem" }}>
          <h1 style={{ fontSize: "1.5rem" }}>Admin Cleanup</h1>
          <button onClick={loadData} disabled={loading} style={{ padding: "0.5rem 1rem", background: "#222", border: "1px solid #333", borderRadius: "6px", color: "#999", cursor: "pointer", fontSize: "0.85rem" }}>
            {loading ? "Loading..." : "Refresh"}
          </button>
        </div>

        {message && (
          <div style={{ padding: "0.75rem 1rem", marginBottom: "1.5rem", borderRadius: "8px", background: message.type === "error" ? "rgba(220,38,38,0.15)" : "rgba(16,185,129,0.15)", color: message.type === "error" ? "#f87171" : "#34d399", border: `1px solid ${message.type === "error" ? "rgba(220,38,38,0.3)" : "rgba(16,185,129,0.3)"}`, fontSize: "0.85rem" }}>
            {message.text}
          </div>
        )}

        {/* Events */}
        <h2 style={{ fontSize: "1.1rem", color: "#888", marginBottom: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", fontSize: "0.8rem" }}>Events ({events.length})</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem", marginBottom: "2.5rem" }}>
          {events.map((ev) => (
            <div key={ev.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.75rem 1rem", background: "#111", border: "1px solid #222", borderRadius: "8px" }}>
              <div>
                <span style={{ fontWeight: 600 }}>{ev.name}</span>
                <span style={{ color: "#666", fontSize: "0.8rem", marginLeft: "0.75rem" }}>{ev._count?.sessions || 0} sessions</span>
                <span style={{ color: "#555", fontSize: "0.75rem", marginLeft: "0.75rem" }}>{new Date(ev.date).toLocaleDateString()}</span>
              </div>
              <button onClick={() => handleDelete("event", ev.id, ev.name)} style={{ padding: "0.35rem 0.75rem", background: "rgba(220,38,38,0.15)", border: "1px solid rgba(220,38,38,0.3)", borderRadius: "6px", color: "#f87171", cursor: "pointer", fontSize: "0.8rem", fontWeight: 600 }}>
                Delete
              </button>
            </div>
          ))}
          {events.length === 0 && <p style={{ color: "#555", fontSize: "0.85rem" }}>No events found.</p>}
        </div>

        {/* Sessions */}
        <h2 style={{ fontSize: "1.1rem", color: "#888", marginBottom: "0.75rem", textTransform: "uppercase", letterSpacing: "0.05em", fontSize: "0.8rem" }}>Sessions ({sessions.length})</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {sessions.map((s) => (
            <div key={s.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.75rem 1rem", background: "#111", border: "1px solid #222", borderRadius: "8px" }}>
              <div>
                <span style={{ fontWeight: 600 }}>{s.title}</span>
                <span style={{ color: "#666", fontSize: "0.8rem", marginLeft: "0.75rem" }}>{s.event?.name || "No event"}</span>
                <span style={{ color: "#555", fontSize: "0.75rem", marginLeft: "0.75rem" }}>{new Date(s.date).toLocaleDateString()}</span>
              </div>
              <button onClick={() => handleDelete("session", s.id, s.title)} style={{ padding: "0.35rem 0.75rem", background: "rgba(220,38,38,0.15)", border: "1px solid rgba(220,38,38,0.3)", borderRadius: "6px", color: "#f87171", cursor: "pointer", fontSize: "0.8rem", fontWeight: 600 }}>
                Delete
              </button>
            </div>
          ))}
          {sessions.length === 0 && <p style={{ color: "#555", fontSize: "0.85rem" }}>No sessions found.</p>}
        </div>

        {/* Local Backups */}
        <h2 style={{ color: "#888", marginBottom: "0.75rem", marginTop: "1rem", textTransform: "uppercase", letterSpacing: "0.05em", fontSize: "0.8rem" }}>Local Backups ({backups.length})</h2>
        <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
          {backups.map((f) => (
            <div key={f.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "0.75rem 1rem", background: "#111", border: "1px solid #222", borderRadius: "8px" }}>
              <div>
                <span style={{ fontWeight: 600, fontFamily: "monospace", fontSize: "0.85rem" }}>{f.name}</span>
                <span style={{ color: "#666", fontSize: "0.8rem", marginLeft: "0.75rem" }}>{(f.size / 1024).toFixed(0)} KB</span>
                <span style={{ color: "#555", fontSize: "0.75rem", marginLeft: "0.75rem" }}>{new Date(f.modified).toLocaleString()}</span>
              </div>
              <button
                onClick={async () => {
                  const res = await fetch("/api/admin/backups", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ secret, action: "download", filename: f.name }),
                  });
                  const data = await res.json();
                  if (data.content) {
                    const blob = new Blob([data.content], { type: "application/json" });
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement("a");
                    a.href = url;
                    a.download = f.name;
                    a.click();
                    URL.revokeObjectURL(url);
                  }
                }}
                style={{ padding: "0.35rem 0.75rem", background: "rgba(59,130,246,0.15)", border: "1px solid rgba(59,130,246,0.3)", borderRadius: "6px", color: "#60a5fa", cursor: "pointer", fontSize: "0.8rem", fontWeight: 600 }}
              >
                Download
              </button>
            </div>
          ))}
          {backups.length === 0 && <p style={{ color: "#555", fontSize: "0.85rem" }}>No backup files found.</p>}
        </div>
      </div>
    </div>
  );
}
