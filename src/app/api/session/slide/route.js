import prisma from "@/lib/prisma";

const SLIDE_MODELS = [
  "gemini-2.5-flash-image",
  "gemini-3.1-flash-image-preview",
];

async function tryGenerateImage(apiKey, contentParts) {
  for (const model of SLIDE_MODELS) {
    try {
      console.log(`[Slide] Trying model: ${model}`);
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: contentParts }],
            generationConfig: {
              responseModalities: ["TEXT", "IMAGE"],
              imageConfig: {
                aspectRatio: "16:9",
              },
            },
          }),
        }
      );

      if (!res.ok) {
        const errText = await res.text();
        console.warn(`[Slide] Model ${model} failed (${res.status}):`, errText.slice(0, 200));
        continue;
      }

      const data = await res.json();
      const parts = data.candidates?.[0]?.content?.parts || [];
      const imagePart = parts.find((p) => p.inlineData);

      if (imagePart) {
        console.log(`[Slide] Image generated with model: ${model}`);
        return imagePart;
      }

      console.warn(`[Slide] Model ${model} returned no image.`);
    } catch (err) {
      console.warn(`[Slide] Model ${model} error:`, err.message);
    }
  }
  return null;
}

export async function POST(request) {
  try {
    const { sessionId } = await request.json();
    if (!sessionId) {
      return Response.json({ error: "No sessionId provided" }, { status: 400 });
    }

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { event: true },
    });
    if (!session) {
      return Response.json({ error: "Session not found" }, { status: 404 });
    }

    const eventName = session.event?.name || "TiECon Mysuru 2026";
    const logoUrl = session.event?.logoUrl || "https://media.licdn.com/dms/image/v2/D560BAQG5CiuZGPpnaw/company-logo_200_200/B56ZydvRqHHYAI-/0/1772172942682/tie_mysuru_logo?e=1777507200&v=beta&t=YyJG7jxRg-1aiS5p02FNyYoIFJnCLZZhNzJNVInc883U";

    const highlights = (session.actionPoints || "")
      .split("\n")
      .map((l) => l.replace(/^[-•*]\s*/, "").trim())
      .filter(Boolean)
      .slice(0, 5);

    if (highlights.length === 0) {
      return Response.json({ error: "No highlights available to generate slide" }, { status: 400 });
    }

    // Fetch the logo image and convert to base64 for Gemini multimodal input
    let logoBase64 = null;
    let logoMime = "image/png";
    try {
      const logoRes = await fetch(logoUrl);
      if (logoRes.ok) {
        logoMime = logoRes.headers.get("content-type") || "image/png";
        const logoBuf = Buffer.from(await logoRes.arrayBuffer());
        logoBase64 = logoBuf.toString("base64");
      }
    } catch (e) {
      console.warn("[Slide] Could not fetch logo:", e.message);
    }

    const prompt = `Generate a 16:9 widescreen presentation slide (1920x1080).

The attached image is the official event logo — place it LARGE and clearly visible in the top-left corner of the slide, sized at approximately 200x200 pixels so it is prominent and easy to read. Do NOT redraw, recreate, or modify the logo in any way. Use the exact attached image as-is. The logo must be clearly legible — this is critical.

DESIGN:
- Background: deep navy gradient (#0F172A to #1E293B)
- A thin red (#CC0000) horizontal accent line below the header area
- Top area (next to the logo): "${eventName}" in bold white, large. Below it: "${session.title}" in light blue (#60A5FA). Below that: "SesScribe — An InsideOut Event Product" in small gray (#9CA3AF)
- Main content area: display these key highlights as a numbered list with good spacing, white text on the dark background:
${highlights.map((h, i) => `  ${i + 1}. ${h}`).join("\n")}
- Each bullet/number in red (#CC0000), text in white
- Bottom-right: "Powered by SesScribe — An InsideOut Event Product" in small dark gray (#64748B)
- Style: clean, modern, corporate. Sans-serif. No stock photos. Text-focused with tasteful geometric accents only.
- The output MUST be exactly 16:9 aspect ratio (1920x1080).`;

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return Response.json({ error: "GEMINI_API_KEY not configured" }, { status: 500 });
    }

    // Build multimodal content parts: logo image + text prompt
    const contentParts = [];
    if (logoBase64) {
      contentParts.push({ inlineData: { mimeType: logoMime, data: logoBase64 } });
    }
    contentParts.push({ text: prompt });

    const imagePart = await tryGenerateImage(apiKey, contentParts);

    if (!imagePart) {
      return Response.json({ error: "All Gemini image models failed. Check the server logs and ensure your API key has image generation access." }, { status: 502 });
    }

    return Response.json({
      success: true,
      image: {
        mimeType: imagePart.inlineData.mimeType,
        data: imagePart.inlineData.data,
      },
      sessionTitle: session.title,
      eventName,
    });
  } catch (error) {
    console.error("[/api/session/slide] Error:", error);
    return Response.json({ error: "Internal Server Error", message: error.message }, { status: 500 });
  }
}
