import prisma from "@/lib/prisma";

export async function POST(request) {
  try {
    const formData = await request.formData();
    const sessionId = formData.get("sessionId");
    const audioFile = formData.get("audioFile");

    if (!sessionId || !audioFile || audioFile.size === 0) {
      return Response.json({ error: "sessionId and audioFile required" }, { status: 400 });
    }

    console.log(`[upload-audio] Received ${(audioFile.size / 1024 / 1024).toFixed(1)} MB for session ${sessionId}`);

    // Run Deepgram batch transcription
    let batchTranscript = null;
    try {
      const dgRes = await fetch("https://api.deepgram.com/v1/listen?model=nova-2&diarize=true&smart_format=true", {
        method: "POST",
        headers: {
          "Authorization": `Token ${process.env.DEEPGRAM_API_KEY}`,
          "Content-Type": "audio/webm",
        },
        body: audioFile,
      });

      const dgData = await dgRes.json();
      if (dgData.results && dgData.results.channels[0].alternatives[0]) {
        const words = dgData.results.channels[0].alternatives[0].words || [];
        if (words.length > 0) {
          let segments = [];
          let current = null;

          for (const w of words) {
            const speaker = `Speaker ${w.speaker !== undefined ? w.speaker + 1 : 1}`;
            if (!current || current.speaker !== speaker) {
              if (current) segments.push(current);
              current = { speaker, text: w.punctuated_word || w.word, start: w.start, end: w.end };
            } else {
              current.text += " " + (w.punctuated_word || w.word);
              current.end = w.end;
            }
          }
          if (current) segments.push(current);
          batchTranscript = segments;
          console.log(`[upload-audio] Deepgram batch: ${segments.length} segments`);
        }
      }
    } catch (err) {
      console.error("[upload-audio] Deepgram failed:", err.message);
    }

    if (!batchTranscript) {
      return Response.json({ success: true, batch: false, message: "Deepgram batch failed, live transcript preserved" });
    }

    // Update the session's transcript with batch data
    const session = await prisma.session.findUnique({ where: { id: sessionId } });
    if (!session) {
      return Response.json({ error: "Session not found" }, { status: 404 });
    }

    let parsed = {};
    try { parsed = JSON.parse(session.transcript || "{}"); } catch (_) {}
    const live = Array.isArray(parsed) ? parsed : (parsed.live || []);

    await prisma.session.update({
      where: { id: sessionId },
      data: {
        transcript: JSON.stringify({ live, batch: batchTranscript }),
      },
    });

    console.log(`[upload-audio] Session ${sessionId} updated with batch transcript`);
    return Response.json({ success: true, batch: true, segments: batchTranscript.length });
  } catch (error) {
    console.error("[upload-audio] Error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
