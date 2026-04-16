# Design: Branding Tweaks, Session Page Redesign, and Brevo Email Integration

**Date:** 2026-04-16  
**Status:** Approved

---

## Overview

Four coordinated changes:

1. Google Doc branding — logos-only header, expanded footer with tagline + confidential
2. Slide branding — AI disclaimer added to footer
3. Session page — three-column layout replacing the unbalanced two-column layout
4. Brevo email — per-event settings, dynamically built campaign per session

---

## 1. Google Doc Branding (`src/lib/googleDrive.js`)

### Header text
Change `headerText` from `"\n${displayEvent}\n"` to `"\n"` — a single newline.  
The header segment will contain only the two inline logo images, no text.

### Footer text
Change from:
```
"This transcript and summary was generated using AI. AI can make mistakes.  |  ${displayEvent}\n"
```
To:
```
"This transcript and summary was generated using AI. AI can make mistakes.  |  ${displayEvent}  |  SesScribe — An InsideOut Event Product  |  Confidential\n"
```

No other changes to `googleDrive.js` in this spec.

---

## 2. Slide Branding (`src/app/api/session/slide/route.js`)

### Footer text
Change the footer span content from:
```
Powered by SesScribe — An InsideOut Event Product
```
To:
```
Powered by SesScribe — An InsideOut Event Product  |  This transcript and summary was generated using AI. AI can make mistakes.
```

No other changes to `slide/route.js` in this spec.

---

## 3. Session Page Redesign (`src/app/session/[id]/page.js`)

### Layout
Replace the current two-column grid (`minmax(350px, 1.2fr) 2fr`) with a three-column grid:

```
[Left 0.7fr] [Center 1.1fr] [Right 1.5fr]
```

**Left column** (narrow):
- Sharing & Groups card
- Recording card (conditional on `session.audioFileId`)
- Speakers Detected card

**Center column**:
- AI Summary card — `max-height: 400px`, `overflow-y: auto` with styled scrollbar
- Key Highlights card — `max-height: 350px`, `overflow-y: auto` with styled scrollbar

**Right column** (wide):
- Full Transcript card (existing scrollable card, unchanged)

### Responsive breakpoints
- `< 1200px`: collapse to two columns — left merges into center; right stays right
- `< 900px`: single column — left cards → center cards → transcript

### CSS class change
Update `.results-grid` to the new three-column definition. Update `grid-template-columns` in the responsive overrides accordingly.

---

## 4. Brevo Email Integration

### 4a. Database (`prisma/schema.prisma`)

Add three nullable String fields to the `Event` model:

```prisma
model Event {
  // existing fields ...
  brevoApiKey      String?   // Brevo API key for email campaigns
  brevoSenderEmail String?   // Verified sender email address in the Brevo account
  brevoListId      String?   // Brevo contact list ID (stored as string, parsed to int on use)
}
```

Migration: `prisma db push` (three nullable columns, safe).

### 4b. Edit Event Form (`src/components/EventEditForm.js`)

Add a **Brevo Email** section (new card, below the existing AiSensy/WhatsApp card) with three fields:

| Label | State var | Input type |
|-------|-----------|------------|
| Brevo API Key | `brevoApiKey` | `password` (masked) |
| Sender Email | `brevoSenderEmail` | `email` |
| List ID | `brevoListId` | `text` |

Helper text under Sender Email: "Must be a verified sender in your Brevo account."  
Helper text under the section: "Used to send session summaries to your Brevo contact list."

Include all three in the `fetch("/api/event/update", ...)` body.

### 4c. Edit Event Page (`src/app/events/[id]/edit/page.js`)

Add to `serialized`:
```js
brevoApiKey: event.brevoApiKey,
brevoSenderEmail: event.brevoSenderEmail,
brevoListId: event.brevoListId,
```

### 4d. Event Update API (`src/app/api/event/update/route.js`)

Add:
```js
if (body.brevoApiKey !== undefined) data.brevoApiKey = body.brevoApiKey || null;
if (body.brevoSenderEmail !== undefined) data.brevoSenderEmail = body.brevoSenderEmail || null;
if (body.brevoListId !== undefined) data.brevoListId = body.brevoListId || null;
```

