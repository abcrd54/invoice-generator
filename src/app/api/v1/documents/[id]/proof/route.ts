import { authorize } from '@/lib/auth';
import { handleError, ok, readJson } from '@/lib/api';
import { AppError, summarize } from '@/lib/documents';
import { decodeBase64Image, fetchImage, removeProof, uploadProof } from '@/lib/attachments';

type Ctx = { params: Promise<{ id: string }> };

/**
 * Upload bukti transfer. Salah satu:
 * - multipart/form-data dengan field "file"
 * - JSON { "image_url": "https://..." }
 * - JSON { "image_base64": "...", "mime": "image/png" }
 */
export async function POST(req: Request, { params }: Ctx) {
  try {
    const { db } = await authorize(req);
    const id = decodeURIComponent((await params).id);
    let img: { bytes: ArrayBuffer; contentType: string };

    if ((req.headers.get('content-type') ?? '').includes('multipart/form-data')) {
      const file = (await req.formData()).get('file');
      if (!(file instanceof File)) throw new AppError('field "file" wajib diisi');
      img = { bytes: await file.arrayBuffer(), contentType: file.type };
    } else {
      const body = await readJson(req);
      if (typeof body.image_url === 'string') img = await fetchImage(body.image_url);
      else if (typeof body.image_base64 === 'string') img = decodeBase64Image(body.image_base64, body.mime as string | undefined);
      else throw new AppError('kirim file (multipart), image_url, atau image_base64');
    }

    return ok({ document: summarize(await uploadProof(db, id, img.bytes, img.contentType)) });
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  try {
    const { db } = await authorize(req);
    return ok({ document: summarize(await removeProof(db, decodeURIComponent((await params).id))) });
  } catch (e) {
    return handleError(e);
  }
}
