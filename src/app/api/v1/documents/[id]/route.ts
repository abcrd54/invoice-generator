import { authorize } from '@/lib/auth';
import { handleError, ok, readJson } from '@/lib/api';
import { deleteDocument, getDocument, summarize, updateDocument } from '@/lib/documents';

type Ctx = { params: Promise<{ id: string }> };

export async function GET(req: Request, { params }: Ctx) {
  try {
    const { db } = await authorize(req);
    const doc = await getDocument(db, decodeURIComponent((await params).id));
    return ok({ document: { ...summarize(doc), data: doc.data } });
  } catch (e) {
    return handleError(e);
  }
}

/** Body: { data?: {...patch}, status?: "PAID", replace?: boolean } */
export async function PATCH(req: Request, { params }: Ctx) {
  try {
    const { db } = await authorize(req);
    const body = await readJson(req);
    const doc = await updateDocument(db, decodeURIComponent((await params).id), {
      data: body.data,
      status: body.status as string | undefined,
      replace: body.replace === true,
    });
    return ok({ document: { ...summarize(doc), data: doc.data } });
  } catch (e) {
    return handleError(e);
  }
}

export async function DELETE(req: Request, { params }: Ctx) {
  try {
    const { db } = await authorize(req);
    await deleteDocument(db, decodeURIComponent((await params).id));
    return ok({ deleted: true });
  } catch (e) {
    return handleError(e);
  }
}
