import prisma from "@/lib/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";
import RegenerateButton from "@/components/RegenerateButton";
import ExportDocsButton from "@/components/ExportDocsButton";
import EventSelector from "@/components/EventSelector";
import BroadcastAiSensyButton from "@/components/BroadcastAiSensyButton";
import HighlightsSlideButton from "@/components/HighlightsSlideButton";


/* ─── Helpers ──────────────────────────────────────────────────────────────── */
function initials(name = "") {
  return name
    .split(" ")
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("");
}

function formatTime(secs) {
  const m = Math.floor(secs / 60).toString().padStart(2, "0");
  const s = Math.floor(secs % 60).toString().padStart(2, "0");
  return `${m}:${s}`;
}

const SPEAKER_PALETTE = [
  { bg: "rgba(139,92,246,0.15)", border: "rgba(139,92,246,0.35)", text: "#a78bfa", dot: "#8b5cf6" },
  { bg: "rgba(217,70,239,0.12)", border: "rgba(217,70,239,0.3)", text: "#e879f9", dot: "#d946ef" },
  { bg: "rgba(59,130,246,0.12)", border: "rgba(59,130,246,0.3)", text: "#60a5fa", dot: "#3b82f6" },
  { bg: "rgba(16,185,129,0.12)", border: "rgba(16,185,129,0.3)", text: "#34d399", dot: "#10b981" },
  { bg: "rgba(251,146,60,0.12)", border: "rgba(251,146,60,0.3)", text: "#fb923c", dot: "#f97316" },
];

function getSpeakerColor(speaker = "", speakerMap) {
  if (!speakerMap.has(speaker)) {
    speakerMap.set(speaker, SPEAKER_PALETTE[speakerMap.size % SPEAKER_PALETTE.length]);
  }
  return speakerMap.get(speaker);
}

/* ─── Action point parser ──────────────────────────────────────────────────── */
function parseActionPoints(raw = "") {
  if (!raw) return [];
  return raw
    .split("\n")
    .map((l) => l.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean);
}

