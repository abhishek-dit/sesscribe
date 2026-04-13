"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function EventEditForm({ event }) {
  const [name, setName] = useState(event.name);
  const [folderId, setFolderId] = useState(event.driveFolderId);
  const [whatsappKey, setWhatsappKey] = useState(event.whatsappApiKey);
  const [whatsappNumber, setWhatsappNumber] = useState(event.whatsappNumber);
  const [campaignName, setCampaignName] = useState(event.campaignName || "");
  const [logoUrl, setLogoUrl] = useState(event.logoUrl || "");
  const [aiSensyProjectId, setAiSensyProjectId] = useState(event.aiSensyProjectId || "");
  const [aiSensyToken, setAiSensyToken] = useState(event.aiSensyToken || "");
  const [broadcastFilter, setBroadcastFilter] = useState(event.broadcastFilter || "no_tags");
  const [broadcastTag, setBroadcastTag] = useState(event.broadcastTag || "");
  const [saving, setSaving] = useState(false);
  const router = useRouter();

  async function handleSubmit(e) {
    e.preventDefault();
    setSaving(true);
    try {
      const res = await fetch("/api/event/update", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: event.id,
          name,
          driveFolderId: folderId,
          whatsappApiKey: whatsappKey,
          whatsappNumber,
          campaignName,
          logoUrl,
          aiSensyProjectId,
          aiSensyToken,
          broadcastFilter,
          broadcastTag,
        }),
      });
      const data = await res.json();
      if (data.success) {
        router.push(`/events/${event.id}`);
        router.refresh();
      } else {
        alert("Error: " + (data.error || "Unknown error"));
        setSaving(false);
      }
    } catch (err) {
      console.error(err);
      alert("Failed to save changes.");
      setSaving(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.5rem", animation: "fadeUp 0.5s ease-out 0.1s both" }}>
      {/* General Settings */}
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--fg-2)", marginBottom: "0.25rem" }}>General</h2>

        <div>
          <label className="field-label">Event Name</label>
          <input
            required
            className="field-input"
            value={name}
            onChange={(e) => setName(e.target.value)}
            style={{ fontSize: "1rem", padding: "0.9rem 1.1rem" }}
          />
        </div>

        <div>
          <label className="field-label">Google Drive Folder ID</label>
          <input
            required
            className="field-input"
            value={folderId}
            onChange={(e) => setFolderId(e.target.value)}
            style={{ fontSize: "1rem", padding: "0.9rem 1.1rem" }}
          />
        </div>
      </div>

      {/* Branding */}
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--fg-2)", marginBottom: "0.25rem" }}>Branding</h2>

        <div>
          <label className="field-label">Logo URL</label>
          <input
            className="field-input"
            placeholder="https://example.com/logo.png — used in Google Docs header"
            value={logoUrl}
            onChange={(e) => setLogoUrl(e.target.value)}
            style={{ fontSize: "1rem", padding: "0.9rem 1.1rem" }}
          />
          <p style={{ fontSize: "0.78rem", color: "var(--fg-3)", marginTop: "0.35rem" }}>
            Public image URL for the Google Docs header logo. Leave blank for the default TiE Mysuru logo.
          </p>
        </div>

        {logoUrl && (
          <div style={{
            padding: "1rem",
            background: "var(--surface-2)",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--border)",
            display: "flex",
            alignItems: "center",
            gap: "1rem",
          }}>
            <img
              src={logoUrl}
              alt="Logo preview"
              style={{ maxHeight: "48px", maxWidth: "140px", objectFit: "contain", borderRadius: "4px" }}
              onError={(e) => { e.target.style.display = "none"; }}
            />
            <span style={{ fontSize: "0.82rem", color: "var(--fg-3)" }}>Logo preview</span>
          </div>
        )}
      </div>

      {/* AiSensy / WhatsApp */}
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--fg-2)", marginBottom: "0.25rem" }}>WhatsApp (AiSensy)</h2>

        <div>
          <label className="field-label">AiSensy REST API Key</label>
          <input
            required
            type="password"
            className="field-input"
            value={whatsappKey}
            onChange={(e) => setWhatsappKey(e.target.value)}
            style={{ fontSize: "1rem", padding: "0.9rem 1.1rem" }}
          />
        </div>

        <div>
          <label className="field-label">Verified Sender Number</label>
          <input
            required
            className="field-input"
            placeholder="e.g. +14155552671"
            value={whatsappNumber}
            onChange={(e) => setWhatsappNumber(e.target.value)}
            style={{ fontSize: "1rem", padding: "0.9rem 1.1rem" }}
          />
        </div>

        <div>
          <label className="field-label">AiSensy Campaign / Template Name</label>
          <input
            className="field-input"
            placeholder="e.g. meeting_update — must match an approved AiSensy template"
            value={campaignName}
            onChange={(e) => setCampaignName(e.target.value)}
            style={{ fontSize: "1rem", padding: "0.9rem 1.1rem" }}
          />
          <p style={{ fontSize: "0.78rem", color: "var(--fg-3)", marginTop: "0.35rem" }}>
            The campaign name from AiSensy that will be used for WhatsApp broadcasts. Leave blank to use the default from .env.
          </p>
        </div>

        <div>
          <label className="field-label">AiSensy Project ID (assistantId)</label>
          <input
            className="field-input"
            placeholder="e.g. 69d0ec999beea40decad2fae"
            value={aiSensyProjectId}
            onChange={(e) => setAiSensyProjectId(e.target.value)}
            style={{ fontSize: "1rem", padding: "0.9rem 1.1rem" }}
          />
          <p style={{ fontSize: "0.78rem", color: "var(--fg-3)", marginTop: "0.35rem" }}>
            Required for &ldquo;Send All&rdquo; broadcast. Find this in your AiSensy dashboard URL or browser DevTools.
          </p>
        </div>

        <div>
          <label className="field-label">
            AiSensy Session Token
            <span style={{ color: "#34d399", fontWeight: 400, fontSize: "0.72rem", marginLeft: "0.5rem" }}>Paste once — auto-refreshes on each broadcast</span>
          </label>
          <textarea
            className="field-input"
            placeholder="Paste the 'token' cookie value from your AiSensy dashboard (DevTools → Application → Cookies)"
            value={aiSensyToken}
            onChange={(e) => setAiSensyToken(e.target.value)}
            style={{ fontSize: "0.85rem", padding: "0.9rem 1.1rem", minHeight: "80px", fontFamily: "monospace", resize: "vertical" }}
          />
          <p style={{ fontSize: "0.78rem", color: "var(--fg-3)", marginTop: "0.35rem" }}>
            One-time setup: AiSensy dashboard → DevTools (F12) → Application → Cookies → copy the <code>token</code> value. The app will auto-refresh it before each broadcast.
          </p>
        </div>
      </div>

      {/* Broadcast Filter */}
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--fg-2)", marginBottom: "0.25rem" }}>Broadcast Audience Filter</h2>

        <div>
          <label className="field-label">Who should receive the broadcast?</label>
          <select
            className="field-input"
            value={broadcastFilter}
            onChange={(e) => setBroadcastFilter(e.target.value)}
            style={{ fontSize: "1rem", padding: "0.9rem 1.1rem" }}
          >
            <option value="all">All contacts (no filter)</option>
            <option value="no_tags">Contacts with no tags</option>
            <option value="not_has_tag">Contacts WITHOUT a specific tag</option>
            <option value="has_tag">Contacts WITH a specific tag</option>
          </select>
        </div>

        {(broadcastFilter === "has_tag" || broadcastFilter === "not_has_tag") && (
          <div>
            <label className="field-label">Tag Name</label>
            <input
              className="field-input"
              placeholder="e.g. TIECONA1 — must match the exact tag name in AiSensy"
              value={broadcastTag}
              onChange={(e) => setBroadcastTag(e.target.value)}
              style={{ fontSize: "1rem", padding: "0.9rem 1.1rem" }}
            />
            <p style={{ fontSize: "0.78rem", color: "var(--fg-3)", marginTop: "0.35rem" }}>
              Enter the exact tag name from your AiSensy dashboard. Case-sensitive.
            </p>
          </div>
        )}

        <div style={{
          padding: "0.75rem 1rem",
          background: "rgba(59,130,246,0.08)",
          border: "1px solid rgba(59,130,246,0.15)",
          borderRadius: "8px",
          fontSize: "0.82rem",
          color: "var(--fg-2)",
        }}>
          {broadcastFilter === "all" && "All opted-in, non-blocked contacts will receive the message."}
          {broadcastFilter === "no_tags" && "Only contacts with zero tags assigned will receive the message."}
          {broadcastFilter === "not_has_tag" && `Contacts that do NOT have the tag "${broadcastTag || "..."}" will receive the message.`}
          {broadcastFilter === "has_tag" && `Only contacts that HAVE the tag "${broadcastTag || "..."}" will receive the message.`}
        </div>
      </div>

      <div style={{ display: "flex", justifyContent: "flex-end", gap: "0.75rem" }}>
        <button
          type="button"
          className="btn btn-ghost"
          onClick={() => router.push(`/events/${event.id}`)}
          style={{ minWidth: "100px" }}
        >
          Cancel
        </button>
        <button
          type="submit"
          className="btn btn-primary btn-lg"
          disabled={saving}
          style={{ minWidth: "200px" }}
        >
          {saving ? (
            <><div className="spinner" style={{ width: 16, height: 16 }} /> Saving...</>
          ) : (
            "Save Changes"
          )}
        </button>
      </div>
    </form>
  );
}
