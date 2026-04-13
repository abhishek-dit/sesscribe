import prisma from "@/lib/prisma";

export async function POST(request) {
  try {
    const { secret, type } = await request.json();

    if (secret !== process.env.APP_PASSWORD) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (type === "sessions") {
      const sessions = await prisma.session.findMany({
        orderBy: { date: "desc" },
        select: { id: true, title: true, date: true, eventId: true, event: { select: { name: true } } },
      });
      return Response.json({ sessions });
    }

    // Default: return events
    const events = await prisma.event.findMany({
      orderBy: { date: "desc" },
      include: { _count: { select: { sessions: true } } },
    });
    return Response.json({ events });
  } catch (error) {
    console.error("[Admin List]", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
