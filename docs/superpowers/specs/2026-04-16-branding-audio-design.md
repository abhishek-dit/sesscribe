# Design: Branding Updates, Second Logo, and Audio Recording Backup

**Date:** 2026-04-16  
**Status:** Approved

---

## Overview

Six coordinated changes across the app:

1. Google Docs — remove tagline lines, bigger logo, AI disclaimer in footer
2. Slide — remove tagline from header
3. Database — add `logo2Url` to Event, `audioFileId` to Session
4. Edit Event form — second logo URL field
5. Audio backup — save WebM recording to Google Drive, play/download from Session page
6. Dockerfile — add `ffmpeg` to runner stage

---

## 1. Google Docs Branding (`src/lib/googleDrive.js`)

### Logo size
Change `objectSize` in `insertInlineImage` from `40×40 PT` to `72×72 PT`.

### Header text
Current: `"\n${displayEvent}  |  ${BRAND.tagline}\n"`  
New: `"\n${displayEvent}\n"` — tagline removed entirely from header text.

### Second logo in header
After inserting the first logo at `index: 0` (left side), insert the second logo also at `index: 0` — but only if `logo2Url` is provided. Because both are inserted at index 0, the second insertion pushes the first to the right, resulting in: `[logo2] [logo1] [event text]`. To get first logo left and second logo right, we must insert the second logo **after** the first (at a higher index). Approach: insert first logo at index 0, then read the updated document to find the end of the header, and insert second logo there. Simpler alternative: insert second logo at index 0 first, then first logo at index 0 — this puts first logo at left, second at right after the text. Actually the cleanest approach: insert both images in separate `batchUpdate` calls. First call inserts logo1 at index 0 (left). Second call (if logo2Url exists) inserts logo2 at the end of the header text — achieved by inserting at `index: headerText.length` which places it after all text, i.e., visually right-aligned in the header flow.

Pragmatic implementation: insert logo1 at index 0. Insert logo2 at `index: headerText.length - 1` (before the final newline), which places it at the end of the header line — appearing on the right.

### Title block — remove tagline line
In `buildTitleBlock()`, remove the line:
```js
body += add(`${BRAND.tagline}\n`, "tagline");
```
and remove `formatTitleBlock` styling for the `"tagline"` part. The title block will have: session title → event name → date → spacer.

### Footer — AI disclaimer
Current: `"${displayEvent}  |  ${BRAND.tagline}  |  Confidential\n"`  
New: `"This transcript and summary was generated using AI. AI can make mistakes.  |  ${displayEvent}\n"`

Footer styling unchanged (small gray centered text).

### Function signature update
`createMeetingDoc(sessionTitle, summary, actionPoints, transcriptText, folderId, eventName, eventLogoUrl)` → add `eventLogo2Url` as the last parameter. Pass to `createBrandedDoc`.

`createBrandedDoc` receives both `logoUrl` and `logo2Url`, inserts both.

### Callers
`src/app/api/session/export/route.js`: pass `event?.logo2Url || null` as the new final argument.

---

## 2. Slide Branding (`src/app/api/session/slide/route.js`)

### Remove tagline from header
Delete the `<div class="brand-tag">SesScribe — An InsideOut Event Product</div>` element from `buildSlideHtml`.

### Second logo in header
If `logo2Url` is provided, add a second logo box on the right side of the `.header` flex container. The header becomes:
```
[logo1 box] [header text (flex:1)] [logo2 box]
```
Logo2 box has the same style as logo1 box (140×140, glass style). If no logo2, header is unchanged.

### Data source
In the `POST` handler, fetch `logo2Url` from `session.event.logo2Url`. Fetch and base64-encode it the same way as logo1.

---

## 3. Database Schema (`prisma/schema.prisma`)

```prisma
model Event {
  // existing fields ...
  logo2Url         String?   // Second logo URL for right-side branding
}

model Session {
  // existing fields ...
  audioFileId      String?   // Google Drive file ID for the recorded WebM audio
}
```

Migration: `prisma migrate dev` or `prisma db push` (two nullable columns, safe).

---

## 4. Edit Event Form

### `src/components/EventEditForm.js`
Add state: `const [logo2Url, setLogo2Url] = useState(event.logo2Url || "");`

Add to the Branding card (below the existing Logo URL field):
- Label: "Second Logo URL (right side)"
- Input bound to `logo2Url`
- Preview image (same pattern as existing logo preview)
- Helper text: "Appears on the right side of the Google Docs header and slide."

