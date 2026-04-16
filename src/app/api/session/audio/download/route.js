import fs from "fs";
import path from "path";
import { spawn } from "child_process";
import prisma from "@/lib/prisma";
import { getDriveClient } from "@/lib/googleDrive";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");
    if (!sessionId) return Response.json({ error: "No sessionId" }, { status: 400 });

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      select: { audioFileId: true, audioLocalPath: true, title: true },
    });

    if (!session?.audioFileId && !session?.audioLocalPath) {
      return Response.json({ error: "No audio recording found for this session" }, { status: 404 });
    }

    const safeTitle = (session.title || sessionId).replace(/[^a-z0-9\s-]/gi, "_").trim();
    const filename = `${safeTitle}.mp3`;

    // Spawn ffmpeg: convert webm → mp3
    const ffmpeg = spawn("ffmpeg", [
      "-i", "pipe:0",
      "-f", "mp3",
      "-ab", "128k",
      "-vn",
      "pipe:1",
    ]);

    ffmpeg.stderr.on("data", (d) => process.stdout.write("[ffmpeg] " + d.toString()));

    if (session.audioFileId) {
      // Source: Google Drive
      const drive = getDriveClient();
      if (!drive) return Response.json({ error: "Drive not configured" }, { status: 500 });

      const driveRes = await drive.files.get(
        { fileId: session.audioFileId, alt: "media" },
        { responseType: "stream" }
      );
      driveRes.data.pipe(ffmpeg.stdin);
    } else {
      // Source: local file
      const absPath = path.join(process.cwd(), session.audioLocalPath);
      const fileStream = fs.createReadStream(absPath);
      fileStream.pipe(ffmpeg.stdin);
    }

    const webStream = new ReadableStream({
      start(controller) {
        ffmpeg.stdout.on("data", (chunk) => controller.enqueue(chunk));
        ffmpeg.stdout.on("end", () => controller.close());
        ffmpeg.stdout.on("error", (err) => controller.error(err));
      },
      cancel() {
        ffmpeg.kill("SIGKILL");
      },
    });

    return new Response(webStream, {
      headers: {
        "Content-Type": "audio/mpeg",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[/api/session/audio/download] Error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
