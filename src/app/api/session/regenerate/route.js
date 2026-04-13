import prisma from "@/lib/prisma";

// ─── Gemini ───────────────────────────────────────────────────────────────────
async function generateSummaryAndActions(fullText) {
  const { GoogleGenerativeAI, SchemaType } = await import("@google/generative-ai");
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          summary: { type: SchemaType.STRING, description: "A concise 2-3 paragraph meeting summary" },
          actionPoints: { type: SchemaType.STRING, description: "4-5 key highlights as bullet points separated by newlines, each starting with '- '" },
        },
        required: ["summary", "actionPoints"],
      },
    },
  });

  const prompt = `
You are an expert meeting summariser.
Given the transcript below, produce EXACTLY:
1. A concise 2–3 paragraph meeting summary.
2. Between 4 and 5 key highlights or main takeaways from the session.

Critically: Do NOT prefix strings with "Highlight 1: ", "Highlight 2: ", or numbers. Use raw bullet sentences.

Transcript:
${fullText}
`.trim();

  const result = await model.generateContent(prompt);
  const raw = result.response.text().replace(/```json|```/g, "").trim();
  return JSON.parse(raw);
}

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

    // Try to parse the transcript payload
    let parsed = [];
    try { parsed = JSON.parse(session.transcript || "[]"); } catch (_) {}
    const isHybrid = !Array.isArray(parsed) && parsed.live !== undefined;
    const liveTranscript = isHybrid ? (parsed.live || []) : parsed;
    const batchTranscript = isHybrid ? parsed.batch : null;
    const bestTranscript = (batchTranscript && batchTranscript.length > 0) ? batchTranscript : liveTranscript;

    if (!bestTranscript || bestTranscript.length === 0) {
      return Response.json({ error: "No transcript available to summarize." }, { status: 400 });
    }

    const fullText = bestTranscript.map((t) => `${t.speaker}: ${t.text}`).join("\n");

    let summary = "Summary could not be generated.";
    let actionPoints = "";

    try {
      const ai = await generateSummaryAndActions(fullText);
      summary = ai.summary;
      actionPoints = ai.actionPoints;
    } catch (err) {
      console.error("[Gemini] Regenerate Error:", err.message);
      return Response.json({ error: "Failed to generate AI data" }, { status: 500 });
    }

    await prisma.session.update({
      where: { id: sessionId },
      data: { summary, actionPoints },
    });

    return Response.json({ success: true, summary, actionPoints });
  } catch (error) {
    return Response.json({ error: "Internal Server Error", message: error.message }, { status: 500 });
  }
}
