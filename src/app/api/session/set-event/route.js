import prisma from "@/lib/prisma";

export async function POST(request) {
    const { sessionId, eventId } = await request.json();
    await prisma.session.update({
        where: { id: sessionId },
        data: { eventId: eventId || null },
    });
    return Response.json({ success: true });
}
