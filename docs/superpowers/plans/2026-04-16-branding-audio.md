# Branding Updates, Second Logo & Audio Backup — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove SesScribe tagline lines from Google Docs and slides, add AI disclaimer to doc footer, make logo bigger, support a second logo on the right side, and save session audio recordings to Google Drive with playback and MP3 download on the session page.

**Architecture:** Prisma schema gets two new nullable columns. `googleDrive.js` gains `uploadAudioToDrive` and `getDriveClient` exports alongside the branding changes. Two new Next.js API routes handle audio streaming and MP3 conversion via ffmpeg. The live session upload route runs Drive upload in parallel with Deepgram.

**Tech Stack:** Next.js 16 App Router, Prisma 7 (PostgreSQL), googleapis, child_process (ffmpeg), puppeteer-core (slide screenshots).

---

## File Map

| File | Action |
|------|--------|
| `prisma/schema.prisma` | Add `logo2Url` to Event, `audioFileId` to Session |
| `src/app/api/event/update/route.js` | Handle `logo2Url` |
| `src/components/EventEditForm.js` | Add second logo URL field + preview |
| `src/app/events/[id]/edit/page.js` | Pass `logo2Url` in serialized event |
| `src/lib/googleDrive.js` | Bigger logo, remove tagline, AI footer, second logo right, export `uploadAudioToDrive` + `getDriveClient` |
| `src/app/api/session/export/route.js` | Pass `logo2Url` to `createMeetingDoc` |
| `src/app/api/session/slide/route.js` | Remove brand-tag, add second logo right |
| `src/app/api/session/upload-audio/route.js` | Read audio into buffer, upload to Drive in parallel with Deepgram, save `audioFileId` |
| `src/app/api/session/audio/route.js` | **NEW** — stream WebM from Drive for browser playback |
| `src/app/api/session/audio/download/route.js` | **NEW** — fetch WebM from Drive, convert via ffmpeg, stream MP3 |
| `src/app/session/[id]/page.js` | Add Recording card with player + MP3 download |
| `Dockerfile` | Add `ffmpeg` to runner `apk add` |

---

## Task 1: Schema Migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add columns to schema**

Open `prisma/schema.prisma`. In the `Event` model, add after the `logoUrl` line:
```prisma
logo2Url         String?   // Second logo URL — right side of Google Docs header and slide
```

In the `Session` model, add after the `slideImage` line:
```prisma
audioFileId      String?   // Google Drive file ID for the recorded WebM audio
```

The full updated models:
```prisma
model Session {
  id           String            @id @default(uuid())
  title        String
  date         DateTime          @default(now())
  transcript   String?
  summary      String?
  actionPoints String?
  slideImage   String?
  audioFileId  String?
  attendees    SessionAttendee[]
  event        Event?            @relation("EventSessions", fields: [eventId], references: [id])
  eventId      String?
}

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
  sessions         Session[] @relation("EventSessions")
}
```

- [ ] **Step 2: Run migration**

```bash
cd /Users/apple/.gemini/antigravity/scratch/live-transcript-app
npx prisma db push
```

Expected output: `All migrations have been applied.` or `Your database is now in sync with your Prisma schema.`

- [ ] **Step 3: Commit**

```bash
git add prisma/schema.prisma
git commit -m "schema: add logo2Url to Event, audioFileId to Session"
```

---

## Task 2: Event Update API — Second Logo

**Files:**
- Modify: `src/app/api/event/update/route.js`

- [ ] **Step 1: Add logo2Url handling**

Open `src/app/api/event/update/route.js`. After the line `if (body.logoUrl !== undefined) data.logoUrl = body.logoUrl || null;`, add:

```js
if (body.logo2Url !== undefined)          data.logo2Url = body.logo2Url || null;
```

