import { createAdminClient } from '@/lib/supabase/server';
import { getDocumentByToken } from '@/lib/documents';
import { pdfFilename, renderPdf } from '@/lib/pdf';

export const runtime = 'nodejs';
export const maxDuration = 60;

type Params = Promise<{ token: string }>;

/** Download dokumen sebagai file PDF (lewat link rahasia yang sama dengan halaman share). */
export async function GET(req: Request, { params }: { params: Params }) {
  const { token } = await params;
  const doc = await getDocumentByToken(createAdminClient(), token);
  if (!doc) return new Response('Not found', { status: 404 });

  const origin = new URL(req.url).origin;
  let pdf: Buffer;
  try {
    pdf = await renderPdf(`${origin}/p/${token}`);
  } catch (e) {
    console.error("pdf", e);
    return new Response(`Gagal membuat PDF: ${(e as Error).message}`, { status: 500 });
  }
  const download = new URL(req.url).searchParams.has('download');
  return new Response(new Uint8Array(pdf), {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `${download ? 'attachment' : 'inline'}; filename="${pdfFilename(doc.number)}"`,
      'Cache-Control': 'private, no-store',
      'X-Robots-Tag': 'noindex',
    },
  });
}
