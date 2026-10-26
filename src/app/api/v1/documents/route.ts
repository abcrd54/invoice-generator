import { authorize } from '@/lib/auth';
import { handleError, ok, readJson } from '@/lib/api';
import { createDocument, listDocuments, summarize } from '@/lib/documents';

export async function GET(req: Request) {
  try {
    const { db } = await authorize(req);
    const p = new URL(req.url).searchParams;
    const docs = await listDocuments(db, {
      type: p.get('type') ?? undefined,
      status: p.get('status') ?? undefined,
      search: p.get('search') ?? undefined,
      limit: p.get('limit') ? Number(p.get('limit')) : undefined,
    });
    return ok({ documents: docs.map(summarize) });
  } catch (e) {
    return handleError(e);
  }
}

/** Body: { type: "invoice", data: {...}, status?: "DRAFT" } */
export async function POST(req: Request) {
  try {
    const { db, caller } = await authorize(req);
    const body = await readJson(req);
    const doc = await createDocument(db, {
      type: String(body.type ?? ''),
      data: body.data,
      status: body.status as string | undefined,
      source: caller,
    });
    return ok({ document: { ...summarize(doc), data: doc.data } }, 201);
  } catch (e) {
    return handleError(e);
  }
}
