'use client';

import { Suspense, useEffect, useRef, useState } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';

const START = 'progress:start';
const DONE = 'progress:done';

/** Tampilkan progress bar selama `task` berjalan (untuk simpan, hapus, upload, dll). */
export async function withProgress<T>(task: () => Promise<T>): Promise<T> {
  window.dispatchEvent(new Event(START));
  try {
    return await task();
  } finally {
    window.dispatchEvent(new Event(DONE));
  }
}

function Bar() {
  const pathname = usePathname();
  const search = useSearchParams().toString();
  const [phase, setPhase] = useState<'idle' | 'loading' | 'done'>('idle');
  const pending = useRef(0);

  // URL berubah = navigasi selesai
  useEffect(() => {
    if (pending.current === 0) setPhase((p) => (p === 'loading' ? 'done' : p));
  }, [pathname, search]);

  useEffect(() => {
    if (phase !== 'done') return;
    const t = setTimeout(() => setPhase('idle'), 300);
    return () => clearTimeout(t);
  }, [phase]);

  useEffect(() => {
    const here = () => location.pathname + location.search;
    const start = () => setPhase('loading');

    // capture: berjalan sebelum <Link> memanggil preventDefault
    const onClick = (e: MouseEvent) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      const a = (e.target as Element).closest?.('a');
      if (!a || !a.href || a.target === '_blank' || a.hasAttribute('download')) return;
      const url = new URL(a.href, location.href);
      if (url.origin !== location.origin || url.pathname + url.search === here()) return;
      start();
    };
    const onSubmit = (e: SubmitEvent) => {
      const form = e.target as HTMLFormElement;
      if (form.method.toLowerCase() === 'get' && !form.dataset.noProgress) start();
    };
    const onStart = () => {
      pending.current++;
      start();
    };
    const onDone = () => {
      pending.current = Math.max(0, pending.current - 1);
      if (pending.current === 0) setPhase('done');
    };

    document.addEventListener('click', onClick, true);
    document.addEventListener('submit', onSubmit, true);
    window.addEventListener(START, onStart);
    window.addEventListener(DONE, onDone);
    return () => {
      document.removeEventListener('click', onClick, true);
      document.removeEventListener('submit', onSubmit, true);
      window.removeEventListener(START, onStart);
      window.removeEventListener(DONE, onDone);
    };
  }, []);

  return <div className={`nav-progress ${phase}`} aria-hidden />;
}

export function NavProgress() {
  return (
    <Suspense fallback={null}>
      <Bar />
    </Suspense>
  );
}
