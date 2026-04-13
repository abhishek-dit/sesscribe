import prisma from "@/lib/prisma";

export async function POST(request) {
  try {
    const { type, id, secret } = await request.json();

    // Simple secret check — must match APP_PASSWORD
    if (secret !== process.env.APP_PASSWORD) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!type || !id) {
      return Response.json({ error: "type and id required" }, { status: 400 });
    }

    if (type === "session") {
      // Delete session attendees first (cascade), then session
      await prisma.sessionAttendee.deleteMany({ where: { sessionId: id } });
      await prisma.session.delete({ where: { id } });
      return Response.json({ success: true, deleted: "session", id });
    }

    if (type === "event") {
      // Unlink sessions from this event first, then delete event
      await prisma.session.updateMany({ where: { eventId: id }, data: { eventId: null } });
      await prisma.event.delete({ where: { id } });
      return Response.json({ success: true, deleted: "event", id });
    }

    return Response.json({ error: "type must be 'session' or 'event'" }, { status: 400 });
  } catch (error) {
    console.error("[Admin Delete]", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
