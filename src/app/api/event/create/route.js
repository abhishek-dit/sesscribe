import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const body = await request.json();
    const { name, driveFolderId, whatsappApiKey, whatsappNumber, campaignName, logoUrl } = body;

    const event = await prisma.event.create({
      data: {
        name,
        driveFolderId,
        whatsappApiKey,
        whatsappNumber,
        campaignName: campaignName || null,
        logoUrl: logoUrl || null,
      },
    });
    
    return NextResponse.json({ success: true, event });
  } catch (error) {
    console.error("Error creating event:", error);
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}
