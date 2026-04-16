# Branding Tweaks, Session Page Redesign, and Brevo Email Integration Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update Google Doc/Slide branding, redesign the session page to a balanced 3-column layout, and add a Brevo email broadcast button per event.

**Architecture:** Branding changes are targeted string edits in two files. The session page gains a third CSS grid column, redistributing existing cards. Brevo integration adds three DB fields to Event, a new API route that dynamically builds an HTML email and fires a Brevo campaign, a new client button component, and a new section in Edit Event form.

**Tech Stack:** Next.js 16 App Router, Prisma 7, Brevo REST API v3 (via native `fetch`), no new npm packages.

---

## File Map

| File | Role |
|------|------|
| `prisma/schema.prisma` | Add `brevoApiKey`, `brevoSenderEmail`, `brevoListId` to Event |
| `src/lib/googleDrive.js` | Change headerText → newline only; expand footerText |
| `src/app/api/session/slide/route.js` | Extend footer span text |
| `src/components/EventEditForm.js` | Add Brevo card with 3 fields |
| `src/app/events/[id]/edit/page.js` | Pass 3 Brevo fields in serialized object |
| `src/app/api/event/update/route.js` | Handle 3 new Brevo fields |
| `src/app/api/session/broadcast-brevo/route.js` | NEW — build HTML email, create + send Brevo campaign |
| `src/components/BroadcastBrevoButton.js` | NEW — client button component |
| `src/app/session/[id]/page.js` | 3-column grid, card redistribution, Brevo button |

---

## Task 1: DB Schema — Add Brevo Fields

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add three nullable fields to the Event model**

Open `prisma/schema.prisma`. The Event model currently ends with `broadcastTag`. Add the three new fields after it:

```prisma
model Event {
  id               String    @id @default(uuid())
  name             String
  date             DateTime  @default(now())
  driveFolderId    String
  whatsappApiKey   String
  whatsappNumber   String
  campaignName     String?
  logoUrl          String?
  logo2Url         String?
  aiSensyProjectId String?
  aiSensyToken     String?
  broadcastFilter  String    @default("no_tags")
  broadcastTag     String?
  brevoApiKey      String?   // Brevo API key for email campaigns
  brevoSenderEmail String?   // Verified sender email in Brevo account
  brevoListId      String?   // Brevo contact list ID (parsed to int on use)
  sessions         Session[] @relation("EventSessions")
}
```

- [ ] **Step 2: Push schema to database**

```bash
DATABASE_URL="postgresql://postgres:pgsql123@localhost:5432/live_transcript" npx prisma db push
```

Expected output: `Your database is now in sync with your Prisma schema.`

- [ ] **Step 3: Verify columns exist**

```bash
DATABASE_URL="postgresql://postgres:pgsql123@localhost:5432/live_transcript" npx prisma studio
```

Open the Event table and confirm `brevoApiKey`, `brevoSenderEmail`, `brevoListId` columns are present (all nullable, no value).

- [ ] **Step 4: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat: add brevoApiKey, brevoSenderEmail, brevoListId to Event model"
```

---

## Task 2: Google Doc Header and Footer Branding

**Files:**
- Modify: `src/lib/googleDrive.js` (lines 117–118)

- [ ] **Step 1: Update headerText and footerText in `createBrandedDoc`**

Find lines 117–118 in `src/lib/googleDrive.js`:

```js
  const headerText = `${displayEvent}\n`;
  const footerText = `This transcript and summary was generated using AI. AI can make mistakes.  |  ${displayEvent}\n`;
```

Replace with:

```js
  const headerText = "\n";
  const footerText = `This transcript and summary was generated using AI. AI can make mistakes.  |  ${displayEvent}  |  SesScribe — An InsideOut Event Product  |  Confidential\n`;
```

- [ ] **Step 2: Fix logo2 insertion index**

The logo2 insertion at line 172 uses `headerText.length` as the index. With `headerText = "\n"` (length = 1), logo2 goes at index 1 — immediately before the newline and after logo1. This is correct: both logos will appear in the header. No code change needed here.

Verify line 172 reads:
```js
            location: { segmentId: headerId, index: headerText.length },
