import Anthropic from '@anthropic-ai/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';
import { uploadProof } from './attachments';
import { AppError, getDocument, shareUrl } from './documents';
import { formatDate, formatRupiah, todayISO } from './format';
import { SERVER_INSTRUCTIONS, TOOLS, callTool } from './mcp-tools';
import { pdfFilename, renderPdf } from './pdf';
import { downloadMedia, sendDocument, sendText, type InboundMessage } from './whatsapp';

/** Agent WhatsApp: Claude + tool dokumen yang sama dengan server MCP. */

const MODEL = process.env.CLAUDE_MODEL || 'claude-opus-5-5';
const EFFORT = (process.env.CLAUDE_EFFORT || 'medium') as 'low' | 'medium' | 'high';
const HISTORY_LIMIT = 20;
const MAX_STEPS = 12;

const SYSTEM = `${SERVER_INSTRUCTIONS}

Kamu adalah asisten admin Polyline yang dihubungi lewat WhatsApp.
- Jawab singkat dalam bahasa Indonesia. Pakai format WhatsApp: *tebal*, _miring_, daftar dengan "-". Jangan pakai tabel atau heading markdown.
- File PDF dikirim otomatis oleh sistem setelah dokumen dibuat, diubah, atau dilampiri bukti transfer. Cukup sebutkan nomor dokumen dan totalnya; jangan tulis link kecuali diminta.
- Foto dari user muncul sebagai teks "[foto media_id=...]". Jika itu bukti transfer, lampirkan dengan attach_whatsapp_image ke dokumen yang dimaksud (biasanya Form Request Payment yang baru dibahas). Jika tidak jelas dokumen mana, tanyakan.
- Jika user minta PDF dokumen lama, cari dengan list_documents lalu kirim dengan send_pdf.`;

const WA_TOOLS: Anthropic.Beta.BetaTool[] = [
  ...TOOLS.filter((t) => t.name !== 'attach_proof').map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.inputSchema as Anthropic.Beta.BetaTool.InputSchema,
  })),
  {
    name: 'attach_whatsapp_image',
    description: 'Lampirkan foto yang dikirim user di WhatsApp sebagai bukti transfer ke Form Request Payment.',
    input_schema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'id atau nomor dokumen' },
        media_id: { type: 'string', description: 'media_id dari teks "[foto media_id=...]"' },
      },
      required: ['id', 'media_id'],
    },
  },
  {
    name: 'send_pdf',
    description: 'Kirim file PDF sebuah dokumen ke chat WhatsApp ini.',
    input_schema: {
      type: 'object',
      properties: { id: { type: 'string', description: 'id atau nomor dokumen' } },
      required: ['id'],
    },
  },
];

/** Tool yang mengubah dokumen → PDF-nya dikirim otomatis setelah balasan. */
const PDF_AFTER = new Set(['create_document', 'update_document', 'attach_whatsapp_image', 'send_pdf']);

const client = new Anthropic();

async function loadHistory(db: SupabaseClient, phone: string): Promise<Anthropic.Beta.BetaMessageParam[]> {
  const { data } = await db
    .from('wa_messages')
    .select('role, content')
    .eq('phone', phone)
    .order('id', { ascending: false })
    .limit(HISTORY_LIMIT);
  const rows = (data ?? []).reverse() as { role: 'user' | 'assistant'; content: string }[];
  while (rows.length && rows[0].role !== 'user') rows.shift();
  return rows.map((r) => ({ role: r.role, content: r.content }));
}

async function saveTurn(db: SupabaseClient, phone: string, user: string, assistant: string) {
  await db.from('wa_messages').insert([
    { phone, role: 'user', content: user },
    { phone, role: 'assistant', content: assistant },
  ]);
}

/** Teks pesan masuk yang disimpan di riwayat (foto diganti penanda media_id). */
function describe(msg: InboundMessage): string {
  if (msg.type === 'image' && msg.image) {
    return `[foto media_id=${msg.image.id}]${msg.image.caption ? `\n${msg.image.caption}` : ''}`;
  }
  return msg.text?.body ?? '';
}

