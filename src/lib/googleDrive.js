import { google } from "googleapis";

// ─── TiE Brand Constants ─────────────────────────────────────────────────────
const BRAND = {
  red:       { red: 0.80, green: 0.0,  blue: 0.0  }, // #CC0000
  blue:      { red: 0.02, green: 0.42, blue: 0.82 }, // #046BD2
  darkSlate: { red: 0.12, green: 0.16, blue: 0.23 }, // #1E293B
  gray:      { red: 0.61, green: 0.64, blue: 0.69 }, // #9CA3AF
  white:     { red: 1.0,  green: 1.0,  blue: 1.0  },
  defaultLogoUrl: "https://media.licdn.com/dms/image/v2/D560BAQG5CiuZGPpnaw/company-logo_200_200/B56ZydvRqHHYAI-/0/1772172942682/tie_mysuru_logo?e=1777507200&v=beta&t=YyJG7jxRg-1aiS5p02FNyYoIFJnCLZZhNzJNVInc883U",
  font: "Roboto",
  fontMono: "Roboto Mono",
  tagline: "SesScribe — An InsideOut Event Product",
};

// ─── Auth ────────────────────────────────────────────────────────────────────
function getAuth() {
  if (process.env.GOOGLE_REFRESH_TOKEN && process.env.GOOGLE_CLIENT_ID) {
    const oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET
    );
    oauth2Client.setCredentials({ refresh_token: process.env.GOOGLE_REFRESH_TOKEN });
    return oauth2Client;
  }
  const clientEmail = process.env.GOOGLE_CLIENT_EMAIL || "";
  const privateKey = (process.env.GOOGLE_PRIVATE_KEY || "").replace(/\\n/g, "\n");
  if (!clientEmail || !privateKey) return null;
  return new google.auth.JWT({
    email: clientEmail,
    key: privateKey,
    scopes: ["https://www.googleapis.com/auth/documents", "https://www.googleapis.com/auth/drive"],
  });
}

// ─── Style helpers ───────────────────────────────────────────────────────────
function rgb(hex) {
  return { red: parseInt(hex.slice(1, 3), 16) / 255, green: parseInt(hex.slice(3, 5), 16) / 255, blue: parseInt(hex.slice(5, 7), 16) / 255 };
}

function mkText(start, end, opts, segId) {
  const ts = {}; const f = [];
  if (opts.bold !== undefined)     { ts.bold = opts.bold; f.push("bold"); }
  if (opts.italic !== undefined)   { ts.italic = opts.italic; f.push("italic"); }
  if (opts.fontSize !== undefined) { ts.fontSize = { magnitude: opts.fontSize, unit: "PT" }; f.push("fontSize"); }
  if (opts.color)                  { ts.foregroundColor = { color: { rgbColor: opts.color } }; f.push("foregroundColor"); }
  if (opts.font)                   { ts.weightedFontFamily = { fontFamily: opts.font }; f.push("weightedFontFamily"); }
  const range = { startIndex: start, endIndex: end };
  if (segId) range.segmentId = segId;
  return { updateTextStyle: { range, textStyle: ts, fields: f.join(",") } };
}

function mkPara(start, end, opts, segId) {
  const ps = {}; const f = [];
  if (opts.alignment)                { ps.alignment = opts.alignment; f.push("alignment"); }
  if (opts.spaceAbove !== undefined) { ps.spaceAbove = { magnitude: opts.spaceAbove, unit: "PT" }; f.push("spaceAbove"); }
  if (opts.spaceBelow !== undefined) { ps.spaceBelow = { magnitude: opts.spaceBelow, unit: "PT" }; f.push("spaceBelow"); }
  if (opts.lineSpacing !== undefined){ ps.lineSpacing = opts.lineSpacing; f.push("lineSpacing"); }
  if (opts.indentStart !== undefined){ ps.indentStart = { magnitude: opts.indentStart, unit: "PT" }; f.push("indentStart"); }
  if (opts.borderBottom)             { ps.borderBottom = opts.borderBottom; f.push("borderBottom"); }
  if (opts.borderTop)                { ps.borderTop = opts.borderTop; f.push("borderTop"); }
  const range = { startIndex: start, endIndex: end };
  if (segId) range.segmentId = segId;
  return { updateParagraphStyle: { range, paragraphStyle: ps, fields: f.join(",") } };
}

