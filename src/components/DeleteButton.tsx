'use client';

import { useRouter } from 'next/navigation';

export function DeleteButton({ id, redirectTo }: { id: string; redirectTo?: string }) {
  const router = useRouter();
  return (
    <button
      className="btn btn-sm btn-danger"
      onClick={async () => {
        if (!confirm('Hapus dokumen ini?')) return;
        const res = await fetch(`/api/v1/documents/${id}`, { method: 'DELETE' });
        if (!res.ok) return alert((await res.json()).error ?? 'Gagal menghapus');
        if (redirectTo) router.push(redirectTo);
        router.refresh();
      }}
    >
      🗑️
    </button>
  );
}
