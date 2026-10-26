import Link from 'next/link';
import { requireUser } from '@/lib/session';
import { listDocuments, listTypes } from '@/lib/documents';
import { formatDate, formatRupiah } from '@/lib/format';
import { DeleteButton } from '@/components/DeleteButton';

type SP = Promise<{ type?: string; status?: string; q?: string }>;

export default async function Dashboard({ searchParams }: { searchParams: SP }) {
  const { db } = await requireUser();
  const sp = await searchParams;
  const types = await listTypes(db);
  const activeType = types.find((t) => t.slug === sp.type);
  const docs = await listDocuments(db, { type: sp.type, status: sp.status, search: sp.q, limit: 100 });
  const typeBySlug = Object.fromEntries(types.map((t) => [t.slug, t]));

  const href = (type?: string) => (type ? `/?type=${type}` : '/');

  return (
    <section className="invoice-list">
      <h2>Dokumen</h2>

      <div className="tabs">
        <Link className={`btn btn-sm ${!sp.type ? 'active' : ''}`} href={href()}>Semua</Link>
        {types.map((t) => (
          <Link key={t.slug} className={`btn btn-sm ${sp.type === t.slug ? 'active' : ''}`} href={href(t.slug)}>
            {t.name}
          </Link>
        ))}
      </div>

      <form className="toolbar">
        {sp.type && <input type="hidden" name="type" value={sp.type} />}
        <input name="q" placeholder="Cari nama / nomor..." defaultValue={sp.q ?? ''} />
        {activeType && (
          <select name="status" defaultValue={sp.status ?? ''}>
            <option value="">Semua status</option>
            {activeType.statuses.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        )}
        <button className="btn btn-sm">Cari</button>
        <span className="spacer" />
        {(activeType ? [activeType] : types).map((t) => (
          <Link key={t.slug} className="btn btn-primary btn-sm" href={`/documents/new?type=${t.slug}`}>
            + {t.name}
          </Link>
        ))}
      </form>

      {docs.length === 0 && <p className="empty-msg">Belum ada dokumen.</p>}

      {docs.map((d) => {
        const t = typeBySlug[d.type];
        const statusLabel = t?.statuses.find((s) => s.value === d.status)?.label ?? d.status;
        return (
          <div key={d.id} className="invoice-item">
            <div className="inv-info">
              <span className="inv-no">{d.number}</span>
              <span className={`badge badge-${d.status.toLowerCase()}`}>{statusLabel}</span>
              {d.source === 'agent' && <span className="badge badge-agent" title="Dibuat oleh agent">🤖 agent</span>}
              <div className="inv-client">
                {t?.name ?? d.type} · {d.title || '-'}
              </div>
              <div className="inv-date">{formatDate(d.data.date)}</div>
            </div>
            <div className="inv-amount">{formatRupiah(Number(d.total))}</div>
            <div className="inv-actions">
              <Link className="btn btn-sm" href={`/documents/${d.id}`}>✏️ Edit</Link>
              <a className="btn btn-sm btn-success" href={`/p/${d.share_token}`} target="_blank">🖨️ PDF</a>
              <DeleteButton id={d.id} />
            </div>
          </div>
        );
      })}
    </section>
  );
}