Full updated `data`-building block (lines 19–28):
```js
const data = {};
if (body.name !== undefined)             data.name = body.name;
if (body.driveFolderId !== undefined)    data.driveFolderId = body.driveFolderId;
if (body.whatsappApiKey !== undefined)   data.whatsappApiKey = body.whatsappApiKey;
if (body.whatsappNumber !== undefined)   data.whatsappNumber = body.whatsappNumber;
if (body.campaignName !== undefined)     data.campaignName = body.campaignName || null;
if (body.logoUrl !== undefined)          data.logoUrl = body.logoUrl || null;
if (body.logo2Url !== undefined)         data.logo2Url = body.logo2Url || null;
if (body.aiSensyProjectId !== undefined) data.aiSensyProjectId = body.aiSensyProjectId || null;
if (body.aiSensyToken !== undefined)     data.aiSensyToken = body.aiSensyToken || null;
if (body.broadcastFilter !== undefined)  data.broadcastFilter = body.broadcastFilter;
if (body.broadcastTag !== undefined)     data.broadcastTag = body.broadcastTag || null;
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/event/update/route.js
git commit -m "feat: handle logo2Url in event update API"
```

---

## Task 3: Edit Event Form — Second Logo Field

**Files:**
- Modify: `src/app/events/[id]/edit/page.js`
- Modify: `src/components/EventEditForm.js`

- [ ] **Step 1: Pass logo2Url from page to form**

Open `src/app/events/[id]/edit/page.js`. In the `serialized` object (around line 13), add `logo2Url`:

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
};
```

- [ ] **Step 2: Add logo2Url state to EventEditForm**

Open `src/components/EventEditForm.js`. After `const [logoUrl, setLogoUrl] = useState(event.logoUrl || "");` (line 12), add:

```js
const [logo2Url, setLogo2Url] = useState(event.logo2Url || "");
```

- [ ] **Step 3: Include logo2Url in the submit payload**

In the `fetch("/api/event/update", ...)` body (inside `handleSubmit`), add `logo2Url` after `logoUrl`:

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
}),
```

- [ ] **Step 4: Add Second Logo URL field to Branding card**

In `EventEditForm.js`, find the Branding card section (the `<div className="card">` containing the Logo URL field). After the closing `</div>` of the existing logo preview block (around line 121), add the second logo field:

```jsx
<div>
  <label className="field-label">Second Logo URL (right side)</label>
  <input
    className="field-input"
    placeholder="https://example.com/logo2.png — appears on the right side of the header"
    value={logo2Url}
    onChange={(e) => setLogo2Url(e.target.value)}
    style={{ fontSize: "1rem", padding: "0.9rem 1.1rem" }}
  />
  <p style={{ fontSize: "0.78rem", color: "var(--fg-3)", marginTop: "0.35rem" }}>
    Shown on the right side of the Google Docs header and slide header. Leave blank to show only the primary logo.
  </p>
</div>

{logo2Url && (
  <div style={{
    padding: "1rem",
    background: "var(--surface-2)",
    borderRadius: "var(--radius-sm)",
    border: "1px solid var(--border)",
    display: "flex",
    alignItems: "center",
    gap: "1rem",
  }}>
    <img
      src={logo2Url}
      alt="Second logo preview"
      style={{ maxHeight: "48px", maxWidth: "140px", objectFit: "contain", borderRadius: "4px" }}
      onError={(e) => { e.target.style.display = "none"; }}
    />
    <span style={{ fontSize: "0.82rem", color: "var(--fg-3)" }}>Second logo preview</span>
  </div>
)}
```

- [ ] **Step 5: Verify locally**

Start the dev server (`npm run dev`), navigate to an event's edit page, confirm the "Second Logo URL" field and preview appear in the Branding section. Enter a URL, confirm preview loads. Save — confirm no error.

- [ ] **Step 6: Commit**

```bash
git add src/app/events/[id]/edit/page.js src/components/EventEditForm.js
git commit -m "feat: add second logo URL field to Edit Event form"
```

---

