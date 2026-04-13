import prisma from "@/lib/prisma";

export async function GET(_request, { params }) {
  const { id } = await params;
  const event = await prisma.event.findUnique({ where: { id } });
  if (!event) {
    return Response.json({ error: "Event not found" }, { status: 404 });
  }
  return Response.json({ event });
}