Include `logo2Url` in the `fetch("/api/event/update", ...)` body.

### `src/app/events/[id]/edit/page.js`
Add `logo2Url: event.logo2Url` to the `serialized` object passed to `EventEditForm`.

### `src/app/api/event/update/route.js`
Add: `if (body.logo2Url !== undefined) data.logo2Url = body.logo2Url || null;`

---

## 5. Audio — Storage & Playback

### Storage flow
`/api/session/upload-audio` currently:
1. Receives WebM blob
2. Sends to Deepgram for batch transcription
3. Updates session transcript

New step added after step 2 (runs in parallel or sequentially — parallel is faster):
4. Upload WebM to Google Drive in the event's `driveFolderId` (same folder as the docs)
5. Make the Drive file publicly readable (`reader` / `anyone`)
6. Save the Drive file ID to `session.audioFileId`

If the event has no `driveFolderId` (session not linked to an event), skip audio upload gracefully.

### New Google Drive helper: `uploadAudioToDrive`
In `src/lib/googleDrive.js`:
```js
export async function uploadAudioToDrive(audioBuffer, filename, folderId)
```
- Uses `drive.files.create` with `uploadType: "multipart"`
- Sets `mimeType: "audio/webm"`
- Moves to `folderId` if provided
- Sets public reader permission
- Returns `{ fileId }` or `null` on failure

### Audio streaming API: `GET /api/session/audio`
New file: `src/app/api/session/audio/route.js`

- Reads `sessionId` from query param
- Fetches `session.audioFileId` from DB
- Fetches the file content from Google Drive API (using auth) and streams it back
- Response headers: `Content-Type: audio/webm`, `Accept-Ranges: bytes`
- Used by the `<audio>` element on the Session page for in-browser playback

### MP3 download API: `GET /api/session/audio/download`
New file: `src/app/api/session/audio/download/route.js`

- Reads `sessionId` from query param
- Fetches WebM bytes from Google Drive
- Spawns `ffmpeg -i pipe:0 -f mp3 pipe:1` via `child_process.spawn`
- Pipes Drive response into ffmpeg stdin, ffmpeg stdout back to the HTTP response
- Response headers: `Content-Type: audio/mpeg`, `Content-Disposition: attachment; filename="${sessionTitle}.mp3"`

### Session page: `src/app/session/[id]/page.js`
Add a "Recording" card in the left column (below Key Highlights, above Speakers Detected) if `session.audioFileId` is set:

```
┌─ Recording ────────────────────────────────┐
│  🎙 Session Audio                          │
│  [HTML5 audio player — src=/api/.../audio] │
│  [Download as MP3]                         │
└────────────────────────────────────────────┘
```

The audio player uses `<audio controls src="/api/session/audio?sessionId=X" />`.  
The download button is an anchor: `<a href="/api/session/audio/download?sessionId=X" download>`.

---

## 6. Dockerfile

Add `ffmpeg` to the `apk add` command in the runner stage:

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

No additional npm packages required — MP3 conversion uses system `ffmpeg` via `child_process.spawn`.

---

## Files Changed

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add `logo2Url` to Event, `audioFileId` to Session |
| `src/lib/googleDrive.js` | Bigger logo, remove tagline lines, AI disclaimer footer, second logo right, add `uploadAudioToDrive` |
| `src/app/api/session/export/route.js` | Pass `logo2Url` to `createMeetingDoc` |
| `src/app/api/session/upload-audio/route.js` | Upload WebM to Drive, save `audioFileId` to session |
| `src/app/api/session/slide/route.js` | Remove brand-tag, add second logo right side |
| `src/components/EventEditForm.js` | Add logo2Url field with preview |
| `src/app/events/[id]/edit/page.js` | Pass logo2Url to form |
| `src/app/api/event/update/route.js` | Handle logo2Url |
| `src/app/session/[id]/page.js` | Add Recording card with player + MP3 download |
| `src/app/api/session/audio/route.js` | **NEW** — stream WebM from Drive |
| `src/app/api/session/audio/download/route.js` | **NEW** — convert + stream MP3 |
| `Dockerfile` | Add `ffmpeg` to runner stage |

---

## Out of Scope

- Converting existing sessions' audio (no audio was stored previously — only new sessions going forward)
- Waveform visualization on the session page
- Audio trimming or editing
