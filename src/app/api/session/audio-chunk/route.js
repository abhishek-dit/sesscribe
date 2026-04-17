import fs from "fs/promises";
import path from "path";

const AUDIO_DIR = path.join(process.cwd(), "uploads", "audio");

// GET /api/session/audio-chunk?sessionId=xxx — returns count of saved chunks
export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");
    if (!sessionId) return Response.json({ error: "sessionId required" }, { status: 400 });

    const chunkDir = path.join(AUDIO_DIR, sessionId);
    let files = [];
    try {
      files = await fs.readdir(chunkDir);
    } catch (_) {
      // dir doesn't exist yet — that's fine
    }
    const chunkFiles = files.filter((f) => f.startsWith("chunk-") && f.endsWith(".webm"));
    return Response.json({ chunkCount: chunkFiles.length });
  } catch (err) {
    console.error("[audio-chunk GET]", err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
}

// POST /api/session/audio-chunk — save one chunk batch to disk
export async function POST(request) {
  try {
    const formData = await request.formData();
    const sessionId = formData.get("sessionId");
    const chunkIndex = parseInt(formData.get("chunkIndex"), 10);
    const chunk = formData.get("chunk");

    if (!sessionId || isNaN(chunkIndex) || !chunk || chunk.size === 0) {
      return Response.json({ error: "sessionId, chunkIndex, and chunk required" }, { status: 400 });
    }

    const chunkDir = path.join(AUDIO_DIR, sessionId);
    await fs.mkdir(chunkDir, { recursive: true });

    const buffer = Buffer.from(await chunk.arrayBuffer());
    const filename = `chunk-${String(chunkIndex).padStart(4, "0")}.webm`;
    await fs.writeFile(path.join(chunkDir, filename), buffer);

    console.log(`[audio-chunk] Saved ${filename} (${(buffer.length / 1024).toFixed(0)} KB) for session ${sessionId}`);
    return Response.json({ success: true, filename });
  } catch (err) {
    console.error("[audio-chunk POST]", err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
