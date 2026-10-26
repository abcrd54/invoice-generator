import { after } from 'next/server';
import { createAdminClient } from '@/lib/supabase/server';
import { extractMessages, isAllowed, markReadTyping, sendText, verifySignature } from '@/lib/whatsapp';
import { handleWhatsAppMessage } from '@/lib/wa-agent';

export const runtime = 'nodejs';
export const maxDuration = 300;

/** Verifikasi webhook saat didaftarkan di Meta (hub.challenge). */
export async function GET(req: Request) {
  const sp = new URL(req.url).searchParams;
  const verifyToken = process.env.WHATSAPP_VERIFY_TOKEN;
  if (verifyToken && sp.get('hub.mode') === 'subscribe' && sp.get('hub.verify_token') === verifyToken) {
    return new Response(sp.get('hub.challenge') ?? '', { status: 200 });
  }
  return new Response('Forbidden', { status: 403 });
}

/** Pesan masuk dari WhatsApp. Langsung balas 200, proses di belakang (after). */
export async function POST(req: Request) {
  const raw = await req.text();
  if (!verifySignature(raw, req.headers.get('x-hub-signature-256'))) {
    return new Response('Invalid signature', { status: 401 });
  }

  const db = createAdminClient();
  for (const msg of extractMessages(JSON.parse(raw))) {
    if (!isAllowed(msg.from)) continue; // nomor tak dikenal: diam saja

    // WhatsApp bisa mengirim ulang webhook yang sama; proses sekali saja
    const { error } = await db.from('wa_inbound').insert({ message_id: msg.id, phone: msg.from });
    if (error?.code === '23505') continue;
    if (error) console.error('wa_inbound', error.message);

    after(async () => {
      await markReadTyping(msg.id);
      try {
        await handleWhatsAppMessage(db, msg);
      } catch (e) {
        console.error('whatsapp handler', e);
        await sendText(msg.from, `Maaf, terjadi kesalahan: ${(e as Error).message}`).catch(() => {});
      }
    });
  }
  return new Response('OK', { status: 200 });
}
