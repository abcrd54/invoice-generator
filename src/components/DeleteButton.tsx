'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { withProgress } from './NavProgress';

export function DeleteButton({ id, redirectTo }: { id: string; redirectTo?: string }) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const busy = deleting || refreshing;
  return (
    <button
      className="btn btn-sm btn-danger"
      disabled={busy}
      onClick={async () => {
        if (!confirm('Hapus dokumen ini?')) return;
        setDeleting(true);
        const res = await withProgress(() => fetch(`/api/v1/documents/${id}`, { method: 'DELETE' }));
        setDeleting(false);
        if (!res.ok) return alert((await res.json()).error ?? 'Gagal menghapus');
        startRefresh(() => {
          if (redirectTo) router.push(redirectTo);
          router.refresh();
        });
      }}
    >
      {busy ? <span className="spinner" /> : '🗑️'}
    </button>
  );
}
