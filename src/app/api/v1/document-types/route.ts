import { authorize } from '@/lib/auth';
import { handleError, ok, readJson } from '@/lib/api';
import { listTypes, upsertType } from '@/lib/documents';

export async function GET(req: Request) {
  try {
    const { db } = await authorize(req);
    return ok({ document_types: await listTypes(db) });
  } catch (e) {
    return handleError(e);
  }
}

/** Buat / perbarui jenis dokumen (form baru seperti req_ongkir, req_iklan). */
export async function POST(req: Request) {
  try {
    const { db } = await authorize(req);
    return ok({ document_type: await upsertType(db, await readJson(req)) }, 201);
  } catch (e) {
    return handleError(e);
  }
}
