import { requireUser } from '@/lib/session';
import { getProfile, listTypes } from '@/lib/documents';
import { ProfileForm } from '@/components/ProfileForm';

export default async function SettingsPage() {
  const { db } = await requireUser();
  const [profile, types] = await Promise.all([getProfile(db), listTypes(db)]);
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000').replace(/\/$/, '');

  return (
    <>
      <ProfileForm profile={profile} />

      <section>
        <h2>Jenis Dokumen / Form</h2>
        <p className="muted" style={{ marginBottom: 12 }}>
          Form baru (req ongkir, req iklan, dll) dibuat oleh agent lewat tool <code>upsert_document_type</code> — cukup kirim contoh formatnya ke agent.
        </p>
        {types.map((t) => (
          <div key={t.slug} className="type-card">
            <strong>{t.name}</strong> <span className="muted">({t.slug} · nomor {t.number_prefix}/MMYYDD/xxx)</span>
            {t.description && <div className="muted">{t.description}</div>}
            {t.layout === 'generic' && (
              <div className="muted">Field: {t.fields.map((f) => `${f.label}${f.required ? '*' : ''}`).join(', ')}</div>
            )}
            {t.example && (
              <details>
                <summary className="muted">Contoh format</summary>
                <pre>{t.example}</pre>
              </details>
            )}
          </div>
        ))}
      </section>

      <section>
        <h2>Koneksi Agent (Hermes / Claude)</h2>
        <div className="type-card">
          <div><strong>MCP endpoint:</strong> <code>{appUrl}/api/mcp</code></div>
          <div><strong>REST API:</strong> <code>{appUrl}/api/v1/documents</code></div>
          <div><strong>Header:</strong> <code>Authorization: Bearer &lt;AGENT_API_KEY&gt;</code></div>
          <div className="muted" style={{ marginTop: 6 }}>
            AGENT_API_KEY diatur di environment variable Vercel. Lihat AGENT.md di repo untuk cara menghubungkan Hermes Agent.
          </div>
        </div>
      </section>
    </>
  );
}