// ─── Shared: create a branded doc with header/footer/logo ────────────────────
async function createBrandedDoc(docs, drive, { title, displayEvent, displayDate, logoUrl, folderId }) {
  const doc = await docs.documents.create({ requestBody: { title } });
  const documentId = doc.data.documentId;

  // Create header & footer
  const hfRes = await docs.documents.batchUpdate({
    documentId,
    requestBody: { requests: [{ createHeader: { type: "DEFAULT" } }, { createFooter: { type: "DEFAULT" } }] },
  });
  const headerId = hfRes.data.replies[0].createHeader.headerId;
  const footerId = hfRes.data.replies[1].createFooter.footerId;

  // Header text: just the event + tagline (logo goes before this)
  const headerText = `\n${displayEvent}  |  ${BRAND.tagline}\n`;
  const footerText = `${displayEvent}  |  ${BRAND.tagline}  |  Confidential\n`;

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

  // Style header text
  const hLen = headerText.length - 1;
  const headerFmt = [
    mkText(1, hLen, { fontSize: 8, color: BRAND.gray, font: BRAND.font }, headerId),
    mkPara(1, hLen, { spaceAbove: 4, borderBottom: { color: { color: { rgbColor: BRAND.red } }, width: { magnitude: 1.5, unit: "PT" }, padding: { magnitude: 4, unit: "PT" }, dashStyle: "SOLID" } }, headerId),
  ];

  // Style footer text
  const fLen = footerText.length - 1;
  headerFmt.push(mkText(0, fLen, { fontSize: 7.5, color: BRAND.gray, font: BRAND.font }, footerId));
  headerFmt.push(mkPara(0, fLen, { alignment: "CENTER", borderTop: { color: { color: { rgbColor: rgb("#E5E7EB") } }, width: { magnitude: 0.5, unit: "PT" }, padding: { magnitude: 6, unit: "PT" }, dashStyle: "SOLID" } }, footerId));

  await docs.documents.batchUpdate({ documentId, requestBody: { requests: headerFmt } });

  // Insert logo at index 0 in header (before the text, so text wraps below)
  try {
    await docs.documents.batchUpdate({
      documentId,
      requestBody: {
        requests: [{
          insertInlineImage: {
            location: { segmentId: headerId, index: 0 },
            uri: logoUrl || BRAND.defaultLogoUrl,
            objectSize: { height: { magnitude: 40, unit: "PT" }, width: { magnitude: 40, unit: "PT" } },
          },
        }],
      },
    });
  } catch (e) {
    console.warn("[GoogleDocs] Logo insertion failed:", e.message);
  }

  // Make the doc viewable by anyone with the link
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

// ─── Shared: title block ─────────────────────────────────────────────────────
function buildTitleBlock(sessionTitle, displayEvent, displayDate) {
  const parts = [];
  let cursor = 1;
  function add(text, id) { const s = cursor; parts.push({ id, start: s, end: s + text.length }); cursor += text.length; return text; }

  let body = "";
  body += add(`${sessionTitle}\n`, "title");
  body += add(`${displayEvent}\n`, "event");
  body += add(`${displayDate}\n`, "date");
  body += add(`${BRAND.tagline}\n`, "tagline");
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
  fmt.push(mkText(dt.start, dt.end - 1, { fontSize: 10, color: BRAND.gray, font: BRAND.font }));

  const tg = p("tagline");
  fmt.push(mkText(tg.start, tg.end - 1, { italic: true, fontSize: 9, color: BRAND.gray, font: BRAND.font }));
  fmt.push(mkPara(tg.start, tg.end - 1, { spaceBelow: 14, borderBottom: { color: { color: { rgbColor: BRAND.red } }, width: { magnitude: 2, unit: "PT" }, padding: { magnitude: 10, unit: "PT" }, dashStyle: "SOLID" } }));

  return fmt;
}

// ─── Main Export: creates two docs ───────────────────────────────────────────
export async function createMeetingDoc(
  sessionTitle, summary, actionPoints, transcriptText, folderId, eventName, eventLogoUrl
) {
  try {
    const auth = getAuth();
    if (!auth) { console.warn("[GoogleDocs] Skipping — missing credentials."); return null; }

    const docs = google.docs({ version: "v1", auth });
    const drive = google.drive({ version: "v3", auth });

    const displayEvent = eventName || "TiECon Mysuru 2026";
    const displayDate = new Date().toLocaleDateString("en-IN", { weekday: "long", year: "numeric", month: "long", day: "numeric" });
    const logoUrl = eventLogoUrl || BRAND.defaultLogoUrl;

    const cleanedHighlights = (actionPoints || "").split("\n").map((l) => l.trim()).filter(Boolean).map((l) => (l.startsWith("-") || l.startsWith("*") ? l : `- ${l}`)).join("\n");

    // ═══════════════════════════════════════════════════════════════════════
    // DOC 1: Summary + Key Highlights
    // ═══════════════════════════════════════════════════════════════════════
    const summaryDoc = await createBrandedDoc(docs, drive, {
      title: `${sessionTitle} — Summary`,
      displayEvent, displayDate, logoUrl, folderId,
    });

    // Build body
    const tb1 = buildTitleBlock(sessionTitle, displayEvent, displayDate);
    let body1 = tb1.body;
    let c1 = tb1.cursor;
    const p1 = [...tb1.parts];
    function add1(text, id) { const s = c1; p1.push({ id, start: s, end: s + text.length }); c1 += text.length; return text; }

    body1 += add1("SESSION SUMMARY\n", "summaryH");
    body1 += add1(`${summary || "N/A"}\n`, "summaryB");
    body1 += add1("\n", "sp2");
    body1 += add1("KEY HIGHLIGHTS\n", "highlightsH");
    body1 += add1(`${cleanedHighlights || "N/A"}\n`, "highlightsB");

    await docs.documents.batchUpdate({
      documentId: summaryDoc.documentId,
      requestBody: { requests: [{ insertText: { location: { index: 1 }, text: body1 } }] },
    });

    // Format
    const fmt1 = formatTitleBlock(p1);
    const pf = (id) => p1.find((x) => x.id === id);

    for (const hId of ["summaryH", "highlightsH"]) {
      const h = pf(hId);
      fmt1.push(mkText(h.start, h.end - 1, { bold: true, fontSize: 15, color: BRAND.red, font: BRAND.font }));
      fmt1.push(mkPara(h.start, h.end - 1, { spaceAbove: 22, spaceBelow: 8, borderBottom: { color: { color: { rgbColor: rgb("#E5E7EB") } }, width: { magnitude: 0.5, unit: "PT" }, padding: { magnitude: 4, unit: "PT" }, dashStyle: "SOLID" } }));
    }

    const sb = pf("summaryB");
    fmt1.push(mkText(sb.start, sb.end - 1, { fontSize: 11, color: BRAND.darkSlate, font: BRAND.font }));
    fmt1.push(mkPara(sb.start, sb.end - 1, { lineSpacing: 165, spaceBelow: 4 }));

    const hb = pf("highlightsB");
    fmt1.push(mkText(hb.start, hb.end - 1, { fontSize: 11, color: BRAND.darkSlate, font: BRAND.font }));
    fmt1.push(mkPara(hb.start, hb.end - 1, { lineSpacing: 180, spaceBelow: 3, indentStart: 18 }));

    await docs.documents.batchUpdate({ documentId: summaryDoc.documentId, requestBody: { requests: fmt1 } });

    // ═══════════════════════════════════════════════════════════════════════
    // DOC 2: Full Transcript
    // ═══════════════════════════════════════════════════════════════════════
    const transcriptDoc = await createBrandedDoc(docs, drive, {
      title: `${sessionTitle} — Transcript`,
      displayEvent, displayDate, logoUrl, folderId,
    });

    const tb2 = buildTitleBlock(sessionTitle, displayEvent, displayDate);
    let body2 = tb2.body;
    let c2 = tb2.cursor;
    const p2 = [...tb2.parts];
    function add2(text, id) { const s = c2; p2.push({ id, start: s, end: s + text.length }); c2 += text.length; return text; }

    body2 += add2("FULL TRANSCRIPT\n", "transcriptH");
    body2 += add2(`${transcriptText || "N/A"}\n`, "transcriptB");

    await docs.documents.batchUpdate({
      documentId: transcriptDoc.documentId,
      requestBody: { requests: [{ insertText: { location: { index: 1 }, text: body2 } }] },
    });

    const fmt2 = formatTitleBlock(p2);
    const pf2 = (id) => p2.find((x) => x.id === id);

    const th = pf2("transcriptH");
    fmt2.push(mkText(th.start, th.end - 1, { bold: true, fontSize: 15, color: BRAND.red, font: BRAND.font }));
    fmt2.push(mkPara(th.start, th.end - 1, { spaceAbove: 22, spaceBelow: 8, borderBottom: { color: { color: { rgbColor: rgb("#E5E7EB") } }, width: { magnitude: 0.5, unit: "PT" }, padding: { magnitude: 4, unit: "PT" }, dashStyle: "SOLID" } }));

    const txb = pf2("transcriptB");
    fmt2.push(mkText(txb.start, txb.end - 1, { fontSize: 9, color: BRAND.gray, font: BRAND.fontMono }));
    fmt2.push(mkPara(txb.start, txb.end - 1, { lineSpacing: 145, spaceBelow: 1 }));

    await docs.documents.batchUpdate({ documentId: transcriptDoc.documentId, requestBody: { requests: fmt2 } });

    const summaryUrl = `https://docs.google.com/document/d/${summaryDoc.documentId}/edit`;
    const transcriptUrl = `https://docs.google.com/document/d/${transcriptDoc.documentId}/edit`;
    console.log(`[GoogleDocs] Summary: ${summaryUrl}`);
    console.log(`[GoogleDocs] Transcript: ${transcriptUrl}`);
    return { summaryUrl, transcriptUrl };
  } catch (error) {
    console.error("[GoogleDocs] Error:", error.message);
    return null;
  }
}