## Task 4: Google Docs — Branding Changes + Drive Helpers

**Files:**
- Modify: `src/lib/googleDrive.js`

This task has many changes — do them in one edit pass.

- [ ] **Step 1: Export getDriveClient helper**

After the `getAuth()` function definition (around line 34), add:

```js
export function getDriveClient() {
  const auth = getAuth();
  if (!auth) return null;
  return google.drive({ version: "v3", auth });
}
```

- [ ] **Step 2: Add uploadAudioToDrive export**

After the `getDriveClient` function, add:

```js
export async function uploadAudioToDrive(audioBuffer, filename, folderId) {
  try {
    const auth = getAuth();
    if (!auth) { console.warn("[uploadAudioToDrive] Missing credentials"); return null; }
    const drive = google.drive({ version: "v3", auth });

    const { Readable } = await import("stream");
    const stream = Readable.from(audioBuffer);

    const res = await drive.files.create({
      requestBody: {
        name: filename,
        mimeType: "audio/webm",
        ...(folderId ? { parents: [folderId] } : {}),
      },
      media: { mimeType: "audio/webm", body: stream },
      fields: "id",
    });

    const fileId = res.data.id;

    await drive.permissions.create({
      fileId,
      requestBody: { role: "reader", type: "anyone" },
    });

    console.log(`[uploadAudioToDrive] Uploaded: ${fileId}`);
    return { fileId };
  } catch (err) {
    console.error("[uploadAudioToDrive]", err.message);
    return null;
  }
}
```

- [ ] **Step 3: Update createBrandedDoc — header text, logo size, second logo**

Replace the existing `createBrandedDoc` function body with the version below. Key changes:
- Header text: `"\n${displayEvent}  |  ${BRAND.tagline}\n"` → `"${displayEvent}\n"` (no tagline, no leading newline)
- Footer text: `"${displayEvent}  |  ${BRAND.tagline}  |  Confidential\n"` → `"This transcript and summary was generated using AI. AI can make mistakes.  |  ${displayEvent}\n"`
- Logo size: `40×40 PT` → `72×72 PT`
- Accept `logo2Url` param and insert second logo at end of header text

Updated function signature: `async function createBrandedDoc(docs, drive, { title, displayEvent, displayDate, logoUrl, logo2Url, folderId })`

Full replacement for `createBrandedDoc`:

```js
async function createBrandedDoc(docs, drive, { title, displayEvent, displayDate, logoUrl, logo2Url, folderId }) {
  const doc = await docs.documents.create({ requestBody: { title } });
  const documentId = doc.data.documentId;

  const hfRes = await docs.documents.batchUpdate({
    documentId,
    requestBody: { requests: [{ createHeader: { type: "DEFAULT" } }, { createFooter: { type: "DEFAULT" } }] },
  });
  const headerId = hfRes.data.replies[0].createHeader.headerId;
  const footerId = hfRes.data.replies[1].createFooter.footerId;

  // No tagline in header, no leading newline
  const headerText = `${displayEvent}\n`;
  const footerText = `This transcript and summary was generated using AI. AI can make mistakes.  |  ${displayEvent}\n`;

  // Set margins + insert header/footer text
  await docs.documents.batchUpdate({
    documentId,
    requestBody: {
      requests: [
        { updateDocumentStyle: { documentStyle: { marginTop: { magnitude: 56, unit: "PT" }, marginBottom: { magnitude: 56, unit: "PT" }, marginLeft: { magnitude: 56, unit: "PT" }, marginRight: { magnitude: 56, unit: "PT" } }, fields: "marginTop,marginBottom,marginLeft,marginRight" } },
        { insertText: { location: { segmentId: headerId, index: 0 }, text: headerText } },
        { insertText: { location: { segmentId: footerId, index: 0 }, text: footerText } },
      ],
    },
  });

  // Style header text (chars 0 to headerText.length-2, skipping trailing \n)
  const hLen = headerText.length - 1;
  const headerFmt = [
    mkText(0, hLen, { fontSize: 9, color: BRAND.gray, font: BRAND.font }, headerId),
    mkPara(0, hLen, { spaceAbove: 4, borderBottom: { color: { color: { rgbColor: BRAND.red } }, width: { magnitude: 1.5, unit: "PT" }, padding: { magnitude: 4, unit: "PT" }, dashStyle: "SOLID" } }, headerId),
  ];

  // Style footer text
  const fLen = footerText.length - 1;
  headerFmt.push(mkText(0, fLen, { fontSize: 7.5, color: BRAND.gray, font: BRAND.font }, footerId));
  headerFmt.push(mkPara(0, fLen, { alignment: "CENTER", borderTop: { color: { color: { rgbColor: rgb("#E5E7EB") } }, width: { magnitude: 0.5, unit: "PT" }, padding: { magnitude: 6, unit: "PT" }, dashStyle: "SOLID" } }, footerId));

  await docs.documents.batchUpdate({ documentId, requestBody: { requests: headerFmt } });

  // Insert logo1 at index 0 in header (left side) — 72×72 PT
  try {
    await docs.documents.batchUpdate({
      documentId,
      requestBody: {
        requests: [{
          insertInlineImage: {
            location: { segmentId: headerId, index: 0 },
            uri: logoUrl || BRAND.defaultLogoUrl,
            objectSize: { height: { magnitude: 72, unit: "PT" }, width: { magnitude: 72, unit: "PT" } },
          },
        }],
      },
    });
  } catch (e) {
    console.warn("[GoogleDocs] Logo1 insertion failed:", e.message);
  }

  // Insert logo2 at the end of header text (right side), after logo1 shifts indices by 1
  // After logo1 insert at index 0, the \n is now at index headerText.length.
  // Insert logo2 at headerText.length to place it immediately before the \n.
  if (logo2Url) {
    try {
      await docs.documents.batchUpdate({
        documentId,
        requestBody: {
          requests: [{
            insertInlineImage: {
              location: { segmentId: headerId, index: headerText.length },
              uri: logo2Url,
              objectSize: { height: { magnitude: 72, unit: "PT" }, width: { magnitude: 72, unit: "PT" } },
            },
          }],
        },
      });
    } catch (e) {
      console.warn("[GoogleDocs] Logo2 insertion failed:", e.message);
    }
  }

  // Make viewable by anyone
  try {
    await drive.permissions.create({
      fileId: documentId,
      requestBody: { role: "reader", type: "anyone" },
    });
  } catch (e) { console.warn("[GoogleDocs] Permission set failed:", e.message); }

  // Move to folder
  if (folderId) {
    try {
      const file = await drive.files.get({ fileId: documentId, fields: "parents" });
      const prev = file.data.parents ? file.data.parents.join(",") : "";
      await drive.files.update({ fileId: documentId, addParents: folderId, removeParents: prev, fields: "id, parents" });
    } catch (e) { console.warn("[GoogleDocs] Folder move failed:", e.message); }
  }

  return { documentId, headerId, footerId };
}
```

- [ ] **Step 4: Update buildTitleBlock — remove tagline line**

Replace `buildTitleBlock` with the version below (removes the `BRAND.tagline` line and its border styling):

