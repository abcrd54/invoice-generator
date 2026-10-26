'use client';

import { useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { createBrowserSupabase } from '@/lib/supabase/client';

function LoginForm() {
  const router = useRouter();
  const next = useSearchParams().get('next') || '/';
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    const { error } = await createBrowserSupabase().auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) return setError(error.message);
    router.replace(next.startsWith('/') ? next : '/');
    router.refresh();
  }

  return (
    <section className="login-box">
      <h2>Masuk</h2>
      {error && <div className="error-msg">{error}</div>}
      <form onSubmit={submit}>
        <div className="form-group" style={{ marginBottom: 12 }}>
          <label htmlFor="email">Email</label>
          <input id="email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        <div className="form-group" style={{ marginBottom: 12 }}>
          <label htmlFor="password">Password</label>
          <input id="password" type="password" required value={password} onChange={(e) => setPassword(e.target.value)} />
        </div>
        <button className="btn btn-primary" disabled={loading}>
          {loading ? 'Memproses...' : 'Masuk'}
        </button>
      </form>
    </section>
  );
}

export default function LoginPage() {
  return (
    <>
      <header>
        <h1>Polyline Documents</h1>
      </header>
      <Suspense>
        <LoginForm />
      </Suspense>
    </>
  );
}
