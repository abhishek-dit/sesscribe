import prisma from "@/lib/prisma";
import { Resend } from "resend";
import { createMeetingDoc } from "@/lib/googleDrive";

const resend = new Resend(process.env.RESEND_API_KEY);

// ─── Gemini ───────────────────────────────────────────────────────────────────
async function generateSummaryAndActions(fullText) {
  const { GoogleGenerativeAI, SchemaType } = await import("@google/generative-ai");
  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: {
      responseMimeType: "application/json",
      responseSchema: {
        type: SchemaType.OBJECT,
        properties: {
          summary: { type: SchemaType.STRING, description: "A concise 2-3 paragraph meeting summary" },
          actionPoints: { type: SchemaType.STRING, description: "4-5 key highlights as bullet points separated by newlines, each starting with '- '" },
        },
        required: ["summary", "actionPoints"],
      },
    },
  });

  const prompt = `
You are an expert meeting summariser.
Given the transcript below, produce EXACTLY:
1. A concise 2–3 paragraph meeting summary.
2. Between 4 and 5 key highlights or main takeaways from the session.

Critically: Do NOT prefix strings with "Highlight 1: ", "Highlight 2: ", or numbers. Use raw bullet sentences.

Transcript:
${fullText}
`.trim();

  const result = await model.generateContent(prompt);
  const raw = result.response.text().replace(/```json|```/g, "").trim();
  return JSON.parse(raw);
}

// ─── Notifications ────────────────────────────────────────────────────────────
async function sendEmail(person, session, url) {
  if (!person.email || person.email === "no-email@example.com") return;
  if (!process.env.RESEND_API_KEY) {
    console.warn("[Email] RESEND_API_KEY not set — skipping.");
    return;
  }

  const { error } = await resend.emails.send({
    from: process.env.RESEND_FROM_EMAIL || "Meetings <meetings@yourdomain.com>",
    to: person.email,
    subject: `Meeting Summary: ${session.title}`,
    html: `
      <div style="font-family:sans-serif;max-width:600px;margin:auto">
        <h2>Hi ${person.name},</h2>
        <p>The <strong>${session.title}</strong> meeting transcript is ready.</p>
        <h3>Summary</h3>
        <p>${session.summary || "N/A"}</p>
        <h3>Action Points</h3>
        <pre style="white-space:pre-wrap">${session.actionPoints || "N/A"}</pre>
        <p><a href="${url}" style="background:#8b5cf6;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none">View Full Transcript →</a></p>
      </div>
    `,
  });

  if (error) {
    console.error(`[Email] Failed for ${person.email}:`, error);
  } else {
    console.log(`[Email] Sent to ${person.email}`);
  }
}

async function sendWhatsApp(person, session, url) {
  if (!person.whatsappNumber || person.whatsappNumber === "none") return;
  if (!process.env.AISENSY_API_KEY) {
    console.warn("[WhatsApp] AISENSY_API_KEY not set — skipping.");
    return;
  }

  // AiSensy campaign API v2
  // Requires a pre-approved template called "meeting_update"
  // with params: [meeting_title, transcript_url]
  try {
    const body = {
      apiKey: process.env.AISENSY_API_KEY,
      campaignName: process.env.AISENSY_CAMPAIGN || "meeting_update",
      destination: person.whatsappNumber.replace(/\D/g, ""), // digits only
      userName: person.name,
      templateParams: [session.title, url],
      source: "live-transcript-app",
    };

    const res = await fetch("https://backend.aisensy.com/campaign/t1/api/v2", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json();
    if (!res.ok) {
      console.error(`[WhatsApp] AiSensy error for ${person.whatsappNumber}:`, data);
    } else {
      console.log(`[WhatsApp] Sent to ${person.whatsappNumber}`);
    }
  } catch (err) {
    console.error(`[WhatsApp] Exception for ${person.whatsappNumber}:`, err.message);
  }
}

async function triggerNotifications(session) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "http://localhost:3000";
  const transcriptUrl = `${appUrl}/session/${session.id}`;
  const attendees = session.attendees.map((a) => a.attendee);

  await Promise.allSettled(
    attendees.flatMap((person) => [
      sendEmail(person, session, transcriptUrl),
      sendWhatsApp(person, session, transcriptUrl),
    ])
  );
}

