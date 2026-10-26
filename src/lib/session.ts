import { redirect } from 'next/navigation';
import { createAdminClient, createSessionClient } from './supabase/server';

/** Untuk Server Component halaman yang butuh login. Mengembalikan client service role. */
export async function requireUser() {
  const session = await createSessionClient();
  const { data } = await session.auth.getUser();
  if (!data.user) redirect('/login');
  return { user: data.user, db: createAdminClient() };
}
