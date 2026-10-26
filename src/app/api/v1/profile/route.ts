import { authorize } from '@/lib/auth';
import { handleError, ok, readJson } from '@/lib/api';
import { getProfile, updateProfile } from '@/lib/documents';

export async function GET(req: Request) {
  try {
    const { db } = await authorize(req);
    return ok({ profile: await getProfile(db) });
  } catch (e) {
    return handleError(e);
  }
}

export async function PATCH(req: Request) {
  try {
    const { db } = await authorize(req);
    return ok({ profile: await updateProfile(db, await readJson(req)) });
  } catch (e) {
    return handleError(e);
  }
}
