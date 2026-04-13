import prisma from "@/lib/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function EventPage({ params }) {
  const { id } = await params;
  
  const event = await prisma.event.findUnique({
    where: { id },
    include: {
      sessions: {
        orderBy: { date: 'desc' }
      }
    }
  });

  if (!event) return notFound();

  return (
    <div className="page-shell">
      <nav className="topnav">
        <Link href="/" className="nav-logo">
          <div className="nav-logo-icon">🎙</div>
          SesScribe
        </Link>
        <Link href="/" className="btn btn-ghost" style={{ fontSize: "0.85rem" }}>
          ← Dashboard
        </Link>
      </nav>

      <div className="page-content">
        {/* Header Section */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: "3rem", animation: "fadeUp 0.5s ease-out both" }}>
          <div>
            <p className="section-label">Event Hub</p>
            <h1 style={{ fontSize: "2.4rem", marginBottom: "0.5rem" }}>{event.name}</h1>
            <p style={{ color: "var(--fg-2)" }}>
              Created on {new Date(event.date).toLocaleDateString()}
            </p>
          </div>
          <div style={{ display: "flex", gap: "0.75rem" }}>
            <Link href={`/events/${event.id}/edit`} className="btn btn-ghost" style={{ fontSize: "0.85rem" }}>
              ⚙ Edit Event
            </Link>
            <Link href={`/session/setup?eventId=${event.id}`} className="btn btn-primary">
              + New Session
            </Link>
          </div>
        </div>

        {/* Configuration Summary Card */}
        <div className="card" style={{ marginBottom: "3rem", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "1.5rem", animation: "fadeUp 0.5s ease-out 0.1s both" }}>
          <div>
            <p style={{ fontSize: "0.75rem", color: "var(--fg-3)", fontWeight: 600, marginBottom: "0.4rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Drive Folder</p>
            <code style={{ fontSize: "0.82rem", color: "var(--primary-2)" }}>{event.driveFolderId}</code>
          </div>
          <div>
            <p style={{ fontSize: "0.75rem", color: "var(--fg-3)", fontWeight: 600, marginBottom: "0.4rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>AiSensy API Key</p>
            <code style={{ fontSize: "0.82rem" }}>{event.whatsappApiKey ? "••••••••••••" : "Not configured"}</code>
          </div>
          <div>
            <p style={{ fontSize: "0.75rem", color: "var(--fg-3)", fontWeight: 600, marginBottom: "0.4rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Sender Number</p>
            <code style={{ fontSize: "0.82rem" }}>{event.whatsappNumber || "None"}</code>
          </div>
          <div>
            <p style={{ fontSize: "0.75rem", color: "var(--fg-3)", fontWeight: 600, marginBottom: "0.4rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Campaign Template</p>
            <code style={{ fontSize: "0.82rem" }}>{event.campaignName || <span style={{ color: "var(--fg-3)" }}>Default (.env)</span>}</code>
          </div>
          <div>
            <p style={{ fontSize: "0.75rem", color: "var(--fg-3)", fontWeight: 600, marginBottom: "0.4rem", textTransform: "uppercase", letterSpacing: "0.05em" }}>Logo</p>
            {event.logoUrl ? (
              <img src={event.logoUrl} alt="Event logo" style={{ maxHeight: "28px", maxWidth: "100px", objectFit: "contain", borderRadius: "3px" }} />
            ) : (
              <span style={{ fontSize: "0.82rem", color: "var(--fg-3)" }}>Default</span>
            )}
          </div>
        </div>

        {/* Sessions Grid */}
        <section>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "1.5rem" }}>
            <h2 style={{ fontSize: "1.5rem" }}>Linked Sessions</h2>
            {event.sessions.length > 0 && (
              <span className="badge badge-purple">{event.sessions.length} records</span>
            )}
          </div>

          {event.sessions.length === 0 ? (
            <div style={{
              textAlign: "center",
              padding: "5rem 2rem",
              background: "transparent",
              border: "1px dashed var(--border-bright)",
              borderRadius: "var(--radius-lg)",
            }}>
              <div style={{ fontSize: "2.5rem", marginBottom: "1rem", opacity: 0.25 }}>🎙</div>
              <h3 style={{ color: "var(--fg-2)", fontWeight: 500, fontSize: "1rem", marginBottom: "0.4rem" }}>
                No sessions yet
              </h3>
              <p style={{ color: "var(--fg-3)", fontSize: "0.85rem" }}>
                Click New Session to start recording under this Event.
              </p>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))", gap: "1rem" }}>
              {event.sessions.map((session, i) => (
                <Link
                  key={session.id}
                  href={`/session/${session.id}`}
                  className="session-card"
                  style={{ display: "block", textDecoration: "none", color: "inherit", animation: `fadeUp 0.4s ease-out ${i * 0.04}s both` }}
                >
                  <div className="session-card-inner" style={{
                    background: "var(--surface)", border: "1px solid var(--border)", borderRadius: "var(--radius-lg)",
                    padding: "1.5rem", position: "relative", overflow: "hidden", cursor: "pointer", height: "100%", transition: "all 0.2s"
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "0.6rem" }}>
                      <h3 style={{ fontSize: "1rem", color: "var(--fg)", fontWeight: 600, lineHeight: 1.3 }}>
                        {session.title}
                      </h3>
                      <span style={{ fontSize: "0.72rem", color: "var(--fg-3)", flexShrink: 0, marginLeft: "1rem" }}>
                        {new Date(session.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                      </span>
                    </div>
                    <p style={{ fontSize: "0.84rem", color: "var(--fg-2)", lineHeight: 1.6, marginBottom: "1rem" }}>
                      {session.summary
                        ? session.summary.substring(0, 110) + "…"
                        : <em style={{ color: "var(--fg-3)" }}>Summary processing…</em>
                      }
                    </p>
                    <div style={{ fontSize: "0.8rem", color: "var(--primary-2)", fontWeight: 500 }}>
                      View transcript →
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
