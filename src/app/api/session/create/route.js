import prisma from "@/lib/prisma";
import { NextResponse } from "next/server";

export async function POST(request) {
  try {
    const body = await request.json();
    const { title, attendees, eventId } = body;

    // Create session
    const session = await prisma.session.create({
      data: {
        title,
        ...(eventId && { eventId }),
        attendees: {
          create: attendees.map(attendee => ({
            attendee: {
              create: {
                name: attendee.name,
                email: attendee.email || "no-email@example.com",
                whatsappNumber: attendee.whatsapp || "none"
              }
            }
          }))
        }
      }
    });

    return NextResponse.json({ id: session.id });
  } catch (error) {
    console.error("Failed to create session:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
