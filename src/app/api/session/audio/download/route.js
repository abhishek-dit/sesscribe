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
      select: { audioFileId: true, title: true },
    });

    if (!session?.audioFileId) {
      return Response.json({ error: "No audio recording found for this session" }, { status: 404 });
    }

    const drive = getDriveClient();
    if (!drive) return Response.json({ error: "Drive not configured" }, { status: 500 });

    const driveRes = await drive.files.get(
      { fileId: session.audioFileId, alt: "media" },
      { responseType: "stream" }
    );

    // Spawn ffmpeg: stdin=webm, stdout=mp3
    const ffmpeg = spawn("ffmpeg", [
      "-i", "pipe:0",
      "-f", "mp3",
      "-ab", "128k",
      "-vn",
      "pipe:1",
    ]);

    // Pipe Drive stream into ffmpeg stdin
    driveRes.data.pipe(ffmpeg.stdin);
    ffmpeg.stderr.on("data", (d) => process.stdout.write("[ffmpeg] " + d.toString()));

    // Convert ffmpeg stdout (Node Readable) to Web ReadableStream
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

    const safeTitle = (session.title || sessionId).replace(/[^a-z0-9\s-]/gi, "_").trim();
    const filename = `${safeTitle}.mp3`;

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
