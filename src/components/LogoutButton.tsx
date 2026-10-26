'use client';

import { useRouter } from 'next/navigation';
import { createBrowserSupabase } from '@/lib/supabase/client';

export function LogoutButton() {
  const router = useRouter();
  return (
    <button
      className="btn btn-sm"
      onClick={async () => {
        await createBrowserSupabase().auth.signOut();
        router.replace('/login');
        router.refresh();
      }}
    >
      Keluar
    </button>
  );
}
