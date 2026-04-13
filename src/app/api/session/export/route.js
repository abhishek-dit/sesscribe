import prisma from "@/lib/prisma";
import { createMeetingDoc } from "@/lib/googleDrive";

export async function POST(request) {
  try {
    const body = await request.json();
    const { sessionId } = body;

    if (!sessionId) {
      return Response.json({ error: "No sessionId provided" }, { status: 400 });
    }

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
    });

    if (!session) {
      return Response.json({ error: "Session not found" }, { status: 404 });
    }

    // Reconstruct transcript
    let parsed = [];
    try { parsed = JSON.parse(session.transcript || "[]"); } catch (_) {}
    const isHybrid = !Array.isArray(parsed) && parsed.live !== undefined;
    const liveTranscript = isHybrid ? (parsed.live || []) : parsed;
    const batchTranscript = isHybrid ? parsed.batch : null;
    const bestTranscript = (batchTranscript && batchTranscript.length > 0) ? batchTranscript : liveTranscript;

    const fullText = bestTranscript.map((t) => `${t.speaker}: ${t.text}`).join("\n");

    const event = await prisma.event.findUnique({
      where: { id: session.eventId },
    });

    const folderId = event?.driveFolderId || process.env.GOOGLE_DRIVE_FOLDER_ID || "";

    // Clean old doc URLs from summary
    let cleanSummary = session.summary || "";
    // Remove old single-doc format
    const gdocMatch = cleanSummary.match(/\[📝 Google Doc Created: (https?:\/\/[^\]]+)\]\n*\n*/);
    if (gdocMatch) cleanSummary = cleanSummary.replace(gdocMatch[0], "");
    // Remove new two-doc format
    const twoDocMatch = cleanSummary.match(/\[📝 Summary: [^\]]+\]\n\[📄 Transcript: [^\]]+\]\n*\n*/);
    if (twoDocMatch) cleanSummary = cleanSummary.replace(twoDocMatch[0], "");

    const result = await createMeetingDoc(
      session.title || sessionId,
      cleanSummary,
      session.actionPoints || "",
      fullText,
      folderId,
      event?.name || null,
      event?.logoUrl || null
    );

    if (!result) {
      return Response.json({ error: "Google Docs creation failed. Check backend terminal for errors." }, { status: 500 });
    }

    const docsNote = `[📝 Summary: ${result.summaryUrl}]\n[📄 Transcript: ${result.transcriptUrl}]`;
    const newSummary = `${docsNote}\n\n${cleanSummary}`;

    await prisma.session.update({
      where: { id: sessionId },
      data: { summary: newSummary },
    });

    return Response.json({ success: true, summaryUrl: result.summaryUrl, transcriptUrl: result.transcriptUrl });
  } catch (error) {
    console.error("[/api/session/export] Error:", error);
    return Response.json({ error: "Internal Server Error", message: error.message }, { status: 500 });
  }
}
