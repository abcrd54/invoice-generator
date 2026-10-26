import { cache } from 'react';
import { redirect } from 'next/navigation';
import { createAdminClient, createSessionClient } from './supabase/server';

/**
 * Untuk Server Component halaman yang butuh login. Mengembalikan client service role.
 * JWT diverifikasi lokal (getClaims) dan di-cache per request, jadi layout + page tidak
 * bolak-balik ke server Auth.
 */
export const requireUser = cache(async () => {
  const session = await createSessionClient();
  const { data } = await session.auth.getClaims();
  if (!data?.claims) redirect('/login');
  const user = { id: data.claims.sub, email: data.claims.email as string | undefined };
  return { user, db: createAdminClient() };
});