```js
function buildTitleBlock(sessionTitle, displayEvent, displayDate) {
  const parts = [];
  let cursor = 1;
  function add(text, id) { const s = cursor; parts.push({ id, start: s, end: s + text.length }); cursor += text.length; return text; }

  let body = "";
  body += add(`${sessionTitle}\n`, "title");
  body += add(`${displayEvent}\n`, "event");
  body += add(`${displayDate}\n`, "date");
  body += add("\n", "spacer");
  return { body, parts, cursor };
}

function formatTitleBlock(parts) {
  const p = (id) => parts.find((x) => x.id === id);
  const fmt = [];

  const t = p("title");
  fmt.push(mkText(t.start, t.end - 1, { bold: true, fontSize: 24, color: BRAND.red, font: BRAND.font }));
  fmt.push(mkPara(t.start, t.end - 1, { spaceBelow: 2, lineSpacing: 120 }));

  const ev = p("event");
  fmt.push(mkText(ev.start, ev.end - 1, { bold: true, fontSize: 14, color: BRAND.blue, font: BRAND.font }));
  fmt.push(mkPara(ev.start, ev.end - 1, { spaceBelow: 2 }));

  const dt = p("date");
  // date is the last styled line — add a bottom border to separate title block from body
  fmt.push(mkText(dt.start, dt.end - 1, { fontSize: 10, color: BRAND.gray, font: BRAND.font }));
  fmt.push(mkPara(dt.start, dt.end - 1, { spaceBelow: 14, borderBottom: { color: { color: { rgbColor: BRAND.red } }, width: { magnitude: 2, unit: "PT" }, padding: { magnitude: 10, unit: "PT" }, dashStyle: "SOLID" } }));

  return fmt;
}
```

- [ ] **Step 5: Update createMeetingDoc signature to accept logo2Url**

Change the function signature from:
```js
export async function createMeetingDoc(
  sessionTitle, summary, actionPoints, transcriptText, folderId, eventName, eventLogoUrl
)
```
to:
```js
export async function createMeetingDoc(
  sessionTitle, summary, actionPoints, transcriptText, folderId, eventName, eventLogoUrl, eventLogo2Url
)
```

Inside the function, where `createBrandedDoc` is called for both summary and transcript docs, add `logo2Url: eventLogo2Url || null`:

```js
// Summary doc
const summaryDoc = await createBrandedDoc(docs, drive, {
  title: `${sessionTitle} — Summary`,
  displayEvent, displayDate, logoUrl, logo2Url: eventLogo2Url || null, folderId,
});

// Transcript doc
const transcriptDoc = await createBrandedDoc(docs, drive, {
  title: `${sessionTitle} — Transcript`,
  displayEvent, displayDate, logoUrl, logo2Url: eventLogo2Url || null, folderId,
});
```

- [ ] **Step 6: Verify the file has no syntax errors**

```bash
node --check /Users/apple/.gemini/antigravity/scratch/live-transcript-app/src/lib/googleDrive.js
```

Expected: no output (exit code 0). If there are syntax errors they will be printed — fix before committing.

- [ ] **Step 7: Commit**

```bash
git add src/lib/googleDrive.js
git commit -m "feat: bigger logo, remove tagline, AI disclaimer footer, second logo right, add uploadAudioToDrive"
```

---

## Task 5: Export Route — Pass logo2Url

**Files:**
- Modify: `src/app/api/session/export/route.js`

- [ ] **Step 1: Pass logo2Url to createMeetingDoc**

In `export/route.js`, the `createMeetingDoc` call is currently (around line 46):

```js
const result = await createMeetingDoc(
  session.title || sessionId,
  cleanSummary,
  session.actionPoints || "",
  fullText,
  folderId,
  event?.name || null,
  event?.logoUrl || null
);
```

Add `event?.logo2Url || null` as the final argument:

```js
const result = await createMeetingDoc(
  session.title || sessionId,
  cleanSummary,
  session.actionPoints || "",
  fullText,
  folderId,
  event?.name || null,
  event?.logoUrl || null,
  event?.logo2Url || null
);
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/session/export/route.js
git commit -m "feat: pass logo2Url to createMeetingDoc in export route"
```

---

## Task 6: Slide — Remove Brand Tag, Add Second Logo

**Files:**
- Modify: `src/app/api/session/slide/route.js`

- [ ] **Step 1: Update buildSlideHtml signature to accept logo2**

Change the function signature from:
```js
function buildSlideHtml({ eventName, sessionTitle, highlights, logoBase64, logoMime }) {
```
to:
```js
function buildSlideHtml({ eventName, sessionTitle, highlights, logoBase64, logoMime, logo2Base64, logo2Mime }) {
```

