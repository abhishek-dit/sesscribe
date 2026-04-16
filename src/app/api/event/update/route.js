import prisma from "@/lib/prisma";

export async function POST(request) {
  try {
    const body = await request.json();
    const { id } = body;

    if (!id) {
      return Response.json({ error: "Event ID is required" }, { status: 400 });
    }

    const existing = await prisma.event.findUnique({ where: { id } });
    if (!existing) {
      return Response.json({ error: "Event not found" }, { status: 404 });
    }

    // Only include fields that were actually sent in the request
    const data = {};
    if (body.name !== undefined)             data.name = body.name;
    if (body.driveFolderId !== undefined)     data.driveFolderId = body.driveFolderId;
    if (body.whatsappApiKey !== undefined)    data.whatsappApiKey = body.whatsappApiKey;
    if (body.whatsappNumber !== undefined)    data.whatsappNumber = body.whatsappNumber;
    if (body.campaignName !== undefined)      data.campaignName = body.campaignName || null;
    if (body.logoUrl !== undefined)           data.logoUrl = body.logoUrl || null;
    if (body.logo2Url !== undefined)          data.logo2Url = body.logo2Url || null;
    if (body.aiSensyProjectId !== undefined)  data.aiSensyProjectId = body.aiSensyProjectId || null;
    if (body.aiSensyToken !== undefined)      data.aiSensyToken = body.aiSensyToken || null;
    if (body.broadcastFilter !== undefined)   data.broadcastFilter = body.broadcastFilter;
    if (body.broadcastTag !== undefined)      data.broadcastTag = body.broadcastTag || null;

    const event = await prisma.event.update({
      where: { id },
      data,
    });

    return Response.json({ success: true, event });
  } catch (error) {
    console.error("Error updating event:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
