import prisma from "@/lib/prisma";
import puppeteer from "puppeteer-core";
import { existsSync } from "fs";

function getChromiumPath() {
  const candidates = [
    process.env.PUPPETEER_EXECUTABLE_PATH,
    // Docker Alpine (apk install chromium)
    "/usr/bin/chromium-browser",
    "/usr/bin/chromium",
    "/usr/bin/google-chrome",
    // macOS local dev
    "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
    "/Applications/Chromium.app/Contents/MacOS/Chromium",
  ];
  return candidates.find((p) => p && existsSync(p));
}

function buildSlideHtml({ eventName, sessionTitle, highlights, logoBase64, logoMime }) {
  const logoSrc = logoBase64
    ? `data:${logoMime};base64,${logoBase64}`
    : null;

  const bulletItems = highlights
    .map(
      (h) => `
      <li>
        <span class="bullet">●</span>
        <span class="bullet-text">${escapeHtml(h)}</span>
      </li>`
    )
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=1920" />
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    width: 1920px;
    height: 1080px;
    overflow: hidden;
    font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
    background: linear-gradient(135deg, #0F172A 0%, #1E293B 60%, #0F2044 100%);
    color: #ffffff;
    position: relative;
  }

  /* Subtle geometric background accents */
  body::before {
    content: '';
    position: absolute;
    top: -200px;
    right: -200px;
    width: 700px;
    height: 700px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(204,0,0,0.06) 0%, transparent 70%);
    pointer-events: none;
  }
  body::after {
    content: '';
    position: absolute;
    bottom: -150px;
    left: -100px;
    width: 500px;
    height: 500px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(96,165,250,0.05) 0%, transparent 70%);
    pointer-events: none;
  }

  .slide {
    width: 1920px;
    height: 1080px;
    padding: 70px 90px 60px 90px;
    display: flex;
    flex-direction: column;
    position: relative;
    z-index: 1;
  }

  /* ── Header ── */
  .header {
    display: flex;
    align-items: center;
    gap: 48px;
    margin-bottom: 36px;
  }

  .logo-wrap {
    flex-shrink: 0;
    width: 140px;
    height: 140px;
    background: rgba(255,255,255,0.06);
    border-radius: 20px;
    border: 1px solid rgba(255,255,255,0.1);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 12px;
  }

  .logo-wrap img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }

  .logo-placeholder {
    width: 100%;
    height: 100%;
    background: linear-gradient(135deg, #CC0000, #8B0000);
    border-radius: 12px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 48px;
    font-weight: 800;
    color: white;
  }

  .header-text {
    flex: 1;
  }

  .event-name {
    font-size: 38px;
    font-weight: 800;
    color: #ffffff;
    letter-spacing: -0.3px;
    line-height: 1.1;
    margin-bottom: 10px;
  }

  .session-title {
    font-size: 52px;
    font-weight: 700;
    color: #60A5FA;
    line-height: 1.15;
    letter-spacing: -0.5px;
    margin-bottom: 10px;
  }

  .brand-tag {
    font-size: 22px;
    color: #94A3B8;
    font-weight: 400;
    letter-spacing: 0.3px;
  }

  /* ── Divider ── */
  .divider {
    height: 3px;
    background: linear-gradient(to right, #CC0000, rgba(204,0,0,0.3), transparent);
    border-radius: 2px;
    margin-bottom: 44px;
  }

  /* ── Highlights ── */
  .highlights-label {
    font-size: 20px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.12em;
    color: #CC0000;
    margin-bottom: 22px;
  }

  .bullets {
    list-style: none;
    display: flex;
    flex-direction: column;
    gap: 20px;
    flex: 1;
  }

  .bullets li {
    display: flex;
    align-items: flex-start;
    gap: 22px;
    line-height: 1.4;
  }

  .bullet {
    color: #CC0000;
    font-size: 22px;
    flex-shrink: 0;
    margin-top: 3px;
  }

  .bullet-text {
    font-size: 30px;
    color: #E2E8F0;
    font-weight: 500;
    line-height: 1.45;
  }

  /* ── Footer ── */
  .footer {
    margin-top: auto;
    padding-top: 28px;
    display: flex;
    justify-content: flex-end;
    align-items: center;
    border-top: 1px solid rgba(255,255,255,0.07);
  }

  .footer-text {
    font-size: 20px;
    color: #475569;
    font-weight: 500;
    letter-spacing: 0.2px;
  }
</style>
</head>
<body>
<div class="slide">
  <div class="header">
    <div class="logo-wrap">
      ${logoSrc
        ? `<img src="${logoSrc}" alt="Logo" />`
        : `<div class="logo-placeholder">T</div>`}
    </div>
    <div class="header-text">
      <div class="event-name">${escapeHtml(eventName)}</div>
      <div class="session-title">${escapeHtml(sessionTitle)}</div>
      <div class="brand-tag">SesScribe — An InsideOut Event Product</div>
    </div>
  </div>

  <div class="divider"></div>

  <div class="highlights-label">Key Highlights</div>
  <ul class="bullets">
    ${bulletItems}
  </ul>

  <div class="footer">
    <span class="footer-text">Powered by SesScribe — An InsideOut Event Product</span>
  </div>
</div>
</body>
</html>`;
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");
    if (!sessionId) return Response.json({ error: "No sessionId" }, { status: 400 });

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      select: { slideImage: true },
    });
    if (!session) return Response.json({ error: "Session not found" }, { status: 404 });

    if (session.slideImage) {
      const parsed = JSON.parse(session.slideImage);
      return Response.json({ success: true, image: parsed });
    }
    return Response.json({ success: true, image: null });
  } catch (error) {
    return Response.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const { sessionId, regenerate } = await request.json();
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

    // Return cached unless regenerating
    if (!regenerate && session.slideImage) {
      const parsed = JSON.parse(session.slideImage);
      return Response.json({ success: true, image: parsed, sessionTitle: session.title, eventName: session.event?.name || "Event" });
    }

    const eventName = session.event?.name || "TiECon Mysuru 2026";
    const logoUrl = session.event?.logoUrl || "https://media.licdn.com/dms/image/v2/D560BAQG5CiuZGPpnaw/company-logo_200_200/B56ZydvRqHHYAI-/0/1772172942682/tie_mysuru_logo?e=1777507200&v=beta&t=YyJG7jxRg-1aiS5p02FNyYoIFJnCLZZhNzJNVInc883U";

    const highlights = (session.actionPoints || "")
      .split("\n")
      .map((l) => l.replace(/^[-•*]\s*/, "").trim())
      .filter(Boolean)
      .slice(0, 6);

    if (highlights.length === 0) {
      return Response.json({ error: "No highlights available to generate slide" }, { status: 400 });
    }

    // Fetch logo as base64
    let logoBase64 = null;
    let logoMime = "image/png";
    try {
      const logoRes = await fetch(logoUrl);
      if (logoRes.ok) {
        logoMime = logoRes.headers.get("content-type")?.split(";")[0] || "image/png";
        const logoBuf = Buffer.from(await logoRes.arrayBuffer());
        logoBase64 = logoBuf.toString("base64");
      }
    } catch (e) {
      console.warn("[Slide] Could not fetch logo:", e.message);
    }

    const html = buildSlideHtml({
      eventName,
      sessionTitle: session.title,
      highlights,
      logoBase64,
      logoMime,
    });

    // Screenshot with Puppeteer
    const executablePath = getChromiumPath();
    console.log("[Slide] Launching browser at:", executablePath);

    const browser = await puppeteer.launch({
      executablePath,
      headless: true,
      args: [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-gpu",
        "--font-render-hinting=none",
      ],
    });

    try {
      const page = await browser.newPage();
      await page.setViewport({ width: 1920, height: 1080, deviceScaleFactor: 1 });
      await page.setContent(html, { waitUntil: "domcontentloaded" });

      const screenshotBuf = await page.screenshot({ type: "png", fullPage: false });
      const imageData = screenshotBuf.toString("base64");

      const imagePayload = { mimeType: "image/png", data: imageData };

      // Save to DB
      await prisma.session.update({
        where: { id: sessionId },
        data: { slideImage: JSON.stringify(imagePayload) },
      });

      console.log(`[Slide] Screenshot captured for session ${sessionId}`);
      return Response.json({
        success: true,
        image: imagePayload,
        sessionTitle: session.title,
        eventName,
      });
    } finally {
      await browser.close();
    }
  } catch (error) {
    console.error("[/api/session/slide] Error:", error);
    return Response.json({ error: "Internal Server Error", message: error.message }, { status: 500 });
  }
}
