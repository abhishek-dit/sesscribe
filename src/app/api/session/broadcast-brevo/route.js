import prisma from "@/lib/prisma";

// Extract Google Doc URLs from session summary (same logic as session page)
function extractDocUrls(summary = "") {
  let summaryUrl = null;

  // Two-doc format: [📝 Summary: <url>]\n[📄 Transcript: <url>]
  const twoDocMatch = summary.match(/\[📝 Summary: (https?:\/\/[^\]]+)\]/);
  if (twoDocMatch) {
    summaryUrl = twoDocMatch[1];
    return { summaryUrl };
  }

  // Legacy single-doc format
  const legacyMatch = summary.match(/\[📝 Google Doc Created: (https?:\/\/[^\]]+)\]/);
  if (legacyMatch) {
    summaryUrl = legacyMatch[1];
  }

  return { summaryUrl };
}

// Parse action points (same logic as session page)
function parseActionPoints(raw = "") {
  if (!raw) return [];
  return raw
    .split("\n")
    .map((l) => l.replace(/^[-•*]\s*/, "").trim())
    .filter(Boolean);
}

// Build the email HTML dynamically per session
function buildEmailHtml({ sessionTitle, sessionDate, eventName, summaryUrl, actionPoints }) {
  const highlightItems = actionPoints
    .map((ap) => `<li style="margin-bottom:10px;color:#334155;font-size:15px;line-height:1.6;">${ap}</li>`)
    .join("\n        ");

  const summaryButton = summaryUrl
    ? `<div style="text-align:center;margin:28px 0;">
        <a href="${summaryUrl}"
           style="display:inline-block;background:#CC0000;color:#ffffff;text-decoration:none;
                  padding:14px 32px;border-radius:6px;font-weight:700;font-size:15px;
                  font-family:Arial,Helvetica,sans-serif;">
          📝 View Session Summary
        </a>
      </div>`
    : "";

  const highlightsSection = actionPoints.length > 0
    ? `<h3 style="margin:32px 0 14px;color:#1e293b;font-size:16px;font-weight:700;
                  border-bottom:2px solid #f1f5f9;padding-bottom:10px;
                  font-family:Arial,Helvetica,sans-serif;">
         Key Highlights
       </h3>
       <ul style="margin:0;padding-left:22px;">
         ${highlightItems}
       </ul>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${sessionTitle}</title>
</head>
<body style="margin:0;padding:0;background:#f8fafc;font-family:Arial,Helvetica,sans-serif;">
  <div style="max-width:600px;margin:0 auto;background:#ffffff;border-radius:8px;overflow:hidden;margin-top:24px;margin-bottom:24px;">

    <!-- Header bar -->
    <div style="background:#CC0000;padding:24px 32px;">
      <p style="margin:0;color:rgba(255,255,255,0.8);font-size:13px;text-transform:uppercase;letter-spacing:0.06em;">${eventName}</p>
      <h1 style="margin:6px 0 0;color:#ffffff;font-size:22px;font-weight:700;line-height:1.3;">${sessionTitle}</h1>
    </div>

    <!-- Body -->
    <div style="padding:32px;">
      <p style="margin:0 0 4px;color:#64748b;font-size:13px;">${sessionDate}</p>

      ${summaryButton}
      ${highlightsSection}
    </div>

    <!-- Footer -->
    <div style="background:#f1f5f9;padding:20px 32px;text-align:center;border-top:1px solid #e2e8f0;">
      <p style="margin:0;color:#94a3b8;font-size:12px;font-family:Arial,Helvetica,sans-serif;">
        SesScribe — An InsideOut Event Product
      </p>
      <p style="margin:6px 0 0;color:#94a3b8;font-size:11px;font-family:Arial,Helvetica,sans-serif;">
        This transcript and summary was generated using AI. AI can make mistakes.
      </p>
    </div>

  </div>
</body>
</html>`;
}

export async function POST(request) {
  try {
    const { sessionId } = await request.json();
    if (!sessionId) {
      return Response.json({ error: "sessionId is required" }, { status: 400 });
    }

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { event: true },
    });
    if (!session) {
      return Response.json({ error: "Session not found" }, { status: 404 });
    }

    const event = session.event;
    if (!event?.brevoApiKey || !event?.brevoSenderEmail || !event?.brevoListId) {
      return Response.json(
        { error: "Event must have Brevo API key, sender email, and list ID configured" },
        { status: 400 }
      );
    }

    // Extract data
    const { summaryUrl } = extractDocUrls(session.summary || "");
    const actionPoints = parseActionPoints(session.actionPoints || "");
    const sessionDate = new Date(session.date).toLocaleDateString("en-IN", {
      weekday: "long", year: "numeric", month: "long", day: "numeric",
    });

    // Build dynamic HTML email
    const htmlContent = buildEmailHtml({
      sessionTitle: session.title,
      sessionDate,
      eventName: event.name,
      summaryUrl,
      actionPoints,
    });

    const campaignName = `${session.title} — ${new Date().toLocaleDateString("en-IN")}`;
    const listId = parseInt(event.brevoListId, 10);
    if (isNaN(listId)) {
      return Response.json({ error: "brevoListId must be a valid integer" }, { status: 400 });
    }

    // Step 1: Create email campaign
    const createRes = await fetch("https://api.brevo.com/v3/emailCampaigns", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "api-key": event.brevoApiKey,
      },
      body: JSON.stringify({
        name: campaignName,
        subject: session.title,
        sender: { name: event.name, email: event.brevoSenderEmail },
        recipients: { listIds: [listId] },
        htmlContent,
      }),
    });

    if (!createRes.ok) {
      const errBody = await createRes.text();
      console.error("[broadcast-brevo] Campaign create failed:", errBody);
      return Response.json(
        { error: `Brevo campaign creation failed: ${createRes.status} — ${errBody}` },
        { status: 502 }
      );
    }

    const { id: campaignId } = await createRes.json();

    // Step 2: Send campaign immediately
    const sendRes = await fetch(`https://api.brevo.com/v3/emailCampaigns/${campaignId}/sendNow`, {
      method: "POST",
      headers: { "api-key": event.brevoApiKey },
    });

    if (!sendRes.ok) {
      const errBody = await sendRes.text();
      console.error("[broadcast-brevo] Campaign send failed:", errBody);
      return Response.json(
        { error: `Brevo campaign send failed: ${sendRes.status} — ${errBody}` },
        { status: 502 }
      );
    }

    console.log(`[broadcast-brevo] Campaign ${campaignId} sent for session ${sessionId}`);
    return Response.json({ success: true, campaignId });
  } catch (err) {
    console.error("[broadcast-brevo] Unexpected error:", err.message);
    return Response.json({ error: err.message }, { status: 500 });
  }
}