/* ─── Page ─────────────────────────────────────────────────────────────────── */
export default async function SessionResult({ params }) {
  const { id } = await params;

  const session = await prisma.session.findUnique({
    where: { id },
    include: { attendees: { include: { attendee: true } }, event: true },
  });

  if (!session) return notFound();

  const events = await prisma.event.findMany({
    orderBy: { date: 'desc' }
  });

  let parsed = [];
  try { parsed = JSON.parse(session.transcript || "[]"); } catch (_) { }

  // Parse new { live, batch } schema vs old flat array schema
  const isHybrid = !Array.isArray(parsed) && parsed.live !== undefined;
  const liveTranscript = isHybrid ? (parsed.live || []) : parsed;
  const batchTranscript = isHybrid ? parsed.batch : null;

  // Use batch for stats and primary display if it exists, otherwise live
  const primaryTranscript = (batchTranscript && batchTranscript.length > 0) ? batchTranscript : liveTranscript;

  const attendees = session.attendees.map((a) => a.attendee);
  const duration =
    primaryTranscript.length > 0
      ? primaryTranscript[primaryTranscript.length - 1]?.end ?? 0
      : 0;
  const speakerSet = [...new Set(primaryTranscript.map((s) => s.speaker))];
  const actionPoints = parseActionPoints(session.actionPoints);

  // Extract Google Doc Links from summary
  let displaySummary = session.summary || "No summary available.";
  let gdocsSummaryUrl = null;
  let gdocsTranscriptUrl = null;

  // New two-doc format
  const twoDocMatch = displaySummary.match(/\[📝 Summary: (https?:\/\/[^\]]+)\]\n\[📄 Transcript: (https?:\/\/[^\]]+)\]\n*\n*/);
  if (twoDocMatch) {
    gdocsSummaryUrl = twoDocMatch[1];
    gdocsTranscriptUrl = twoDocMatch[2];
    displaySummary = displaySummary.replace(twoDocMatch[0], "");
  }
  // Legacy single-doc format
  const gdocMatch = displaySummary.match(/\[📝 Google Doc Created: (https?:\/\/[^\]]+)\]\n*\n*/);
  if (gdocMatch) {
    gdocsSummaryUrl = gdocMatch[1];
    displaySummary = displaySummary.replace(gdocMatch[0], "");
  }

  // Build per-speaker colors consistently
  const speakerMap = new Map();
  speakerSet.forEach((sp) => getSpeakerColor(sp, speakerMap));

  return (
    <>
      <style>{`
        .results-grid {
          display: grid;
          grid-template-columns: minmax(350px, 1.2fr) 2fr;
          gap: 1.5rem;
          align-items: start;
        }
        @media (max-width: 900px) {
          .results-grid { grid-template-columns: 1fr; }
        }
        .stat-row {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 1rem;
          margin-bottom: 1.5rem;
        }
        .stat-box {
          background: var(--surface-2);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          padding: 1rem 1.2rem;
        }
        .stat-box-label {
          font-size: 0.72rem;
          font-weight: 600;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          color: var(--fg-3);
          margin-bottom: 0.35rem;
        }
        .stat-box-value {
          font-size: 1.35rem;
          font-weight: 700;
          color: var(--fg);
          line-height: 1;
        }
        .seg-row {
          display: flex;
          gap: 1rem;
          padding: 1rem 0;
          border-bottom: 1px solid var(--border);
          animation: fadeUp 0.3s ease-out both;
        }
        .seg-row:last-child { border-bottom: none; }
        .seg-avatar {
          width: 36px; height: 36px;
          border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 0.8rem; font-weight: 700; flex-shrink: 0;
          box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        }
        .seg-bubble {
          border-radius: 12px;
          border-top-left-radius: 2px;
          padding: 0.8rem 1rem;
          margin-top: 0.4rem;
          border: 1px solid var(--border);
        }
        .action-item {
          display: flex;
          gap: 0.75rem;
          align-items: flex-start;
          padding: 0.75rem 0;
          border-bottom: 1px solid var(--border);
        }
        .action-item:last-child { border-bottom: none; }
        .action-check {
          width: 20px; height: 20px; flex-shrink: 0;
          border-radius: 50%;
          border: 2px solid rgba(139,92,246,0.4);
          background: rgba(139,92,246,0.08);
          display: flex; align-items: center; justify-content: center;
          margin-top: 1px;
        }
        .attendee-pill {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.45rem 0.75rem 0.45rem 0.45rem;
          background: var(--surface-2);
          border: 1px solid var(--border);
          border-radius: 99px;
          font-size: 0.82rem;
          color: var(--fg-2);
        }
        .attendee-avatar {
          width: 24px; height: 24px;
          border-radius: 50%;
          background: linear-gradient(135deg, var(--primary), var(--pink));
          display: flex; align-items: center; justify-content: center;
          font-size: 0.65rem; font-weight: 700; color: #fff;
        }
        .transcript-scroll {
          max-height: 600px;
          overflow-y: auto;
          padding-right: 0.25rem;
        }
        .transcript-scroll::-webkit-scrollbar { width: 4px; }
        .transcript-scroll::-webkit-scrollbar-track { background: transparent; }
        .transcript-scroll::-webkit-scrollbar-thumb { background: var(--surface-3); border-radius: 2px; }

        /* <details> accordion styling */
        details.fallback-transcript {
          margin-top: 1.5rem;
          background: var(--surface-2);
          border: 1px solid var(--border);
          border-radius: var(--radius-sm);
          overflow: hidden;
        }
        details.fallback-transcript summary {
          padding: 1rem 1.5rem;
          font-size: 0.9rem;
          font-weight: 600;
          color: var(--fg-2);
          cursor: pointer;
          list-style: none; /* hide default arrow */
          display: flex; align-items: center; justify-content: space-between;
          background: rgba(255,255,255,0.02);
        }
        details.fallback-transcript summary::-webkit-details-marker { display: none; }
        details.fallback-transcript[open] summary { border-bottom: 1px solid var(--border); }
        details.fallback-transcript summary::after {
          content: "▼";
          font-size: 0.7rem;
          transition: transform 0.2s;
        }
        details.fallback-transcript[open] summary::after { transform: rotate(180deg); }
        .audio-card {
          background: var(--surface-1);
          border: 1px solid var(--border);
          border-top: 3px solid #10b981;
          border-radius: var(--radius);
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .audio-player {
          width: 100%;
          accent-color: #10b981;
          border-radius: 8px;
        }
        .audio-download-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.65rem 1.2rem;
          background: rgba(16,185,129,0.12);
          border: 1px solid rgba(16,185,129,0.3);
          border-radius: 8px;
          color: #34d399;
          font-size: 0.85rem;
          font-weight: 600;
          text-decoration: none;
          transition: background 0.15s;
          width: fit-content;
        }
        .audio-download-btn:hover {
          background: rgba(16,185,129,0.2);
        }
      `}</style>

      <div className="page-shell">
        {/* Nav */}
        <nav className="topnav">
          <Link href="/" className="nav-logo">
            <div className="nav-logo-icon">🎙</div>
            SesScribe
          </Link>
          <Link href="/">
            <button className="btn btn-ghost" style={{ fontSize: "0.85rem" }}>
              ← Dashboard
            </button>
          </Link>
        </nav>

        <div className="page-content">

          {/* Page header */}
          <div style={{ marginBottom: "2rem", animation: "fadeUp 0.5s ease-out both" }}>
            {/* Breadcrumb */}
            <div style={{ display: "flex", alignItems: "center", gap: "0.4rem", fontSize: "0.8rem", color: "var(--fg-3)", marginBottom: "0.75rem" }}>
              <Link href="/" style={{ color: "var(--fg-3)", textDecoration: "none" }}>Dashboard</Link>
              <span>/</span>
              <span style={{ color: "var(--fg-2)" }}>Session</span>
              <span>/</span>
              <span style={{ color: "var(--fg)", maxWidth: "200px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{session.title}</span>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "1rem" }}>
              <div>
                <h1 style={{ fontSize: "clamp(1.6rem, 4vw, 2.4rem)", marginBottom: "0.4rem" }}>{session.title}</h1>
                <p style={{ color: "var(--fg-3)", fontSize: "0.85rem" }}>
                  Recorded on{" "}
                  {new Date(session.date).toLocaleDateString("en-US", {
                    weekday: "long", year: "numeric", month: "long", day: "numeric",
                    hour: "2-digit", minute: "2-digit",
                  })}
                </p>
              </div>
              <div className="badge badge-green" style={{ flexShrink: 0 }}>✓ Completed</div>
            </div>

            {/* Attendees */}
            {attendees.length > 0 && (
              <div style={{ display: "flex", gap: "0.5rem", marginTop: "1rem", flexWrap: "wrap" }}>
                {attendees.map((a) => (
                  <div key={a.id} className="attendee-pill">
                    <div className="attendee-avatar">{initials(a.name)}</div>
                    {a.name}
                  </div>
                ))}
              </div>
            )}
          </div>



          {/* Stats & Actions Row */}
          <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "1.5rem", marginBottom: "2rem", animation: "fadeUp 0.5s ease-out 0.1s both", alignItems: "center" }}>
            <div className="stat-row" style={{ flex: 1, minWidth: "300px", marginBottom: 0 }}>
              <div className="stat-box">
                <div className="stat-box-label">Duration</div>
                <div className="stat-box-value">{duration > 0 ? formatTime(duration) : "—"}</div>
              </div>
              <div className="stat-box">
                <div className="stat-box-label">Segments</div>
                <div className="stat-box-value">{primaryTranscript.length}</div>
              </div>
              <div className="stat-box">
                <div className="stat-box-label">Speakers</div>
                <div className="stat-box-value">{speakerSet.length || "—"}</div>
              </div>
            </div>

            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              {gdocsSummaryUrl ? (
                <>
                  <a href={gdocsSummaryUrl} target="_blank" rel="noopener noreferrer" className="btn badge-green" style={{ display: "flex", alignItems: "center", gap: "0.5rem", textDecoration: "none", margin: 0, padding: "0.75rem 1.2rem" }}>
                    <span>📝</span> Summary Doc
                  </a>
                  {gdocsTranscriptUrl && (
                    <a href={gdocsTranscriptUrl} target="_blank" rel="noopener noreferrer" className="btn badge-purple" style={{ display: "flex", alignItems: "center", gap: "0.5rem", textDecoration: "none", margin: 0, padding: "0.75rem 1.2rem" }}>
                      <span>📄</span> Transcript Doc
                    </a>
                  )}
                </>
              ) : (
                <ExportDocsButton sessionId={session.id} />
              )}
              <RegenerateButton sessionId={session.id} />
            </div>
          </div>



          {/* Main grid */}
          <div className="results-grid" style={{ animation: "fadeUp 0.5s ease-out 0.15s both" }}>

            {/* ── Left column ─────────────────────────────────────────────── */}
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>
              
              {/* Event & Sharing Configuration */}
              <div className="card" style={{ borderTop: "3px solid var(--primary)", display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.5rem" }}>
                  <div style={{
                    width: "30px", height: "30px", borderRadius: "8px",
                    background: "rgba(59,130,246,0.15)",
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.9rem",
                  }}>⚙️</div>
                  <h2 style={{ fontSize: "1rem", fontWeight: "700" }}>Sharing & Groups</h2>
                </div>
                <EventSelector sessionId={session.id} currentEventId={session.eventId} events={events} />
                <BroadcastAiSensyButton sessionId={session.id} disabled={!session.eventId || !session.event?.whatsappApiKey} />
              </div>

              {/* AI Summary */}
              <div className="card" style={{ borderTop: "3px solid var(--primary)", display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "1rem" }}>
                  <div style={{
                    width: "30px", height: "30px", borderRadius: "8px",
                    background: "rgba(139,92,246,0.15)",
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.9rem",
                  }}>✨</div>
                  <h2 style={{ fontSize: "1rem", fontWeight: "700" }}>AI Summary</h2>
                </div>
                <p className="prose" style={{ whiteSpace: "pre-wrap", margin: 0 }}>
                  {displaySummary}
                </p>
              </div>

              {/* Key Highlights */}
              <div className="card" style={{ borderTop: "3px solid var(--pink)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "1rem" }}>
                  <div style={{
                    width: "30px", height: "30px", borderRadius: "8px",
                    background: "rgba(217,70,239,0.12)",
                    display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.9rem",
                  }}>💡</div>
                  <h2 style={{ fontSize: "1rem", fontWeight: "700" }}>Key Highlights</h2>
                  {actionPoints.length > 0 && (
                    <span style={{
                      marginLeft: "auto",
                      background: "rgba(217,70,239,0.12)",
                      color: "#e879f9",
                      border: "1px solid rgba(217,70,239,0.25)",
                      borderRadius: "99px",
                      fontSize: "0.72rem",
                      fontWeight: "600",
                      padding: "0.15rem 0.6rem",
                    }}>
                      {actionPoints.length}
                    </span>
                  )}
                </div>

                <HighlightsSlideButton
                  sessionId={session.id}
                  actionPoints={actionPoints}
                  existingSlide={session.slideImage ? JSON.parse(session.slideImage) : null}
                />

                {actionPoints.length === 0 ? (
                  <p style={{ color: "var(--fg-3)", fontSize: "0.88rem" }}>No highlights generated.</p>
                ) : (
                  <div>
                    {actionPoints.map((ap, i) => (
                      <div key={i} className="action-item">
                        <div className="action-check">
                          <span style={{ fontSize: "0.6rem", color: "var(--primary-2)" }}>✓</span>
                        </div>
                        <p style={{ fontSize: "0.9rem", color: "var(--fg-2)", lineHeight: 1.6 }}>{ap}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Recording */}
              {session.audioFileId && (
                <div className="audio-card">
                  <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                    <div style={{
                      width: "30px", height: "30px", borderRadius: "8px",
                      background: "rgba(16,185,129,0.15)",
                      display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.9rem",
                    }}>🎙</div>
                    <h2 style={{ fontSize: "1rem", fontWeight: "700" }}>Session Recording</h2>
                  </div>
                  <audio
                    className="audio-player"
                    controls
                    preload="metadata"
                    src={`/api/session/audio?sessionId=${session.id}`}
                  />
                  <a
                    className="audio-download-btn"
                    href={`/api/session/audio/download?sessionId=${session.id}`}
                    download
                  >
                    ⬇ Download as MP3
                  </a>
                  <p style={{ fontSize: "0.75rem", color: "var(--fg-3)", margin: 0 }}>
                    Audio recorded during this session. Download converts to MP3 — may take a moment for long recordings.
                  </p>
                </div>
              )}

              {/* Speaker legend */}
              {speakerSet.length > 0 && (
                <div className="card">
                  <h2 style={{ fontSize: "0.85rem", fontWeight: "700", color: "var(--fg-2)", marginBottom: "0.75rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Speakers Detected
                  </h2>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    {speakerSet.map((sp) => {
                      const col = speakerMap.get(sp);
                      return (
                        <div key={sp} style={{ display: "flex", alignItems: "center", gap: "0.7rem" }}>
                          <div style={{
                            width: "10px", height: "10px", borderRadius: "50%",
                            background: col.dot, flexShrink: 0,
                          }} />
                          <span style={{ fontSize: "0.88rem", color: "var(--fg-2)", fontWeight: "500" }}>{sp}</span>
                          <span style={{ marginLeft: "auto", fontSize: "0.78rem", color: "var(--fg-3)" }}>
                            {primaryTranscript.filter((s) => s.speaker === sp).length} segments
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* ── Right column — Transcript ────────────────────────────────── */}
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              {/* Card header */}
              <div style={{
                padding: "1.2rem 1.75rem",
                borderBottom: "1px solid var(--border)",
                background: "var(--surface-2)",
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
              }}>
                <div>
                  <h2 style={{ fontSize: "1rem", fontWeight: "700" }}>
                    {batchTranscript ? "Final Transcript (Batch AI)" : "Full Transcript"}
                  </h2>
                  {batchTranscript && (
                    <div style={{ fontSize: "0.75rem", color: "#34d399", marginTop: "0.2rem", fontWeight: 600 }}>
                      ✓ High Precision Audio Pass
                    </div>
                  )}
                </div>
                <span style={{ fontSize: "0.78rem", color: "var(--fg-3)" }}>
                  {primaryTranscript.length} segment{primaryTranscript.length !== 1 ? "s" : ""}
                </span>
              </div>

              {/* Transcript body */}
              <div className="transcript-scroll" style={{ padding: "1.25rem 1.75rem" }}>
                {primaryTranscript.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--fg-3)" }}>
                    <div style={{ fontSize: "2rem", marginBottom: "0.75rem", opacity: 0.3 }}>📄</div>
                    <p style={{ fontSize: "0.9rem" }}>No transcript recorded.</p>
                  </div>
                ) : (
                  primaryTranscript.map((seg, idx) => {
                    const col = getSpeakerColor(seg.speaker, speakerMap);
                    return (
                      <div key={idx} className="seg-row" style={{ animationDelay: `${idx * 0.02}s` }}>
                        <div className="seg-avatar" style={{ background: col.bg, border: `1px solid ${col.border}`, color: col.text }}>
                          {(seg.speaker || "?")[0].toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                            <span style={{ fontSize: "0.85rem", fontWeight: "700", color: col.text }}>{seg.speaker || "Unknown"}</span>
                            {seg.start != null && (
                              <span style={{ fontSize: "0.7rem", color: "var(--fg-3)", background: "rgba(255,255,255,0.05)", padding: "0.15rem 0.45rem", borderRadius: "4px", fontVariantNumeric: "tabular-nums", fontFamily: "monospace" }}>
                                {formatTime(seg.start)}
                              </span>
                            )}
                          </div>
                          <div className="seg-bubble" style={{ background: `linear-gradient(to right, ${col.bg.replace("0.1", "0.03")}, transparent)` }}>
                            <p style={{ fontSize: "0.92rem", color: "var(--fg)", lineHeight: 1.6, margin: 0 }}>{seg.text}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* If we have a batch transcript, show the live one as a collapsible fallback */}
            {batchTranscript && liveTranscript.length > 0 && (
              <details className="fallback-transcript">
                <summary>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span>Original Live Transcript (Fallback)</span>
                    <span style={{ fontSize: "0.7rem", background: "rgba(255,255,255,0.1)", padding: "3px 8px", borderRadius: "99px" }}>
                      {liveTranscript.length} segments
                    </span>
                  </div>
                </summary>

                <div className="transcript-scroll" style={{ padding: "1.25rem 1.75rem", borderTop: "1px solid var(--border)", maxHeight: "400px" }}>
                  {liveTranscript.map((seg, idx) => {
                    const col = getSpeakerColor(seg.speaker, speakerMap);
                    return (
                      <div key={`live-${idx}`} className="seg-row" style={{ opacity: 0.85 }}>
                        <div className="seg-avatar" style={{ background: col.bg, border: `1px solid ${col.border}`, color: col.text }}>
                          {(seg.speaker || "?")[0].toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                            <span style={{ fontSize: "0.85rem", fontWeight: "700", color: col.text }}>{seg.speaker || "Unknown"}</span>
                            {seg.start != null && (
                              <span style={{ fontSize: "0.7rem", color: "var(--fg-3)", background: "rgba(255,255,255,0.05)", padding: "0.15rem 0.45rem", borderRadius: "4px", fontVariantNumeric: "tabular-nums", fontFamily: "monospace" }}>
                                {formatTime(seg.start)}
                              </span>
                            )}
                          </div>
                          <div className="seg-bubble" style={{ background: `linear-gradient(to right, ${col.bg.replace("0.1", "0.03")}, transparent)` }}>
                            <p style={{ fontSize: "0.92rem", color: "var(--fg)", lineHeight: 1.6, margin: 0 }}>{seg.text}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </details>
            )}

          </div>
        </div>
      </div>
    </>
  );
}