### 4e. Broadcast API (`src/app/api/session/broadcast-brevo/route.js`) — NEW

`POST` handler:

1. Read `sessionId` from body
2. Fetch session (include event) from DB
3. Validate: event must have `brevoApiKey`, `brevoSenderEmail`, `brevoListId`
4. Extract Google Doc URLs from `session.summary` using the same regex logic as the session page:
   - Two-doc format: `[📝 Summary: <url>]\n[📄 Transcript: <url>]`
   - Legacy single-doc format: `[📝 Google Doc Created: <url>]`
5. Parse action points from `session.actionPoints` (same `parseActionPoints` logic as session page)
6. Build email HTML dynamically — see structure below
7. Build campaign name: `"${session.title} — ${new Date().toLocaleDateString()}"`
8. `POST https://api.brevo.com/v3/emailCampaigns` with:
   ```json
   {
     "name": "<campaign name>",
     "subject": "<session.title> — Session Summary",
     "sender": { "name": "<event.name>", "email": "<brevoSenderEmail>" },
     "recipients": { "listIds": [<brevoListId as int>] },
     "htmlContent": "<full email HTML string>"
   }
   ```
   Header: `api-key: <brevoApiKey>`
9. Parse `id` from the campaign creation response
10. `POST https://api.brevo.com/v3/emailCampaigns/{id}/sendNow`
11. Return `{ success: true }` or error details

No external npm packages — uses `fetch` (available in Next.js runtime).

### Email HTML structure

The `htmlContent` is a self-contained HTML string built in the route handler. Structure:

```
[Event Name — session title, date]
[Summary Doc button — links to gdocsSummaryUrl]       (only if URL exists)
[Transcript Doc button — links to gdocsTranscriptUrl] (only if URL exists)
[Key Highlights section — bullet list of action points]
[Static footer: "SesScribe — An InsideOut Event Product | This transcript and summary
 was generated using AI. AI can make mistakes."]
```

Inline CSS only (email client compatibility). Dark-on-light color scheme (white background, dark text) — email clients don't support CSS variables. Use a simple, readable layout: centered container, max-width 600px.

### 4f. Broadcast Button Component (`src/components/BroadcastBrevoButton.js`) — NEW

Client component mirroring `BroadcastAiSensyButton`:

- Props: `sessionId`, `disabled`
- States: idle → loading → success/error
- Calls `POST /api/session/broadcast-brevo`
- Disabled when `disabled` prop is true
- Button label: "📧 Send Email Broadcast"
- Success: shows "✓ Sent!" for 3 seconds then resets
- Error: shows error message inline

### 4g. Session Page (`src/app/session/[id]/page.js`)

The event is already fully fetched via `event: true` in the include — no query changes needed.

In the Sharing & Groups card, add `BroadcastBrevoButton` below `BroadcastAiSensyButton`:

```jsx
<BroadcastBrevoButton
  sessionId={session.id}
  disabled={!session.eventId || !session.event?.brevoApiKey || !session.event?.brevoSenderEmail || !session.event?.brevoListId}
/>
```

---

## Files Changed

| File | Change |
|------|--------|
| `src/lib/googleDrive.js` | Header text → newline only; footer → add tagline + confidential |
| `src/app/api/session/slide/route.js` | Footer → add AI disclaimer |
| `src/app/session/[id]/page.js` | Three-column layout; import + render BroadcastBrevoButton |
| `prisma/schema.prisma` | Add `brevoApiKey`, `brevoSenderEmail`, `brevoListId` to Event |
| `src/components/EventEditForm.js` | Add Brevo settings section |
| `src/app/events/[id]/edit/page.js` | Pass Brevo fields to form |
| `src/app/api/event/update/route.js` | Handle Brevo fields |
| `src/app/api/session/broadcast-brevo/route.js` | **NEW** — build HTML + create + send Brevo campaign |
| `src/components/BroadcastBrevoButton.js` | **NEW** — send email button |

---

## Out of Scope

- Per-contact personalization (all recipients receive the same session email)
- Scheduling campaigns for later (always sends immediately)
- Campaign analytics / tracking on the session page
- Brevo contact management (list membership managed in Brevo directly)
