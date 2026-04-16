import prisma from "@/lib/prisma";
import Link from "next/link";
import { notFound } from "next/navigation";
import EventEditForm from "@/components/EventEditForm";

export default async function EditEventPage({ params }) {
  const { id } = await params;

  const event = await prisma.event.findUnique({ where: { id } });
  if (!event) return notFound();

  // Serialize the event for the client component
  const serialized = {
    id: event.id,
    name: event.name,
    driveFolderId: event.driveFolderId,
    whatsappApiKey: event.whatsappApiKey,
    whatsappNumber: event.whatsappNumber,
    campaignName: event.campaignName,
    logoUrl: event.logoUrl,
    logo2Url: event.logo2Url,
    aiSensyProjectId: event.aiSensyProjectId,
    aiSensyToken: event.aiSensyToken,
    broadcastFilter: event.broadcastFilter,
    broadcastTag: event.broadcastTag,
  };

  return (
    <div className="page-shell">
      <nav className="topnav">
        <Link href="/" className="nav-logo">
          <div className="nav-logo-icon">🎙</div>
          SesScribe
        </Link>
        <Link href={`/events/${id}`} className="btn btn-ghost" style={{ fontSize: "0.85rem" }}>
          ← Back to Event
        </Link>
      </nav>

      <div className="page-content-narrow">
        <div style={{ marginBottom: "2.5rem", animation: "fadeUp 0.5s ease-out both" }}>
          <p className="section-label">Event Settings</p>
          <h1 style={{ fontSize: "2.2rem", marginBottom: "0.5rem" }}>Edit {event.name}</h1>
          <p style={{ color: "var(--fg-2)", fontSize: "0.95rem" }}>
            Update event configuration — Drive folder, branding, AiSensy credentials, and templates.
          </p>
        </div>

        <EventEditForm event={serialized} />
      </div>
    </div>
  );
}
