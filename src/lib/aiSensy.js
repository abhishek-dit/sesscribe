export async function sendWhatsAppMessage({ apiKey, fromNumber, toNumber, message }) {
  const url = `https://api.aisensy.com/v1/messages?key=${encodeURIComponent(apiKey)}`;
  const payload = {
    channel: 'whatsapp',
    source: fromNumber,
    destination: toNumber,
    message,
  };
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`AiSensy send failed: ${res.status} ${err}`);
  }
  return await res.json();
}
