import prisma from "@/lib/prisma";

// ─── AiSensy helpers (headers used for all internal API calls) ───────────────
function aiSensyHeaders(token) {
  return {
    "Content-Type": "application/json",
    "Origin": "https://www.app.aisensy.com",
    "Referer": "https://www.app.aisensy.com/",
    "Cookie": `token=${token}`,
  };
}

// ─── Auto-refresh the AiSensy JWT token ──────────────────────────────────────
// The token has `refreshable: true` and the refresh endpoint is embedded in
// the JWT's `loginFrom` field: /client/t1/auth/get-new-agent-token
async function refreshAiSensyToken(currentToken, eventId) {
  try {
    const res = await fetch("https://backend.aisensy.com/client/t1/auth/get-new-agent-token", {
      method: "GET",
      headers: aiSensyHeaders(currentToken),
    });

    if (!res.ok) {
      console.warn("[BROADCAST] Token refresh failed (status " + res.status + "), using existing token.");
      return currentToken;
    }

    // The refresh endpoint may return a new token in the response body or as a Set-Cookie
    const setCookie = res.headers.get("set-cookie") || "";
    const tokenMatch = setCookie.match(/token=([^;]+)/);

    let newToken = currentToken;

    if (tokenMatch) {
      newToken = tokenMatch[1];
    } else {
      // Try getting it from the response body
      const data = await res.json().catch(() => null);
      if (data?.token) {
        newToken = data.token;
      }
    }

    if (newToken !== currentToken) {
      // Persist the refreshed token to the DB
      await prisma.event.update({
        where: { id: eventId },
        data: { aiSensyToken: newToken },
      });
      console.log("[BROADCAST] Token auto-refreshed and saved.");
    }

    return newToken;
  } catch (err) {
    console.warn("[BROADCAST] Token refresh error:", err.message);
    return currentToken;
  }
}

// ─── Fetch contacts from AiSensy with configurable filter ────────────────────
// filterMode: "all" | "no_tags" | "has_tag" | "not_has_tag"
// tagName: required when filterMode is "has_tag" or "not_has_tag"
async function fetchContacts(aiSensyProjectId, token, filterMode, tagName) {
  const PAGE_SIZE = 100;
  let skip = 0;
  let allContacts = [];

  // Build the AiSensy filter array based on the mode
  const filters = [];
  if ((filterMode === "has_tag" || filterMode === "not_has_tag") && tagName) {
    filters.push({
      attributeName: { key: "tags", name: "Tags", type: "List" },
      attributeKey: "tags",
      attributeType: "List",
      operators: ["has", "not has"],
      operator: filterMode === "has_tag" ? "has" : "not has",
      value: { tagName },
      freeSolo: false,
      condition: "and",
    });
  }

  while (true) {
    const res = await fetch("https://backend.aisensy.com/client/t1/api/contacts", {
      method: "POST",
      headers: aiSensyHeaders(token),
      body: JSON.stringify({
        assistantId: aiSensyProjectId,
        skip,
        rowsPerPage: PAGE_SIZE,
        allFilters: {
          optedIn: "yes",
          blocked: "no",
          readStatus: "all",
          dateFilters: {
            lastActive: { startDate: null, toDate: null, focusedInput: null },
            createdAt: { startDate: null, toDate: null, focusedInput: null },
            tags: [],
          },
          filters,
        },
      }),
    });

    if (!res.ok) {
      const err = await res.text();
      throw new Error(`AiSensy contacts API error (${res.status}): ${err}`);
    }

    const data = await res.json();
    const contacts = data.contacts || [];

    if (filterMode === "no_tags") {
      // Client-side filter: only contacts with zero tags
      allContacts.push(...contacts.filter((c) => !c.tags || c.tags.length === 0));
    } else {
      // "all", "has_tag", "not_has_tag" — server already filtered
      allContacts.push(...contacts);
    }

    if (contacts.length < PAGE_SIZE || skip + contacts.length >= data.totalContacts) {
      break;
    }
    skip = data.newSkip || skip + PAGE_SIZE;
  }

  return allContacts;
}

// ─── Route Handler ───────────────────────────────────────────────────────────
export async function POST(request) {
  try {
    const { sessionId } = await request.json();

    // 1. Load session + event
    const session = await prisma.session.findUnique({
      where: { id: sessionId },
      include: { event: true },
    });

    if (!session) throw new Error("Session not found");
    if (!session.event) throw new Error("Session is not linked to an event. Link it first.");
    if (!session.event.whatsappApiKey) throw new Error("AiSensy API key not configured on this event.");
    if (!session.event.aiSensyProjectId) throw new Error("AiSensy Project ID not configured. Go to Edit Event to add it.");
    if (!session.event.aiSensyToken) throw new Error("AiSensy session token not set. Go to Edit Event and paste your token once — it will auto-refresh after that.");

    const event = session.event;
    const campaignName = event.campaignName || process.env.AISENSY_CAMPAIGN || "meeting_update";

    // 2. Auto-refresh the token before using it
    const token = await refreshAiSensyToken(event.aiSensyToken, event.id);

    // 3. Extract Google Doc URL from summary (try new two-doc format first, then legacy)
    const summaryText = session.summary ?? "";
    const twoDocMatch = summaryText.match(/\[📝 Summary: (https?:\/\/[^\]]+)\]/);
    const legacyMatch = summaryText.match(/\[📝 Google Doc Created: (https?:\/\/[^\]]+)\]/);
    const docUrl = twoDocMatch ? twoDocMatch[1] : legacyMatch ? legacyMatch[1] : "(Document pending)";

    // 4. Fetch contacts from AiSensy using the configured filter
    const filterMode = event.broadcastFilter || "no_tags";
    const tagName = event.broadcastTag || null;
    console.log(`[BROADCAST] Fetching contacts (filter: ${filterMode}, tag: ${tagName || "none"})...`);
    const contacts = await fetchContacts(event.aiSensyProjectId, token, filterMode, tagName);
    console.log(`[BROADCAST] Found ${contacts.length} untagged contacts.`);

    if (contacts.length === 0) {
      return Response.json({ success: true, broadcastResults: [], total: 0, sent: 0, message: "No untagged contacts found in AiSensy." });
    }

    // 5. Send campaign to each contact
    const broadcastResults = [];

    for (const contact of contacts) {
      const destination = contact.userNumber;
      const userName = contact.userName || "there";

      try {
        const body = {
          apiKey: event.whatsappApiKey,
          campaignName,
          destination,
          userName,
          templateParams: [session.title, docUrl],
          paramsFallbackValue: {
            FirstName: userName,
          },
          source: "live-transcript-app",
          media: {},
          buttons: [],
          carouselCards: [],
          location: {},
          attributes: {},
        };

        const res = await fetch("https://backend.aisensy.com/campaign/t1/api/v2", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });

        const data = await res.json();
        if (!res.ok) throw new Error(data.error || JSON.stringify(data));

        broadcastResults.push({ name: userName, number: destination, status: "success" });
      } catch (err) {
        console.error(`[BROADCAST] Failed for ${userName} (${destination}):`, err.message);
        broadcastResults.push({ name: userName, number: destination, status: "failed", error: err.message });
      }
    }

    const successCount = broadcastResults.filter((r) => r.status === "success").length;
    console.log(`[BROADCAST] Done. ${successCount}/${contacts.length} sent.`);

    return Response.json({ success: true, broadcastResults, total: contacts.length, sent: successCount });
  } catch (err) {
    console.error("[BROADCAST] Error:", err);
    return Response.json({ error: err.message || "Broadcast failed" }, { status: 500 });
  }
}
