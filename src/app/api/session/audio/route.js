import fs from "fs";
import path from "path";
import prisma from "@/lib/prisma";
import { getDriveClient } from "@/lib/googleDrive";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");
    if (!sessionId) return Response.json({ error: "No sessionId" }, { status: 400 });

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      select: { audioFileId: true, audioLocalPath: true },
    });

    if (!session?.audioFileId && !session?.audioLocalPath) {
      return Response.json({ error: "No audio recording found for this session" }, { status: 404 });
    }

    // Prefer Drive; fall back to local file
    if (session.audioFileId) {
      const drive = getDriveClient();
      if (!drive) return Response.json({ error: "Drive not configured" }, { status: 500 });

      const driveRes = await drive.files.get(
        { fileId: session.audioFileId, alt: "media" },
        { responseType: "stream" }
      );

      const webStream = new ReadableStream({
        start(controller) {
          driveRes.data.on("data", (chunk) => controller.enqueue(chunk));
          driveRes.data.on("end", () => controller.close());
          driveRes.data.on("error", (err) => controller.error(err));
        },
        cancel() {
          driveRes.data.destroy();
        },
      });

      return new Response(webStream, {
        headers: {
          "Content-Type": "audio/webm",
          "Accept-Ranges": "bytes",
          "Cache-Control": "no-store",
        },
      });
    }

    // Local file fallback
    const absPath = path.join(process.cwd(), session.audioLocalPath);
    const fileStream = fs.createReadStream(absPath);
    const webStream = new ReadableStream({
      start(controller) {
        fileStream.on("data", (chunk) => controller.enqueue(chunk));
        fileStream.on("end", () => controller.close());
        fileStream.on("error", (err) => controller.error(err));
      },
      cancel() {
        fileStream.destroy();
      },
    });

    return new Response(webStream, {
      headers: {
        "Content-Type": "audio/webm",
        "Accept-Ranges": "bytes",
        "Cache-Control": "no-store",
      },
    });
  } catch (error) {
    console.error("[/api/session/audio] Error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
