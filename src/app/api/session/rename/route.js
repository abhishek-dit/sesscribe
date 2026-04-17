import prisma from "@/lib/prisma";

export async function POST(request) {
  try {
    const { sessionId, title } = await request.json();
    if (!sessionId || !title?.trim()) {
      return Response.json({ error: "sessionId and title are required" }, { status: 400 });
    }

    await prisma.session.update({
      where: { id: sessionId },
      data: { title: title.trim() },
    });

    return Response.json({ success: true, title: title.trim() });
  } catch (err) {
    console.error("[session/rename]", err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