- [ ] **Step 2: Remove the brand-tag div from the HTML template**

In `buildSlideHtml`, find and delete the line:
```html
      <div class="brand-tag">SesScribe — An InsideOut Event Product</div>
```

- [ ] **Step 3: Add second logo box CSS**

In the `<style>` block, after the `.logo-wrap img` rule (around line 111), add:

```css
  .logo-wrap-right {
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
    margin-left: auto;
  }

  .logo-wrap-right img {
    width: 100%;
    height: 100%;
    object-fit: contain;
  }
```

- [ ] **Step 4: Add second logo markup to the header**

In the `.header` div in `buildSlideHtml`, after the closing `</div>` of `.header-text`, add:

```js
${logo2Base64 ? `
    <div class="logo-wrap-right">
      <img src="data:${logo2Mime};base64,${logo2Base64}" alt="Second Logo" />
    </div>` : ""}
```

The full updated header block:
```html
  <div class="header">
    <div class="logo-wrap">
      ${logoSrc
        ? `<img src="${logoSrc}" alt="Logo" />`
        : `<div class="logo-placeholder">T</div>`}
    </div>
    <div class="header-text">
      <div class="event-name">${escapeHtml(eventName)}</div>
      <div class="session-title">${escapeHtml(sessionTitle)}</div>
    </div>
    ${logo2Base64 ? `
    <div class="logo-wrap-right">
      <img src="data:${logo2Mime};base64,${logo2Base64}" alt="Second Logo" />
    </div>` : ""}
  </div>
```

- [ ] **Step 5: Fetch logo2 in the POST handler**

In the `POST` handler of `slide/route.js`, after the block that fetches `logoBase64` (around line 314–326), add an equivalent block for `logo2Url`:

```js
const logo2Url = session.event?.logo2Url || null;
let logo2Base64 = null;
let logo2Mime = "image/png";
if (logo2Url) {
  try {
    const logo2Res = await fetch(logo2Url);
    if (logo2Res.ok) {
      logo2Mime = logo2Res.headers.get("content-type")?.split(";")[0] || "image/png";
      const logo2Buf = Buffer.from(await logo2Res.arrayBuffer());
      logo2Base64 = logo2Buf.toString("base64");
    }
  } catch (e) {
    console.warn("[Slide] Could not fetch logo2:", e.message);
  }
}
```

- [ ] **Step 6: Pass logo2 to buildSlideHtml**

Update the `buildSlideHtml(...)` call to include the new params:

```js
const html = buildSlideHtml({
  eventName,
  sessionTitle: session.title,
  highlights,
  logoBase64,
  logoMime,
  logo2Base64,
  logo2Mime,
});
```

- [ ] **Step 7: Commit**

```bash
git add src/app/api/session/slide/route.js
git commit -m "feat: remove brand-tag from slide, add second logo on right side"
```

---

## Task 7: Audio Upload — Save to Google Drive

**Files:**
- Modify: `src/app/api/session/upload-audio/route.js`

- [ ] **Step 1: Replace the route with the parallel Deepgram + Drive version**

Replace the entire contents of `src/app/api/session/upload-audio/route.js` with:

