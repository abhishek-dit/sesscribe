import prisma from "@/lib/prisma";

// GET /api/session/transcript?sessionId=xxx — returns live segments saved so far
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");
    if (!sessionId) return Response.json({ error: "sessionId required" }, { status: 400 });

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      select: { transcript: true },
    });
    if (!session) return Response.json({ error: "Session not found" }, { status: 404 });

    let live = [];
    try {
      const parsed = JSON.parse(session.transcript || "{}");
      if (Array.isArray(parsed)) {
        live = parsed; // legacy flat array
      } else if (parsed.live) {
        live = parsed.live;
      }
    } catch (_) {}

    return Response.json({ segments: live });
  } catch (err) {
    console.error("[transcript GET]", err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/session/transcript — save live segments without triggering AI processing
export async function POST(request) {
  try {
    const { sessionId, segments } = await request.json();
    if (!sessionId || !Array.isArray(segments)) {
      return Response.json({ error: "sessionId and segments required" }, { status: 400 });
    }

    // Preserve existing batch transcript (from audio upload) if present
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      select: { transcript: true },
    });
    let batch = null;
    try {
      const existing = JSON.parse(session?.transcript || "{}");
      if (!Array.isArray(existing)) batch = existing.batch ?? null;
    } catch (_) {}

    await prisma.session.update({
      where: { id: sessionId },
      data: { transcript: JSON.stringify({ live: segments, batch }) },
    });

    return Response.json({ success: true, saved: segments.length });
  } catch (err) {
    console.error("[transcript POST]", err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
