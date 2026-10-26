'use client';

import { useState } from 'react';
import type { BusinessProfile } from '@/lib/types';

export function ProfileForm({ profile }: { profile: BusinessProfile }) {
  const [p, setP] = useState(profile);
  const [termsText, setTermsText] = useState(profile.default_terms.join('\n\n'));
  const [msg, setMsg] = useState('');

  const field = (key: keyof BusinessProfile, label: string, opts: { textarea?: boolean; full?: boolean } = {}) => (
    <div className={`form-group ${opts.full ? 'full-width' : ''}`}>
      <label>{label}</label>
      {opts.textarea ? (
        <textarea rows={2} value={String(p[key])} onChange={(e) => setP({ ...p, [key]: e.target.value })} />
      ) : (
        <input value={String(p[key])} onChange={(e) => setP({ ...p, [key]: e.target.value })} />
      )}
    </div>
  );

  async function save() {
    setMsg('');
    const body = {
      ...p,
      tax_rate: Number(p.tax_rate) || 0,
      default_terms: termsText.split(/\n\s*\n/).map((t) => t.trim()).filter(Boolean),
    };
    const res = await fetch('/api/v1/profile', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const json = await res.json();
    setMsg(res.ok ? 'Profil disimpan ✓' : json.error ?? 'Gagal menyimpan');
  }

  return (
    <section className="settings-panel">
      <h2>Profil Bisnis</h2>
      <div className="form-grid">
        {field('name', 'Nama Perusahaan')}
        {field('email', 'Email')}
        {field('address', 'Alamat', { textarea: true, full: true })}
        {field('phone', 'Telepon')}
        {field('logo_url', 'Logo (URL / path, mis. /logo.jpg)')}
        {field('tax_rate', 'PPN (%)')}
        {field('bank_name', 'Nama Bank')}
        {field('bank_account', 'No. Rekening')}
        {field('bank_holder', 'Atas Nama')}
        <div className="form-group full-width">
          <label>Syarat & Ketentuan default (pisahkan tiap poin dengan baris kosong)</label>
          <textarea rows={8} value={termsText} onChange={(e) => setTermsText(e.target.value)} />
        </div>
      </div>
      <div className="form-actions">
        <button className="btn btn-primary" onClick={save}>Simpan Profil</button>
        {msg && <span className="muted" style={{ alignSelf: 'center' }}>{msg}</span>}
      </div>
    </section>
  );
}
