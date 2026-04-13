import { readdir, readFile, stat } from "fs/promises";
import { join } from "path";

const BACKUPS_DIR = join(process.cwd(), ".backups");

export async function POST(request) {
  try {
    const { secret, action, filename } = await request.json();

    if (secret !== process.env.APP_PASSWORD) {
      return Response.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (action === "download" && filename) {
      // Return the contents of a specific backup file
      const filePath = join(BACKUPS_DIR, filename);
      try {
        const content = await readFile(filePath, "utf-8");
        return Response.json({ success: true, filename, content });
      } catch {
        return Response.json({ error: "File not found" }, { status: 404 });
      }
    }

    // Default: list all backup files
    let files = [];
    try {
      const entries = await readdir(BACKUPS_DIR);
      for (const name of entries) {
        if (!name.endsWith(".json")) continue;
        const s = await stat(join(BACKUPS_DIR, name));
        files.push({
          name,
          size: s.size,
          modified: s.mtime.toISOString(),
        });
      }
      files.sort((a, b) => new Date(b.modified) - new Date(a.modified));
    } catch {
      // .backups dir doesn't exist yet
    }

    return Response.json({ files });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}