// ─── Route Handler ────────────────────────────────────────────────────────────
export async function POST(request) {
  try {
    const formData = await request.formData();
    const sessionId = formData.get("sessionId");
    
    // We get the live streaming transcript as a fallback
    let transcriptJson = [];
    const clientTranscriptStr = formData.get("transcript");
    if (clientTranscriptStr) {
      try { transcriptJson = JSON.parse(clientTranscriptStr); } catch(e) {}
    }

    if (!sessionId) {
      return Response.json({ error: "No sessionId provided" }, { status: 400 });
    }

    // ── 1. Try Deepgram Prerecorded Batch processing (Supreme Accuracy) ──────
    let batchTranscript = null;
    const audioFile = formData.get("audioFile");
    if (audioFile && audioFile.size > 0) {
      console.log(`[session/complete] Audio file received (${audioFile.size} bytes). Running Deepgram Batch...`);
      try {
        const dgRes = await fetch("https://api.deepgram.com/v1/listen?model=nova-2&diarize=true&smart_format=true", {
          method: "POST",
          headers: {
            "Authorization": `Token ${process.env.DEEPGRAM_API_KEY}`,
            "Content-Type": "audio/webm",
          },
          body: audioFile,
        });
        
        const dgData = await dgRes.json();
        if (dgData.results && dgData.results.channels[0].alternatives[0]) {
          const words = dgData.results.channels[0].alternatives[0].words || [];
          if (words.length > 0) {
            let batchSegments = [];
            let currentSeg = null;
            
            for (const w of words) {
              const speakerName = `Speaker ${w.speaker !== undefined ? w.speaker + 1 : 1}`;
              if (!currentSeg || currentSeg.speaker !== speakerName) {
                if (currentSeg) batchSegments.push(currentSeg);
                currentSeg = { speaker: speakerName, text: w.punctuated_word || w.word, start: w.start, end: w.end };
              } else {
                currentSeg.text += " " + (w.punctuated_word || w.word);
                currentSeg.end = w.end;
              }
            }
            if (currentSeg) batchSegments.push(currentSeg);
            batchTranscript = batchSegments;
            console.log(`[session/complete] Deepgram Batch succeeded! (${batchTranscript.length} segments).`);
          }
        }
      } catch (err) {
        console.error("[session/complete] Deepgram Batch failed:", err.message);
      }
    }

    // Determine the "best" transcript for the AI summary (batch > live > empty)
    const bestTranscript = batchTranscript || (transcriptJson.length > 0 ? transcriptJson : [{ speaker: "System", text: "[No transcript could be generated]" }]);

    const fullText = bestTranscript
      .map((t) => `${t.speaker}: ${t.text}`)
      .join("\n");

    // ── 1.5 FAILSAFE: Immediate Local Disk Backup ──────────────────────────────
    // Ensure the data isn't lost if the DB goes offline or the server reboots
    try {
      const fs = await import("fs");
      const path = await import("path");
      const backupDir = path.join(process.cwd(), ".backups");
      if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true });
      fs.writeFileSync(
        path.join(backupDir, `${sessionId}.json`),
        JSON.stringify({ sessionId, transcript: bestTranscript, fullText }, null, 2)
      );
      console.log(`[session/complete] Saved local filesystem backup to .backups/${sessionId}.json`);
    } catch (fsErr) {
      console.warn("Failsafe backup to disk failed:", fsErr.message);
    }

    // 2. Generate summary + action points via Gemini
    let summary = "Summary could not be generated.";
    let actionPoints = "";

    try {
      const ai = await generateSummaryAndActions(fullText);
      summary = ai.summary;
      actionPoints = ai.actionPoints;
    } catch (err) {
      console.error("[Gemini] Error:", err.message);
    }

    // 3. Export to Google Docs (if credentials exist)
    // Fetch session + event to get title, folder, and event name
    const sessionForDoc = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { event: true },
    });
    const sessionTitle = sessionForDoc?.title || sessionId;
    const eventName = sessionForDoc?.event?.name || null;
    const eventLogoUrl = sessionForDoc?.event?.logoUrl || null;
    const folderId = sessionForDoc?.event?.driveFolderId || process.env.GOOGLE_DRIVE_FOLDER_ID || "";
    const gdocsResult = await createMeetingDoc(
      sessionTitle,
      summary,
      actionPoints,
      fullText,
      folderId,
      eventName,
      eventLogoUrl
    );

    // 4. Persist to PostgreSQL via Prisma. Save BOTH transcripts.
    const transcriptPayload = {
      live: transcriptJson,
      batch: batchTranscript, // may be null if it failed
    };

    let session;
    try {
      session = await prisma.session.update({
        where: { id: sessionId },
        data: {
          transcript: JSON.stringify(transcriptPayload),
          summary,
          actionPoints,
        },
        include: {
          attendees: { include: { attendee: true } },
        },
      });

      if (gdocsResult) {
        const docsNote = `[📝 Summary: ${gdocsResult.summaryUrl}]\n[📄 Transcript: ${gdocsResult.transcriptUrl}]`;
        await prisma.session.update({
          where: { id: sessionId },
          data: { summary: `${docsNote}\n\n${summary}` },
        });
        session.summary = `${docsNote}\n\n${summary}`;
      }
    } catch (dbErr) {
      console.error("[Prisma] Database update failed.", dbErr.message);
      session = {
        id: sessionId,
        title: "Session (Unsaved to DB)",
        summary: gdocsResult ? `[📝 Summary: ${gdocsResult.summaryUrl}]\n\n${summary}` : summary,
        actionPoints,
        transcript: JSON.stringify(transcriptPayload),
        attendees: []
      };
    }

    // 5. Fire notifications (non-blocking) ONLY if we have actual attendees from DB
    if (session.attendees && session.attendees.length > 0) {
      triggerNotifications(session).catch(console.error);
    }

    return Response.json({ success: true, session });
  } catch (error) {
    console.error("[/api/session/complete] Unhandled System Error:", error);
    return Response.json({ error: "System Error. Transcript was saved locally.", message: error.message }, { status: 500 });
  }
}