```
If it does, no change needed.

- [ ] **Step 3: Update hLen calculation**

Line 131 computes `hLen`:
```js
  const hLen = headerText.length - 1;
```

With `headerText = "\n"`, `hLen` = 0. This means the header text style range is `(0, 0)` — an empty range. The formatting call is harmless (it formats zero characters). No code change needed; the logo images carry their own formatting.

- [ ] **Step 4: Verify manually**

Start dev server: `npm run dev`

Open any session with an event that has a Google Drive folder. Click "Export to Google Docs". Open the Summary doc. Confirm:
- Header contains only the logo image(s), no event name text
- Footer reads: `This transcript and summary was generated using AI. AI can make mistakes.  |  <EventName>  |  SesScribe — An InsideOut Event Product  |  Confidential`

- [ ] **Step 5: Commit**

```bash
git add src/lib/googleDrive.js
git commit -m "feat: logos-only doc header, expanded footer with tagline + confidential"
```

---

## Task 3: Slide Footer Text

**Files:**
- Modify: `src/app/api/session/slide/route.js` (line 259)

- [ ] **Step 1: Update the footer span**

Find line 259 in `src/app/api/session/slide/route.js`:

```js
    <span class="footer-text">Powered by SesScribe — An InsideOut Event Product</span>
```

Replace with:

```js
    <span class="footer-text">Powered by SesScribe — An InsideOut Event Product  |  This transcript and summary was generated using AI. AI can make mistakes.</span>
```

- [ ] **Step 2: Verify manually**

On any session page, click "Generate Slide" (or "Regenerate"). Once generated, view the slide image. Confirm the footer reads the full combined text.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/session/slide/route.js
git commit -m "feat: add AI disclaimer to slide footer"
```

---

## Task 4: Edit Event Form — Brevo Settings

**Files:**
- Modify: `src/components/EventEditForm.js`
- Modify: `src/app/events/[id]/edit/page.js`
- Modify: `src/app/api/event/update/route.js`

- [ ] **Step 1: Add Brevo state variables to `EventEditForm.js`**

In `src/components/EventEditForm.js`, find the line:
```js
  const [saving, setSaving] = useState(false);
```

Insert the three new state vars above it:

```js
  const [brevoApiKey, setBrevoApiKey] = useState(event.brevoApiKey || "");
  const [brevoSenderEmail, setBrevoSenderEmail] = useState(event.brevoSenderEmail || "");
  const [brevoListId, setBrevoListId] = useState(event.brevoListId || "");
  const [saving, setSaving] = useState(false);
```

- [ ] **Step 2: Add Brevo fields to the fetch body in `handleSubmit`**

Find the `body: JSON.stringify({` block in `handleSubmit`. Add the three fields after `broadcastTag`:

```js
        body: JSON.stringify({
          id: event.id,
          name,
          driveFolderId: folderId,
          whatsappApiKey: whatsappKey,
          whatsappNumber,
          campaignName,
          logoUrl,
          logo2Url,
          aiSensyProjectId,
          aiSensyToken,
          broadcastFilter,
          broadcastTag,
          brevoApiKey,
          brevoSenderEmail,
          brevoListId,
        }),
```

- [ ] **Step 3: Add the Brevo card to the form JSX**

In `src/components/EventEditForm.js`, find the closing `</div>` of the "Broadcast Audience Filter" card (around line 282). Add the new Brevo card after it, before the save/cancel buttons div:

```jsx
      {/* Brevo Email */}
      <div className="card" style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
        <h2 style={{ fontSize: "1rem", fontWeight: 700, color: "var(--fg-2)", marginBottom: "0.25rem" }}>Brevo Email</h2>
        <p style={{ fontSize: "0.82rem", color: "var(--fg-3)", marginTop: "-0.5rem" }}>
          Used to send session summaries to your Brevo contact list.
        </p>

        <div>
          <label className="field-label">Brevo API Key</label>
          <input
            type="password"
            className="field-input"
            placeholder="Your Brevo v3 API key"
            value={brevoApiKey}
            onChange={(e) => setBrevoApiKey(e.target.value)}
            style={{ fontSize: "1rem", padding: "0.9rem 1.1rem" }}
          />
        </div>

        <div>
          <label className="field-label">Sender Email</label>
          <input
            type="email"
            className="field-input"
            placeholder="sender@yourdomain.com"
            value={brevoSenderEmail}
            onChange={(e) => setBrevoSenderEmail(e.target.value)}
            style={{ fontSize: "1rem", padding: "0.9rem 1.1rem" }}
          />
          <p style={{ fontSize: "0.78rem", color: "var(--fg-3)", marginTop: "0.35rem" }}>
            Must be a verified sender in your Brevo account.
          </p>
        </div>

        <div>
          <label className="field-label">Contact List ID</label>
          <input
            className="field-input"
            placeholder="e.g. 42 — find this in your Brevo Contacts → Lists"
            value={brevoListId}
            onChange={(e) => setBrevoListId(e.target.value)}
            style={{ fontSize: "1rem", padding: "0.9rem 1.1rem" }}
          />
        </div>
      </div>
```

- [ ] **Step 4: Pass Brevo fields in `src/app/events/[id]/edit/page.js`**

Find the `serialized` object in `src/app/events/[id]/edit/page.js`. Add three fields after `broadcastTag`:

```js
  const serialized = {
    id: event.id,
    name: event.name,
    driveFolderId: event.driveFolderId,
    whatsappApiKey: event.whatsappApiKey,
    whatsappNumber: event.whatsappNumber,
    campaignName: event.campaignName,
    logoUrl: event.logoUrl,
    logo2Url: event.logo2Url,
    aiSensyProjectId: event.aiSensyProjectId,
    aiSensyToken: event.aiSensyToken,
    broadcastFilter: event.broadcastFilter,
    broadcastTag: event.broadcastTag,
    brevoApiKey: event.brevoApiKey,
    brevoSenderEmail: event.brevoSenderEmail,
    brevoListId: event.brevoListId,
  };
```

- [ ] **Step 5: Handle Brevo fields in `src/app/api/event/update/route.js`**

Find the end of the `data` assignment block (after `broadcastTag` line). Add:

```js
    if (body.brevoApiKey !== undefined)      data.brevoApiKey = body.brevoApiKey || null;
    if (body.brevoSenderEmail !== undefined)  data.brevoSenderEmail = body.brevoSenderEmail || null;
    if (body.brevoListId !== undefined)       data.brevoListId = body.brevoListId || null;
```

- [ ] **Step 6: Verify manually**

Start dev server. Navigate to an event's edit page (`/events/<id>/edit`). Confirm the "Brevo Email" card appears at the bottom. Fill in a dummy API key, email, and list ID. Click Save. Run:

```bash
DATABASE_URL="postgresql://postgres:pgsql123@localhost:5432/live_transcript" npx prisma studio
```

Open the Event table and confirm the three Brevo fields are saved.

- [ ] **Step 7: Commit**

```bash
git add src/components/EventEditForm.js src/app/events/[id]/edit/page.js src/app/api/event/update/route.js
git commit -m "feat: add Brevo settings (API key, sender email, list ID) to Edit Event form"
```

---

## Task 5: Brevo Broadcast API Route

**Files:**
- Create: `src/app/api/session/broadcast-brevo/route.js`

- [ ] **Step 1: Create the route file**

Create `src/app/api/session/broadcast-brevo/route.js` with the following content:

```js
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
```

- [ ] **Step 2: Verify the route is reachable**

Start dev server: `npm run dev`

Run a quick curl to confirm the route responds (expect a JSON error about missing sessionId, not a 404):

```bash
curl -X POST http://localhost:3000/api/session/broadcast-brevo \
  -H "Content-Type: application/json" \
  -d '{}'
```

Expected: `{"error":"sessionId is required"}`

- [ ] **Step 3: Commit**