async function runTool(db: SupabaseClient, name: string, input: Record<string, unknown>, touched: Set<string>): Promise<unknown> {
  const id = typeof input.id === 'string' ? input.id : '';
  let result: unknown;
  if (name === 'attach_whatsapp_image') {
    const img = await downloadMedia(String(input.media_id ?? ''));
    const doc = await uploadProof(db, id, img.bytes, img.contentType);
    result = { id: doc.id, number: doc.number, has_proof: true };
  } else if (name === 'send_pdf') {
    const doc = await getDocument(db, id);
    result = { id: doc.id, number: doc.number, queued: true };
  } else {
    result = await callTool(db, name, input);
  }
  const docId = (result as { id?: unknown })?.id;
  if (PDF_AFTER.has(name) && typeof docId === 'string') touched.add(docId);
  return result;
}

/** Proses satu pesan WhatsApp sampai balasan (teks + PDF) terkirim. */
export async function handleWhatsAppMessage(db: SupabaseClient, msg: InboundMessage): Promise<void> {
  const phone = msg.from;
  const text = describe(msg).trim();

  if (/^\/?reset$/i.test(text)) {
    await db.from('wa_messages').delete().eq('phone', phone);
    return sendText(phone, 'Riwayat chat sudah dihapus. Silakan mulai permintaan baru.');
  }
  if (!text) {
    return sendText(phone, 'Maaf, saat ini aku hanya bisa membaca pesan teks dan foto.');
  }

  // Pesan sekarang: teks + gambar asli (supaya Claude bisa membaca bukti transfer)
  const content: Anthropic.Beta.BetaContentBlockParam[] = [];
  if (msg.type === 'image' && msg.image) {
    const img = await downloadMedia(msg.image.id);
    if (/^image\/(jpeg|png|webp|gif)$/.test(img.contentType)) {
      content.push({
        type: 'image',
        source: { type: 'base64', media_type: img.contentType as 'image/jpeg', data: Buffer.from(img.bytes).toString('base64') },
      });
    }
  }
  content.push({ type: 'text', text });

  const messages: Anthropic.Beta.BetaMessageParam[] = [...(await loadHistory(db, phone)), { role: 'user', content }];
  const touched = new Set<string>();
  let reply = '';

  for (let step = 0; step < MAX_STEPS; step++) {
    const res = await client.beta.messages.create({
      model: MODEL,
      max_tokens: 16000,
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      output_config: { effort: EFFORT },
      system: [
        { type: 'text', text: SYSTEM, cache_control: { type: 'ephemeral' } },
        { type: 'text', text: `Hari ini: ${formatDate(todayISO())} (${todayISO()}), zona WIB.` },
      ],
      tools: WA_TOOLS,
      messages,
    });

    if (res.stop_reason === 'refusal') {
      reply = 'Maaf, permintaan ini tidak bisa aku proses.';
      break;
    }
    if (res.stop_reason === 'pause_turn') {
      messages.push({ role: 'assistant', content: res.content });
      continue;
    }

    const uses = res.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === 'tool_use');
    if (uses.length === 0 || res.stop_reason === 'max_tokens') {
      reply = res.content
        .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('\n')
        .trim();
      break;
    }

    messages.push({ role: 'assistant', content: res.content });
    const results = await Promise.all(
      uses.map(async (u): Promise<Anthropic.Beta.BetaToolResultBlockParam> => {
        try {
          const out = await runTool(db, u.name, (u.input ?? {}) as Record<string, unknown>, touched);
          return { type: 'tool_result', tool_use_id: u.id, content: JSON.stringify(out) };
        } catch (e) {
          const message = e instanceof AppError || e instanceof Error ? e.message : String(e);
          return { type: 'tool_result', tool_use_id: u.id, is_error: true, content: message };
        }
      }),
    );
    messages.push({ role: 'user', content: results });
  }

  if (!reply) reply = touched.size ? 'Selesai.' : 'Maaf, aku belum bisa menyelesaikan permintaan ini. Coba ulangi dengan lebih rinci.';
  await sendText(phone, reply);
  await saveTurn(db, phone, text, reply);

  for (const id of touched) {
    const doc = await getDocument(db, id);
    const pdf = await renderPdf(shareUrl(doc));
    await sendDocument(phone, pdf, pdfFilename(doc.number), `${doc.number} — ${formatRupiah(Number(doc.total))}`);
  }
}