```js
import prisma from "@/lib/prisma";
import { uploadAudioToDrive } from "@/lib/googleDrive";

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

export async function POST(request) {
  try {
    const formData = await request.formData();
    const sessionId = formData.get("sessionId");
    const audioFile = formData.get("audioFile");

    if (!sessionId || !audioFile || audioFile.size === 0) {
      return Response.json({ error: "sessionId and audioFile required" }, { status: 400 });
    }

    // Read into buffer once — used for both Deepgram and Drive upload
    const audioBuffer = Buffer.from(await audioFile.arrayBuffer());
    console.log(`[upload-audio] Received ${(audioBuffer.length / 1024 / 1024).toFixed(1)} MB for session ${sessionId}`);

    // Fetch session + event (for folder ID and live transcript)
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { event: true },
    });
    if (!session) {
      return Response.json({ error: "Session not found" }, { status: 404 });
    }

    const folderId = session.event?.driveFolderId || null;
    const audioFilename = `${(session.title || sessionId).replace(/[^a-z0-9]/gi, "_")}.webm`;

    // Run Deepgram transcription + Drive upload in parallel
    const [dgResult, driveResult] = await Promise.allSettled([
      runDeepgramBatch(audioBuffer),
      folderId
        ? uploadAudioToDrive(audioBuffer, audioFilename, folderId)
        : Promise.resolve(null),
    ]);

    // Build session update
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
    } else if (driveResult.status === "rejected") {
      console.error("[upload-audio] Drive upload failed:", driveResult.reason?.message);
    }

    if (Object.keys(updateData).length > 0) {
      await prisma.session.update({ where: { id: sessionId }, data: updateData });
    }

    return Response.json({
      success: true,
      batch: dgResult.status === "fulfilled" && dgResult.value !== null,
      segments: dgResult.status === "fulfilled" ? (dgResult.value?.length ?? 0) : 0,
      audioSaved: driveResult.status === "fulfilled" && driveResult.value !== null,
    });
  } catch (error) {
    console.error("[upload-audio] Error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/session/upload-audio/route.js
git commit -m "feat: upload session audio to Google Drive in parallel with Deepgram"
```

---

## Task 8: Audio Stream API

**Files:**
- Create: `src/app/api/session/audio/route.js`

- [ ] **Step 1: Create the streaming route**

Create `src/app/api/session/audio/route.js`:

```js
import prisma from "@/lib/prisma";
import { getDriveClient } from "@/lib/googleDrive";

export async function GET(request) {
  try {
    const { searchParams } = new URL(request.url);
    const sessionId = searchParams.get("sessionId");
    if (!sessionId) return Response.json({ error: "No sessionId" }, { status: 400 });

    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      select: { audioFileId: true },
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

    // Convert Node.js Readable to Web ReadableStream for Next.js App Router
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
  } catch (error) {
    console.error("[/api/session/audio] Error:", error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/session/audio/route.js
git commit -m "feat: add audio stream API route (WebM from Drive)"
```

---

## Task 9: Audio MP3 Download API

**Files:**
- Create: `src/app/api/session/audio/download/route.js`

- [ ] **Step 1: Create directory and route file**

```bash
mkdir -p /Users/apple/.gemini/antigravity/scratch/live-transcript-app/src/app/api/session/audio/download
```

Create `src/app/api/session/audio/download/route.js`:

```js
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
      "-vn",           // no video
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
```

- [ ] **Step 2: Commit**

```bash
git add src/app/api/session/audio/download/route.js
git commit -m "feat: add MP3 download route (WebM from Drive → ffmpeg → MP3 stream)"
```

---

## Task 10: Session Page — Recording Card

**Files:**
- Modify: `src/app/session/[id]/page.js`

- [ ] **Step 1: Add audioFileId to the session query**

In `session/[id]/page.js`, the `prisma.session.findUnique` call (around line 54) already fetches the full session. The new `audioFileId` field will be included automatically since Prisma returns all scalar fields by default. No query change needed.

- [ ] **Step 2: Add Recording card styles**

In the `<style>` block (the template literal starting around line 109), add these classes at the end, before the closing backtick:

```css
        .audio-card {
          background: var(--surface-1);
          border: 1px solid var(--border);
          border-top: 3px solid #10b981;
          border-radius: var(--radius);
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1rem;
        }
        .audio-player {
          width: 100%;
          accent-color: #10b981;
          border-radius: 8px;
        }
        .audio-download-btn {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.65rem 1.2rem;
          background: rgba(16,185,129,0.12);
          border: 1px solid rgba(16,185,129,0.3);
          border-radius: 8px;
          color: #34d399;
          font-size: 0.85rem;
          font-weight: 600;
          text-decoration: none;
          transition: background 0.15s;
          width: fit-content;
        }
        .audio-download-btn:hover {
          background: rgba(16,185,129,0.2);
        }
```

