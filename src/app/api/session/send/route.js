// src/app/api/session/send/route.js
import prisma from "@/lib/prisma";
import { sendWhatsAppMessage } from "@/lib/aiSensy";

export async function POST(request) {
    try {
        const { sessionId, toNumber } = await request.json();

        // 1️⃣ Load session + event
        const session = await prisma.session.findUnique({
            where: { id: sessionId },
            include: { event: true },
        });
        if (!session) throw new Error("Session not found");

        // 2️⃣ Extract Google‑Doc URL from summary
        const gdocMatch = (session.summary ?? "").match(
            /\[📝 Google Doc Created: (https?:\/\/[^\]]+)\]/
        );
        if (!gdocMatch) throw new Error("No Google Doc URL attached to this session");
        const docUrl = gdocMatch[1];

        // 3️⃣ Build message
        const message = `🗒️ *${session.title}* – meeting summary is ready:\n${docUrl}`;

        // 4️⃣ Send via AiSensy
        const result = await sendWhatsAppMessage({
            apiKey: session.event?.whatsappApiKey,
            fromNumber: session.event?.whatsappNumber,
            toNumber,
            message,
        });

        return Response.json({ success: true, result });
    } catch (err) {
        console.error("[SEND] error:", err);
        return Response.json(
            { error: err.message || "Failed to send WhatsApp message" },
            { status: 500 }
        );
    }
}
