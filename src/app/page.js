import Link from "next/link";
import prisma from "@/lib/prisma";

/* -------------------------------------------------
   Home – now an **Events Dashboard**
   ------------------------------------------------- */
export const dynamic = "force-dynamic";

export default async function Home() {
  /* 1️⃣ Load events (with a sessions count) */
  let events = [];
  try {
    events = await prisma.event.findMany({
      orderBy: { date: "desc" },
      include: { sessions: true },
    });
  } catch (e) {
    console.error("Prisma error:", e);
  }

  return (
    <>
      {/* -----------------------------------------------------------------
         Global styles – keep the same visual language as the rest of the app
         ----------------------------------------------------------------- */}
      <style>{`
        .event-card {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius-lg);
          padding: 1.5rem;
          transition: border-color .2s, transform .2s, box-shadow .2s;
          cursor: pointer;
        }
        .event-card:hover {
          border-color: rgba(139,92,246,0.4);
          transform: translateY(-3px);
          box-shadow: 0 12px 32px rgba(0,0,0,0.4);
        }
        .event-card::before {
          content: '';
          position: absolute;
          top: 0; left: 0; right: 0;
          height: 3px;
          background: linear-gradient(90deg, var(--primary), var(--pink));
          opacity: .5;
          transition: opacity .2s;
        }
        .event-card:hover::before { opacity: 1; }
        .topnav .btn { margin-left: 0.5rem; }
      `}</style>

      {/* -----------------------------------------------------------------
         Navigation (logo + quick‑action buttons)
         ----------------------------------------------------------------- */}
      <div className="page-shell">
        <nav className="topnav">
          <Link href="/" className="nav-logo">
            <div className="nav-logo-icon">🎙</div>
            SesScribe
          </Link>

          {/* New Session button (keeps existing behaviour)
          <Link href="/session/setup" className="btn btn-primary">
            + New Session
          </Link> */}

          {/* New Event button */}
          <Link href="/events/create" className="btn btn-ghost">
            + New Event
          </Link>
        </nav>

        {/* -----------------------------------------------------------------
           Main content – Events grid
           ----------------------------------------------------------------- */}
        <div className="page-content">
          <section style={{ marginBottom: "4rem" }}>
            <h2 style={{ fontSize: "1.8rem", marginBottom: "1rem" }}>
              Events Dashboard
            </h2>

            {events.length === 0 ? (
              <div
                style={{
                  textAlign: "center",
                  padding: "4rem 2rem",
                  border: "1px dashed var(--border-bright)",
                  borderRadius: "var(--radius-lg)",
                }}
              >
                <div style={{ fontSize: "2rem", opacity: 0.25, marginBottom: "1rem" }}>
                  📅
                </div>
                <h3 style={{ color: "var(--fg-2)", marginBottom: ".5rem" }}>
                  No events yet
                </h3>
                <p style={{ color: "var(--fg-3)" }}>
                  Create an event to group sessions, assign a Drive folder and a
                  WhatsApp API key.
                </p>
              </div>
            ) : (
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
                  gap: "1rem",
                }}
              >
                {events.map((ev) => (
                  <div
                    key={ev.id}
                    className="event-card"
                    style={{ position: "relative", animation: "fadeUp .5s ease-out both" }}
                  >
                    <Link href={`/events/${ev.id}`} style={{ display: "block", color: "inherit", textDecoration: "none" }}>
                      <h3 style={{ fontSize: "1.1rem", marginBottom: ".4rem" }}>
                        {ev.name}
                      </h3>
                      <p style={{ fontSize: ".9rem", color: "var(--fg-3)", marginBottom: ".3rem" }}>
                        {new Date(ev.date).toLocaleDateString("en-US", {
                          month: "short",
                          day: "numeric",
                          year: "numeric",
                        })}
                      </p>
                      <p style={{ fontSize: ".85rem", color: "var(--fg-2)" }}>
                        📁 Drive: {ev.driveFolderId.substring(0, 15)}...
                      </p>
                      <p style={{ fontSize: ".85rem", color: "var(--fg-2)", marginTop: ".3rem" }}>
                        🎤 Sessions: {ev.sessions?.length ?? 0}
                      </p>
                    </Link>
                    <div style={{ marginTop: "1rem", display: "flex", gap: ".5rem" }}>
                      <Link href={`/events/${ev.id}`} className="btn btn-ghost btn-sm">
                        View details
                      </Link>
                      <Link href={`/session/setup?eventId=${ev.id}`} className="btn btn-primary btn-sm">
                        New Session
                      </Link>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