```bash
git add src/app/api/session/broadcast-brevo/route.js
git commit -m "feat: add Brevo email broadcast API route with dynamic HTML email"
```

---

## Task 6: BroadcastBrevoButton Component

**Files:**
- Create: `src/components/BroadcastBrevoButton.js`

- [ ] **Step 1: Create the component**

Create `src/components/BroadcastBrevoButton.js`:

```js
"use client";

import { useState } from "react";

export default function BroadcastBrevoButton({ sessionId, disabled }) {
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState(null);

  async function handleSend() {
    if (!confirm("Send this session summary to your Brevo email list? This will create and send a campaign immediately.")) return;

    setLoading(true);
    setError(null);
    setSent(false);
    try {
      const res = await fetch("/api/session/broadcast-brevo", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ sessionId }),
      });
      const data = await res.json();
      if (!data.success) throw new Error(data.error || "Unknown error");
      setSent(true);
      setTimeout(() => setSent(false), 3000);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <button
        onClick={handleSend}
        disabled={disabled || loading}
        style={{
          marginTop: "0.75rem",
          display: "inline-flex",
          alignItems: "center",
          justifyContent: "center",
          gap: "0.5rem",
          padding: "0.85rem 1rem",
          background: disabled
            ? "rgba(255,255,255,0.05)"
            : sent
              ? "linear-gradient(135deg, #10b981, #059669)"
              : "linear-gradient(135deg, #3b82f6, #6366f1)",
          border: "none",
          borderRadius: "8px",
          color: disabled ? "rgba(255,255,255,0.3)" : "#fff",
          fontSize: "0.9rem",
          fontWeight: "600",
          cursor: disabled || loading ? "not-allowed" : "pointer",
          transition: "all 0.2s",
          boxShadow: disabled ? "none" : sent ? "0 4px 15px rgba(16,185,129,0.4)" : "0 4px 15px rgba(59,130,246,0.4)",
          width: "100%",
        }}
      >
        {loading ? (
          <span style={{ display: "flex", gap: "0.4rem", alignItems: "center" }}>
            <div className="spinner" style={{ width: "14px", height: "14px", borderWidth: "2px", borderTopColor: "#fff" }} />
            Sending…
          </span>
        ) : sent ? (
          "✓ Sent!"
        ) : (
          <>
            <span>📧</span> Send Email Broadcast
          </>
        )}
      </button>

      {disabled && (
        <p style={{ fontSize: "0.75rem", color: "var(--fg-3)", marginTop: "0.4rem" }}>
          Requires: Event linked + Brevo API key + sender email + list ID configured
        </p>
      )}

      {error && (
        <div style={{
          marginTop: "0.75rem",
          padding: "0.75rem 1rem",
          background: "rgba(239,68,68,0.1)",
          border: "1px solid rgba(239,68,68,0.25)",
          borderRadius: "8px",
          fontSize: "0.82rem",
          color: "#f87171",
        }}>
          {error}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/BroadcastBrevoButton.js
git commit -m "feat: add BroadcastBrevoButton client component"
```

---

## Task 7: Session Page — Three Columns and Brevo Button

**Files:**
- Modify: `src/app/session/[id]/page.js`

- [ ] **Step 1: Add BroadcastBrevoButton import**

At the top of `src/app/session/[id]/page.js`, after the last import:

```js
import BroadcastBrevoButton from "@/components/BroadcastBrevoButton";
```

- [ ] **Step 2: Update the CSS grid from 2-column to 3-column**

Find the `.results-grid` CSS rule in the `<style>` block:

```css
        .results-grid {
          display: grid;
          grid-template-columns: minmax(350px, 1.2fr) 2fr;
          gap: 1.5rem;
          align-items: start;
        }
        @media (max-width: 900px) {
          .results-grid { grid-template-columns: 1fr; }
        }
```

Replace with:

```css
        .results-grid {
          display: grid;
          grid-template-columns: 0.7fr 1.1fr 1.5fr;
          gap: 1.5rem;
          align-items: start;
        }
        @media (max-width: 1200px) {
          .results-grid { grid-template-columns: 1fr 1.8fr; }
          .results-grid > :first-child { grid-column: 1; }
          .results-grid > :nth-child(2) { grid-column: 1; }
          .results-grid > :nth-child(3) { grid-column: 2; grid-row: 1 / span 2; }
        }
        @media (max-width: 900px) {
          .results-grid { grid-template-columns: 1fr; }
          .results-grid > * { grid-column: 1 !important; grid-row: auto !important; }
        }
```

- [ ] **Step 3: Reorganize the main grid into three columns**

Find the `{/* Main grid */}` div (around line 366) and replace the entire inner structure with the three-column layout:

```jsx
          {/* Main grid */}
          <div className="results-grid" style={{ animation: "fadeUp 0.5s ease-out 0.15s both" }}>

            {/* ── Left column — Actions ───────────────────────────────────── */}
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

              {/* Sharing & Groups */}
              <div className="card" style={{ borderTop: "3px solid var(--primary)", display: "flex", flexDirection: "column", gap: "1rem" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "0.5rem" }}>
                  <div style={{ width: "30px", height: "30px", borderRadius: "8px", background: "rgba(59,130,246,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.9rem" }}>⚙️</div>
                  <h2 style={{ fontSize: "1rem", fontWeight: "700" }}>Sharing & Groups</h2>
                </div>
                <EventSelector sessionId={session.id} currentEventId={session.eventId} events={events} />
                <BroadcastAiSensyButton sessionId={session.id} disabled={!session.eventId || !session.event?.whatsappApiKey} />
                <BroadcastBrevoButton sessionId={session.id} disabled={!session.eventId || !session.event?.brevoApiKey || !session.event?.brevoSenderEmail || !session.event?.brevoListId} />
              </div>

              {/* Recording */}
              {session.audioFileId && (
                <div className="audio-card">
                  <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                    <div style={{ width: "30px", height: "30px", borderRadius: "8px", background: "rgba(16,185,129,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.9rem" }}>🎙</div>
                    <h2 style={{ fontSize: "1rem", fontWeight: "700" }}>Session Recording</h2>
                  </div>
                  <audio className="audio-player" controls preload="metadata" src={`/api/session/audio?sessionId=${session.id}`} />
                  <a className="audio-download-btn" href={`/api/session/audio/download?sessionId=${session.id}`} download>
                    ⬇ Download as MP3
                  </a>
                  <p style={{ fontSize: "0.75rem", color: "var(--fg-3)", margin: 0 }}>
                    Audio recorded during this session. Download converts to MP3 — may take a moment for long recordings.
                  </p>
                </div>
              )}

              {/* Speakers */}
              {speakerSet.length > 0 && (
                <div className="card">
                  <h2 style={{ fontSize: "0.85rem", fontWeight: "700", color: "var(--fg-2)", marginBottom: "0.75rem", textTransform: "uppercase", letterSpacing: "0.06em" }}>
                    Speakers Detected
                  </h2>
                  <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
                    {speakerSet.map((sp) => {
                      const col = speakerMap.get(sp);
                      return (
                        <div key={sp} style={{ display: "flex", alignItems: "center", gap: "0.7rem" }}>
                          <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: col.dot, flexShrink: 0 }} />
                          <span style={{ fontSize: "0.88rem", color: "var(--fg-2)", fontWeight: "500" }}>{sp}</span>
                          <span style={{ marginLeft: "auto", fontSize: "0.78rem", color: "var(--fg-3)" }}>
                            {primaryTranscript.filter((s) => s.speaker === sp).length} segments
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* ── Center column — Summary and Highlights ───────────────────── */}
            <div style={{ display: "flex", flexDirection: "column", gap: "1.5rem" }}>

              {/* AI Summary */}
              <div className="card" style={{ borderTop: "3px solid var(--primary)", display: "flex", flexDirection: "column" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "1rem" }}>
                  <div style={{ width: "30px", height: "30px", borderRadius: "8px", background: "rgba(139,92,246,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.9rem" }}>✨</div>
                  <h2 style={{ fontSize: "1rem", fontWeight: "700" }}>AI Summary</h2>
                </div>
                <div style={{ maxHeight: "400px", overflowY: "auto", paddingRight: "0.25rem" }}>
                  <p className="prose" style={{ whiteSpace: "pre-wrap", margin: 0 }}>
                    {displaySummary}
                  </p>
                </div>
              </div>

              {/* Key Highlights */}
              <div className="card" style={{ borderTop: "3px solid var(--pink)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "0.6rem", marginBottom: "1rem" }}>
                  <div style={{ width: "30px", height: "30px", borderRadius: "8px", background: "rgba(217,70,239,0.12)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.9rem" }}>💡</div>
                  <h2 style={{ fontSize: "1rem", fontWeight: "700" }}>Key Highlights</h2>
                  {actionPoints.length > 0 && (
                    <span style={{ marginLeft: "auto", background: "rgba(217,70,239,0.12)", color: "#e879f9", border: "1px solid rgba(217,70,239,0.25)", borderRadius: "99px", fontSize: "0.72rem", fontWeight: "600", padding: "0.15rem 0.6rem" }}>
                      {actionPoints.length}
                    </span>
                  )}
                </div>

                <HighlightsSlideButton
                  sessionId={session.id}
                  actionPoints={actionPoints}
                  existingSlide={session.slideImage ? JSON.parse(session.slideImage) : null}
                />

                <div style={{ maxHeight: "350px", overflowY: "auto", paddingRight: "0.25rem", marginTop: "0.75rem" }}>
                  {actionPoints.length === 0 ? (
                    <p style={{ color: "var(--fg-3)", fontSize: "0.88rem" }}>No highlights generated.</p>
                  ) : (
                    <div>
                      {actionPoints.map((ap, i) => (
                        <div key={i} className="action-item">
                          <div className="action-check">
                            <span style={{ fontSize: "0.6rem", color: "var(--primary-2)" }}>✓</span>
                          </div>
                          <p style={{ fontSize: "0.9rem", color: "var(--fg-2)", lineHeight: 1.6 }}>{ap}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* ── Right column — Transcript ────────────────────────────────── */}
            <div className="card" style={{ padding: 0, overflow: "hidden" }}>
              {/* Card header */}
              <div style={{ padding: "1.2rem 1.75rem", borderBottom: "1px solid var(--border)", background: "var(--surface-2)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <div>
                  <h2 style={{ fontSize: "1rem", fontWeight: "700" }}>
                    {batchTranscript ? "Final Transcript (Batch AI)" : "Full Transcript"}
                  </h2>
                  {batchTranscript && (
                    <div style={{ fontSize: "0.75rem", color: "#34d399", marginTop: "0.2rem", fontWeight: 600 }}>
                      ✓ High Precision Audio Pass
                    </div>
                  )}
                </div>
                <span style={{ fontSize: "0.78rem", color: "var(--fg-3)" }}>
                  {primaryTranscript.length} segment{primaryTranscript.length !== 1 ? "s" : ""}
                </span>
              </div>

              {/* Transcript body */}
              <div className="transcript-scroll" style={{ padding: "1.25rem 1.75rem" }}>
                {primaryTranscript.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "3rem 1rem", color: "var(--fg-3)" }}>
                    <div style={{ fontSize: "2rem", marginBottom: "0.75rem", opacity: 0.3 }}>📄</div>
                    <p style={{ fontSize: "0.9rem" }}>No transcript recorded.</p>
                  </div>
                ) : (
                  primaryTranscript.map((seg, idx) => {
                    const col = getSpeakerColor(seg.speaker, speakerMap);
                    return (
                      <div key={idx} className="seg-row" style={{ animationDelay: `${idx * 0.02}s` }}>
                        <div className="seg-avatar" style={{ background: col.bg, border: `1px solid ${col.border}`, color: col.text }}>
                          {(seg.speaker || "?")[0].toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                            <span style={{ fontSize: "0.85rem", fontWeight: "700", color: col.text }}>{seg.speaker || "Unknown"}</span>
                            {seg.start != null && (
                              <span style={{ fontSize: "0.7rem", color: "var(--fg-3)", background: "rgba(255,255,255,0.05)", padding: "0.15rem 0.45rem", borderRadius: "4px", fontVariantNumeric: "tabular-nums", fontFamily: "monospace" }}>
                                {formatTime(seg.start)}
                              </span>
                            )}
                          </div>
                          <div className="seg-bubble" style={{ background: `linear-gradient(to right, ${col.bg.replace("0.1", "0.03")}, transparent)` }}>
                            <p style={{ fontSize: "0.92rem", color: "var(--fg)", lineHeight: 1.6, margin: 0 }}>{seg.text}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>

            {/* Live transcript fallback — spans columns 2-3 on wide screens */}
            {batchTranscript && liveTranscript.length > 0 && (
              <details className="fallback-transcript" style={{ gridColumn: "2 / -1" }}>
                <summary>
                  <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                    <span>Original Live Transcript (Fallback)</span>
                    <span style={{ fontSize: "0.7rem", background: "rgba(255,255,255,0.1)", padding: "3px 8px", borderRadius: "99px" }}>
                      {liveTranscript.length} segments
                    </span>
                  </div>
                </summary>
                <div className="transcript-scroll" style={{ padding: "1.25rem 1.75rem", borderTop: "1px solid var(--border)", maxHeight: "400px" }}>
                  {liveTranscript.map((seg, idx) => {
                    const col = getSpeakerColor(seg.speaker, speakerMap);
                    return (
                      <div key={`live-${idx}`} className="seg-row" style={{ opacity: 0.85 }}>
                        <div className="seg-avatar" style={{ background: col.bg, border: `1px solid ${col.border}`, color: col.text }}>
                          {(seg.speaker || "?")[0].toUpperCase()}
                        </div>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
                            <span style={{ fontSize: "0.85rem", fontWeight: "700", color: col.text }}>{seg.speaker || "Unknown"}</span>
                            {seg.start != null && (
                              <span style={{ fontSize: "0.7rem", color: "var(--fg-3)", background: "rgba(255,255,255,0.05)", padding: "0.15rem 0.45rem", borderRadius: "4px", fontVariantNumeric: "tabular-nums", fontFamily: "monospace" }}>
                                {formatTime(seg.start)}
                              </span>
                            )}
                          </div>
                          <div className="seg-bubble" style={{ background: `linear-gradient(to right, ${col.bg.replace("0.1", "0.03")}, transparent)` }}>
                            <p style={{ fontSize: "0.92rem", color: "var(--fg)", lineHeight: 1.6, margin: 0 }}>{seg.text}</p>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </details>
            )}

          </div>
```

