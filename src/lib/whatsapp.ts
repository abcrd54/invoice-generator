import { createHmac, timingSafeEqual } from 'node:crypto';

/** Klien kecil untuk WhatsApp Cloud API (Meta). */

const GRAPH = `https://graph.facebook.com/${process.env.WHATSAPP_API_VERSION || 'v23.0'}`;

function token(): string {
  const t = process.env.WHATSAPP_TOKEN;
  if (!t) throw new Error('WHATSAPP_TOKEN belum diset');
  return t;
}

function phoneNumberId(): string {
  const id = process.env.WHATSAPP_PHONE_NUMBER_ID;
  if (!id) throw new Error('WHATSAPP_PHONE_NUMBER_ID belum diset');
  return id;
}

async function graph(path: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(`${GRAPH}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token()}`, ...(init.headers ?? {}) },
  });
  if (!res.ok) throw new Error(`WhatsApp API ${res.status}: ${await res.text()}`);
  return res;
}

const sendMessage = (body: Record<string, unknown>) =>
  graph(`/${phoneNumberId()}/messages`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messaging_product: 'whatsapp', ...body }),
  });

/** Cek header X-Hub-Signature-256 dari Meta. */
export function verifySignature(rawBody: string, header: string | null): boolean {
  const secret = process.env.WHATSAPP_APP_SECRET;
  if (!secret || !header?.startsWith('sha256=')) return false;
  const expected = Buffer.from(createHmac('sha256', secret).update(rawBody).digest('hex'));
  const got = Buffer.from(header.slice(7));
  return expected.length === got.length && timingSafeEqual(expected, got);
}

/** Nomor yang boleh memakai bot (format 628xxx, tanpa +). */
export function isAllowed(phone: string): boolean {
  const list = (process.env.WHATSAPP_ALLOWED_NUMBERS ?? '')
    .split(',')
    .map((n) => n.replace(/\D/g, ''))
    .filter(Boolean);
  return list.includes(phone.replace(/\D/g, ''));
}

/** Tandai pesan sudah dibaca + tampilkan "sedang mengetik..." sampai balasan terkirim. */
export async function markReadTyping(messageId: string): Promise<void> {
  await sendMessage({ status: 'read', message_id: messageId, typing_indicator: { type: 'text' } }).catch(() => {});
}

/** Kirim teks; dipecah per ~4000 karakter (batas WhatsApp 4096). */
export async function sendText(to: string, text: string): Promise<void> {
  const chunks: string[] = [];
  let rest = text.trim();
  while (rest.length > 4000) {
    const cut = rest.lastIndexOf('\n', 4000) > 2000 ? rest.lastIndexOf('\n', 4000) : 4000;
    chunks.push(rest.slice(0, cut));
    rest = rest.slice(cut).trimStart();
  }
  if (rest) chunks.push(rest);
  for (const body of chunks) await sendMessage({ to, type: 'text', text: { body, preview_url: false } });
}

/** Upload file ke WhatsApp lalu kirim sebagai dokumen. */
export async function sendDocument(to: string, file: Buffer, filename: string, caption?: string): Promise<void> {
  const form = new FormData();
  form.append('messaging_product', 'whatsapp');
  form.append('type', 'application/pdf');
  form.append('file', new Blob([new Uint8Array(file)], { type: 'application/pdf' }), filename);
  const { id } = (await (await graph(`/${phoneNumberId()}/media`, { method: 'POST', body: form })).json()) as { id: string };
  await sendMessage({ to, type: 'document', document: { id, filename, ...(caption ? { caption } : {}) } });
}

/** Unduh media (foto) yang dikirim user. media_id berlaku ±30 hari. */
export async function downloadMedia(mediaId: string): Promise<{ bytes: ArrayBuffer; contentType: string }> {
  const meta = (await (await graph(`/${encodeURIComponent(mediaId)}`)).json()) as { url: string; mime_type: string };
  // url media ada di domain lookaside Meta (bukan graph), tetap pakai token yang sama
  const file = await fetch(meta.url, { headers: { Authorization: `Bearer ${token()}` } });
  if (!file.ok) throw new Error(`Gagal unduh media ${file.status}`);
  return { bytes: await file.arrayBuffer(), contentType: meta.mime_type.split(';')[0] };
}

/** Bentuk pesan masuk di payload webhook yang kita pakai. */
export interface InboundMessage {
  from: string;
  id: string;
  type: string;
  text?: { body: string };
  image?: { id: string; mime_type: string; caption?: string };
}

export function extractMessages(payload: unknown): InboundMessage[] {
  const entries = (payload as { entry?: { changes?: { value?: { messages?: InboundMessage[] } }[] }[] })?.entry ?? [];
  return entries.flatMap((e) => (e.changes ?? []).flatMap((c) => c.value?.messages ?? []));
}
