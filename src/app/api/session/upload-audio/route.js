import fs from "fs/promises";
import path from "path";
import prisma from "@/lib/prisma";
import { uploadAudioToDrive } from "@/lib/googleDrive";

const AUDIO_DIR = path.join(process.cwd(), "uploads", "audio");

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

// Read and concatenate all saved chunk files for a session, then delete them
async function loadAndClearChunks(sessionId) {
  const chunkDir = path.join(AUDIO_DIR, sessionId);
  let files;
  try {
    files = await fs.readdir(chunkDir);
  } catch (_) {
    return null; // no chunks saved
  }

  const chunkFiles = files
    .filter((f) => f.startsWith("chunk-") && f.endsWith(".webm"))
    .sort(); // lexicographic order matches zero-padded index

  if (chunkFiles.length === 0) return null;

  const buffers = await Promise.all(
    chunkFiles.map((f) => fs.readFile(path.join(chunkDir, f)))
  );
  const combined = Buffer.concat(buffers);
  console.log(`[upload-audio] Combined ${chunkFiles.length} chunks → ${(combined.length / 1024 / 1024).toFixed(1)} MB`);

  // Clean up chunk files
  await fs.rm(chunkDir, { recursive: true, force: true }).catch(() => {});

  return combined;
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { sessionId } = body;

    if (!sessionId) {
      return Response.json({ error: "sessionId is required" }, { status: 400 });
    }

    console.log(`[upload-audio] Finalizing audio for session ${sessionId}`);

    // Load from saved chunks
    const audioBuffer = await loadAndClearChunks(sessionId);
    if (!audioBuffer || audioBuffer.length === 0) {
      console.log(`[upload-audio] No chunks found for session ${sessionId}`);
      return Response.json({ success: true, batch: false, audioSaved: false, segments: 0 });
    }

    // Fetch session + event
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { event: true },
    });
    if (!session) {
      return Response.json({ error: "Session not found" }, { status: 404 });
    }

    const folderId = session.event?.driveFolderId || null;
    const audioFilename = `${(session.title || sessionId).replace(/[^a-z0-9]/gi, "_")}.webm`;

    // Deepgram transcription + Drive upload in parallel
    const [dgResult, driveResult] = await Promise.allSettled([
      runDeepgramBatch(audioBuffer),
      folderId
        ? uploadAudioToDrive(audioBuffer, audioFilename, folderId)
        : Promise.resolve(null),
    ]);

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
    } else {
      if (driveResult.status === "rejected") {
        console.error("[upload-audio] Drive upload failed:", driveResult.reason?.message);
      }
      // Save combined audio locally as fallback
      try {
        const localDir = path.join(AUDIO_DIR);
        await fs.mkdir(localDir, { recursive: true });
        const localFilename = `${sessionId}.webm`;
        await fs.writeFile(path.join(localDir, localFilename), audioBuffer);
        updateData.audioLocalPath = `uploads/audio/${localFilename}`;
        console.log(`[upload-audio] Saved locally: ${updateData.audioLocalPath}`);
      } catch (localErr) {
        console.error("[upload-audio] Local save failed:", localErr.message);
      }
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.session.update({ where: { id: sessionId }, data: updateData });
    }

    return Response.json({
      success: true,
      batch: dgResult.status === "fulfilled" && dgResult.value !== null,
      segments: dgResult.status === "fulfilled" ? (dgResult.value?.length ?? 0) : 0,
      audioSaved: (driveResult.status === "fulfilled" && driveResult.value !== null) || !!updateData.audioLocalPath,
    });
  } catch (error) {
    console.error("[upload-audio] Error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
