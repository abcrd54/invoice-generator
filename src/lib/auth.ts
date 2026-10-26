import { timingSafeEqual } from 'node:crypto';
import { createAdminClient, createSessionClient } from './supabase/server';
import { AppError } from './documents';

export type Caller = 'agent' | 'web';

function agentKeyMatches(header: string | null): boolean {
  const expected = process.env.AGENT_API_KEY;
  if (!expected || !header?.startsWith('Bearer ')) return false;
  const a = Buffer.from(header.slice(7).trim());
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

/**
 * Autentikasi request API: agent pakai `Authorization: Bearer <AGENT_API_KEY>`,
 * browser pakai sesi login Supabase. Mengembalikan client service role.
 */
export async function authorize(req: Request) {
  if (agentKeyMatches(req.headers.get('authorization'))) {
    return { db: createAdminClient(), caller: 'agent' as Caller };
  }
  const session = await createSessionClient();
  const { data } = await session.auth.getClaims();
  if (!data?.claims) throw new AppError('unauthorized', 401);
  return { db: createAdminClient(), caller: 'web' as Caller };
}
