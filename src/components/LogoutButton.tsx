'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createBrowserSupabase } from '@/lib/supabase/client';

export function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  return (
    <button
      className="btn btn-sm"
      disabled={busy}
      onClick={async () => {
        setBusy(true);
        await createBrowserSupabase().auth.signOut();
        router.replace('/login');
        router.refresh();
      }}
    >
      {busy ? 'Keluar...' : 'Keluar'}
    </button>
  );
}