- [ ] **Step 4: Verify manually**

Start dev server: `npm run dev`

Load any session page (`/session/<id>`). Confirm:
- Three columns appear: left (Sharing/Recording/Speakers), center (Summary/Highlights), right (Transcript)
- Summary and Highlights both have their own scrollable max-height
- "Send Email Broadcast" button appears in Sharing & Groups (disabled if no Brevo config)
- At viewport < 900px, collapses to single column

- [ ] **Step 5: Commit**

```bash
git add src/app/session/[id]/page.js
git commit -m "feat: three-column session page layout with Brevo broadcast button"
```

---

## Task 8: Deploy to Production

- [ ] **Step 1: Push to remote**

```bash
git push origin main
```

- [ ] **Step 2: Pull and rebuild on server**

SSH to the server and run:

```bash
cd /path/to/app
git pull
docker compose build app
docker compose up -d app
```

- [ ] **Step 3: Run DB migration on production**

```bash
docker exec sesscribe-app npx prisma db push
```

Expected: `Your database is now in sync with your Prisma schema.`

- [ ] **Step 4: Verify production**

- Open a session page and check the three-column layout
- Open an event edit page and confirm the Brevo settings card is present
- Export a Google Doc and confirm logos-only header + expanded footer
- Generate a slide and confirm the footer includes the AI disclaimer