- [ ] **Step 3: Add Recording card to left column**

In the left column (the first `<div>` inside `results-grid`), find the Key Highlights card closing `</div>` (the card with `borderTop: "3px solid var(--pink)"`). After it, add the Recording card:

```jsx
{/* Recording */}
{session.audioFileId && (
  <div className="audio-card">
    <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
      <div style={{
        width: "30px", height: "30px", borderRadius: "8px",
        background: "rgba(16,185,129,0.15)",
        display: "flex", alignItems: "center", justifyContent: "center", fontSize: "0.9rem",
      }}>🎙</div>
      <h2 style={{ fontSize: "1rem", fontWeight: "700" }}>Session Recording</h2>
    </div>
    <audio
      className="audio-player"
      controls
      preload="metadata"
      src={`/api/session/audio?sessionId=${session.id}`}
    />
    <a
      className="audio-download-btn"
      href={`/api/session/audio/download?sessionId=${session.id}`}
      download
    >
      ⬇ Download as MP3
    </a>
    <p style={{ fontSize: "0.75rem", color: "var(--fg-3)", margin: 0 }}>
      Audio recorded during this session. Download converts to MP3 — may take a moment for long recordings.
    </p>
  </div>
)}
```

- [ ] **Step 4: Verify no JSX errors**

```bash
cd /Users/apple/.gemini/antigravity/scratch/live-transcript-app && npm run build 2>&1 | tail -20
```

Expected: build completes without errors. Fix any JSX syntax issues if reported.

- [ ] **Step 5: Commit**

```bash
git add src/app/session/[id]/page.js
git commit -m "feat: add Recording card with audio player and MP3 download to session page"
```

---

## Task 11: Dockerfile — Add ffmpeg

**Files:**
- Modify: `Dockerfile`

- [ ] **Step 1: Add ffmpeg to the apk install command**

In the `runner` stage of `Dockerfile`, update the `RUN apk add --no-cache` command to include `ffmpeg`:

```dockerfile
RUN apk add --no-cache \
    chromium \
    ffmpeg \
    nss \
    freetype \
    harfbuzz \
    ca-certificates \
    ttf-freefont \
    font-noto
```

- [ ] **Step 2: Commit and push**

```bash
git add Dockerfile
git commit -m "feat: add ffmpeg to Docker runner stage for MP3 conversion"
git push origin main
```

---

## Task 12: Deploy to Production

- [ ] **Step 1: SSH into the server and pull + rebuild**

On the server at `ss.insideoutprojects.in`, run:

```bash
git pull origin main
docker compose build app
docker compose up -d app
```

The build will take a few minutes (Chromium + ffmpeg install). Watch for errors with:

```bash
docker compose logs -f app
```

- [ ] **Step 2: Run the database migration on production**

After the app container is up:

```bash
docker compose exec app npx prisma db push
```

Expected: `Your database is now in sync with your Prisma schema.`

- [ ] **Step 3: Smoke-test**

1. Navigate to an event's Edit page → confirm "Second Logo URL" field exists in Branding section
2. Add a second logo URL → Save → confirm saved
3. Start a new live session, record for ~30 seconds, end it
4. On the session result page → confirm "Session Recording" card appears with audio player
5. Click play → confirm audio plays in the browser
6. Click "Download as MP3" → confirm file downloads and plays correctly as MP3
7. Export Google Docs → open the summary doc → confirm no tagline line after event name/date, bigger logo, second logo on right, AI disclaimer in footer
8. Generate slide → confirm no "SesScribe — An InsideOut Event Product" in header, second logo on right if configured
