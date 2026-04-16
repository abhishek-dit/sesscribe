import prisma from "@/lib/prisma";
import { uploadAudioToDrive } from "@/lib/googleDrive";

async function runDeepgramBatch(audioBuffer) {
  const dgRes = await fetch(
    "https://api.deepgram.com/v1/listen?model=nova-2&diarize=true&smart_format=true",
    {
      method: "POST",
      headers: {
        Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
        "Content-Type": "audio/webm",
      },
      body: audioBuffer,
    }
  );
  const dgData = await dgRes.json();
  const words = dgData.results?.channels?.[0]?.alternatives?.[0]?.words || [];
  if (!words.length) return null;

  const segments = [];
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
  console.log(`[upload-audio] Deepgram batch: ${segments.length} segments`);
  return segments;
}

export async function POST(request) {
  try {
    const formData = await request.formData();
    const sessionId = formData.get("sessionId");
    const audioFile = formData.get("audioFile");

    if (!sessionId || !audioFile || audioFile.size === 0) {
      return Response.json({ error: "sessionId and audioFile required" }, { status: 400 });
    }

    // Read into buffer once — used for both Deepgram and Drive upload
    const audioBuffer = Buffer.from(await audioFile.arrayBuffer());
    console.log(`[upload-audio] Received ${(audioBuffer.length / 1024 / 1024).toFixed(1)} MB for session ${sessionId}`);

    // Fetch session + event (for folder ID and live transcript)
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { event: true },
    });
    if (!session) {
      return Response.json({ error: "Session not found" }, { status: 404 });
    }

    const folderId = session.event?.driveFolderId || null;
    const audioFilename = `${(session.title || sessionId).replace(/[^a-z0-9]/gi, "_")}.webm`;

    // Run Deepgram transcription + Drive upload in parallel
    const [dgResult, driveResult] = await Promise.allSettled([
      runDeepgramBatch(audioBuffer),
      folderId
        ? uploadAudioToDrive(audioBuffer, audioFilename, folderId)
        : Promise.resolve(null),
    ]);

    // Build session update
    const updateData = {};

    if (dgResult.status === "fulfilled" && dgResult.value) {
      let parsed = {};
      try { parsed = JSON.parse(session.transcript || "{}"); } catch (_) {}
      const live = Array.isArray(parsed) ? parsed : (parsed.live || []);
      updateData.transcript = JSON.stringify({ live, batch: dgResult.value });
    } else if (dgResult.status === "rejected") {
      console.error("[upload-audio] Deepgram failed:", dgResult.reason?.message);
    }

    if (driveResult.status === "fulfilled" && driveResult.value?.fileId) {
      updateData.audioFileId = driveResult.value.fileId;
      console.log(`[upload-audio] Audio Drive fileId: ${driveResult.value.fileId}`);
    } else if (driveResult.status === "rejected") {
      console.error("[upload-audio] Drive upload failed:", driveResult.reason?.message);
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.session.update({ where: { id: sessionId }, data: updateData });
    }

    return Response.json({
      success: true,
      batch: dgResult.status === "fulfilled" && dgResult.value !== null,
      segments: dgResult.status === "fulfilled" ? (dgResult.value?.length ?? 0) : 0,
      audioSaved: driveResult.status === "fulfilled" && driveResult.value !== null,
    });
  } catch (error) {
    console.error("[upload-audio] Error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
