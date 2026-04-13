"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";

export default function CreateEvent() {
    const [name, setName] = useState("");
    const [folderId, setFolderId] = useState("");
    const [whatsappKey, setWhatsappKey] = useState("");
    const [whatsappNumber, setWhatsappNumber] = useState("");
    const [campaignName, setCampaignName] = useState("");
    const [logoUrl, setLogoUrl] = useState("");
    const [isStarting, setIsStarting] = useState(false);
    const router = useRouter();

    async function handleSubmit(e) {
        e.preventDefault();
        setIsStarting(true);
        try {
            const res = await fetch("/api/event/create", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ name, driveFolderId: folderId, whatsappApiKey: whatsappKey, whatsappNumber, campaignName, logoUrl }),
            });
            const data = await res.json();
            if (data.success) {
                router.push("/");
            } else {
                alert("Error: " + data.error);
                setIsStarting(false);
            }
        } catch (err) {
            console.error(err);
            alert("Failed to create event.");
            setIsStarting(false);
        }
    }

    return (
        <div className="page-shell">
            {/* Nav */}
            <nav className="topnav">
                <Link href="/" className="nav-logo">
                    <div className="nav-logo-icon">🎙</div>
                    SesScribe
                </Link>
                <Link href="/" className="btn btn-ghost" style={{ fontSize: "0.85rem" }}>
                    ← Dashboard
                </Link>
            </nav>

            <div className="page-content-narrow">
                {/* Header */}
                <div style={{ marginBottom: "2.5rem", animation: "fadeUp 0.5s ease-out both" }}>
                    <p className="section-label">Events Grouping</p>
                    <h1 style={{ fontSize: "2.2rem", marginBottom: "0.5rem" }}>Create New Event</h1>
                    <p style={{ color: "var(--fg-2)", fontSize: "0.95rem" }}>
                        Set up an event container to group sessions. Transcripts will share this Drive folder and AiSensy credentials.
                    </p>
                </div>

                <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "1.5rem", animation: "fadeUp 0.5s ease-out 0.1s both" }}>
                    <div className="card" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                        <div>
                            <label className="field-label">Event Name</label>
                            <input
                                required
                                className="field-input"
                                placeholder="e.g. Y Combinator Demo Day, Q3 Product Summit"
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                style={{ fontSize: "1rem", padding: "0.9rem 1.1rem" }}
                                autoFocus
                            />
                        </div>

                        <div>
                            <label className="field-label">Google Drive Folder ID</label>
                            <input
                                required
                                className="field-input"
                                placeholder="e.g. 1qJioKEp-1_ElwOHfSzpJKueOmXB413Pk"
                                value={folderId}
                                onChange={(e) => setFolderId(e.target.value)}
                                style={{ fontSize: "1rem", padding: "0.9rem 1.1rem" }}
                            />
                        </div>

                        <div>
                            <label className="field-label">AiSensy REST API Key</label>
                            <input
                                required
                                type="password"
                                className="field-input"
                                placeholder="Paste your AiSensy authorization key here"
                                value={whatsappKey}
                                onChange={(e) => setWhatsappKey(e.target.value)}
                                style={{ fontSize: "1rem", padding: "0.9rem 1.1rem" }}
                            />
                        </div>

                        <div>
                            <label className="field-label">AiSensy Verified Action Sender Number</label>
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
                                Optional. Leave blank to use the default template from .env.
                            </p>
                        </div>

                        <div>
                            <label className="field-label">Logo URL (for Google Docs)</label>
                            <input
                                className="field-input"
                                placeholder="https://example.com/logo.png"
                                value={logoUrl}
                                onChange={(e) => setLogoUrl(e.target.value)}
                                style={{ fontSize: "1rem", padding: "0.9rem 1.1rem" }}
                            />
                            <p style={{ fontSize: "0.78rem", color: "var(--fg-3)", marginTop: "0.35rem" }}>
                                Optional. Public image URL shown in exported Google Docs headers.
                            </p>
                        </div>
                    </div>

                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                        <button
                            type="submit"
                            className="btn btn-primary btn-lg"
                            disabled={isStarting}
                            style={{ minWidth: "200px" }}
                        >
                            {isStarting ? (
                                <><div className="spinner" style={{ width: 16, height: 16 }} /> Creating...</>
                            ) : (
                                "✓  Create Event"
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
