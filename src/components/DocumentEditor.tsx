'use client';

import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { normalizeGeneric, normalizeInvoice, normalizePaymentRequest, shareUrl } from '@/lib/documents';
import { formatRupiah, todayISO } from '@/lib/format';
import type { BusinessProfile, DocumentRow, DocumentType, GenericData, InvoiceData, Party, PaymentRequestData } from '@/lib/types';
import { DocumentView } from './DocumentView';
import { ItemsEditor, MoneyInput, toItemDrafts, type ItemDraft } from './ItemsEditor';
import { DeleteButton } from './DeleteButton';
import { withProgress } from './NavProgress';

interface Props {
  type: DocumentType;
  profile: BusinessProfile;
  doc?: DocumentRow;
  proofUrl?: string | null;
}

const emptyParty = (): Party => ({ name: '', phone: '', address: '' });

export function DocumentEditor({ type, profile, doc, proofUrl }: Props) {
  const router = useRouter();
  const [status, setStatus] = useState(doc?.status ?? 'DRAFT');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [refreshing, startRefresh] = useTransition();
  const refresh = () => startRefresh(() => router.refresh());
  const [error, setError] = useState('');
  const [preview, setPreview] = useState(false);

  // --- state invoice ---
  const inv = doc && type.layout === 'invoice' ? (doc.data as InvoiceData) : undefined;
  const [date, setDate] = useState(doc?.data.date ?? todayISO());
  const [dueDate, setDueDate] = useState(inv?.dueDate ?? todayISO(30));
  const [billTo, setBillTo] = useState<Party>(inv?.billTo ?? emptyParty());
  const [sendTo, setSendTo] = useState<Party>(inv?.sendTo ?? emptyParty());
  const [ppnEnabled, setPpnEnabled] = useState(inv ? inv.ppnEnabled : true);
  const [diskon, setDiskon] = useState(String(inv?.diskon ?? 0));
  const [ongkir, setOngkir] = useState(String(inv?.ongkir ?? 0));

  // --- state generic ---
  const gen = doc && type.layout === 'generic' ? (doc.data as GenericData) : undefined;
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(type.fields.map((f) => [f.key, gen?.values[f.key] !== undefined ? String(gen.values[f.key]) : ''])),
  );

  // --- state payment request ---
  const pr = doc && type.layout === 'payment_request' ? (doc.data as PaymentRequestData) : undefined;
  const [refInvoice, setRefInvoice] = useState(pr?.refInvoice ?? '');
  const [rekening, setRekening] = useState(pr?.rekening ?? { bank: '', number: '', name: '' });
  const [taxEnabled, setTaxEnabled] = useState(pr ? pr.taxEnabled : type.defaults?.taxEnabled === true);
  const [prDiskon, setPrDiskon] = useState(String(pr?.diskon ?? 0));
  const [biayaLain, setBiayaLain] = useState(String(pr?.biayaLain ?? 0));
  const [proofFile, setProofFile] = useState<File | null>(null);
  const localProof = useMemo(() => (proofFile ? URL.createObjectURL(proofFile) : null), [proofFile]);

  // --- bersama ---
  const [items, setItems] = useState<ItemDraft[]>(toItemDrafts(doc?.data.items));
  const [notes, setNotes] = useState(doc?.data.notes ?? '');

  function payload(): Record<string, unknown> {
    if (type.layout === 'invoice') {
      return {
        date,
        dueDate,
        billTo,
        sendTo,
        items,
        ppnEnabled,
        diskon,
        ongkir,
        notes,
        // pertahankan rekening & syarat milik dokumen ini (default dari profil untuk dokumen baru)
        payment: inv?.payment,
        terms: inv?.terms,
      };
    }
    if (type.layout === 'payment_request') {
      return { date, items, refInvoice, rekening, taxEnabled, diskon: prDiskon, biayaLain, notes };
    }
    return { date, values, items: type.has_items ? items : undefined, notes };
  }

  // Hitung ulang total dengan logika yang sama seperti server
  const computed = useMemo(() => {
    try {
      const p = payload();
      if (type.layout === 'invoice') {
        return normalizeInvoice({ ...p, billTo: { ...billTo, name: billTo.name || '-' } }, profile);
      }
      if (type.layout === 'payment_request') return normalizePaymentRequest(p, profile);
      const lenient = { ...type, fields: type.fields.map((f) => ({ ...f, required: false })) };
      return normalizeGeneric(p, lenient);
    } catch {
      return null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [date, dueDate, billTo, sendTo, items, ppnEnabled, diskon, ongkir, notes, values, refInvoice, rekening, taxEnabled, prDiskon, biayaLain]);

  async function uploadProof(id: string, file: File) {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`/api/v1/documents/${id}/proof`, { method: 'POST', body: form });
    if (!res.ok) throw new Error((await res.json()).error ?? 'Gagal upload bukti transfer');
  }

  async function removeProof() {
    if (!doc || !confirm('Hapus bukti transfer?')) return;
    const res = await withProgress(() => fetch(`/api/v1/documents/${doc.id}/proof`, { method: 'DELETE' }));
    if (!res.ok) return setError((await res.json()).error ?? 'Gagal menghapus');
    refresh();
  }

  async function save() {
    setSaving(true);
    setError('');
    await withProgress(doSave);
    setSaving(false);
  }

  async function doSave() {
    const res = await fetch(doc ? `/api/v1/documents/${doc.id}` : '/api/v1/documents', {
      method: doc ? 'PATCH' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(doc ? { data: payload(), status, replace: true } : { type: type.slug, data: payload(), status }),
    });
    const json = await res.json();
    if (res.ok && proofFile) {
      try {
        await uploadProof(json.document.id, proofFile);
      } catch (e) {
        setError((e as Error).message);
      }
    }
    if (!res.ok) return setError(json.error ?? 'Gagal menyimpan');
    if (!doc) startRefresh(() => router.replace(`/documents/${json.document.id}`));
    else refresh();
  }

  const partyFields = (label: string, p: Party, set: (p: Party) => void) => (
    <div>
      <h3>{label}</h3>
      <div className="form-group">
        <label>Nama</label>
        <input value={p.name} onChange={(e) => set({ ...p, name: e.target.value })} placeholder="Nama perusahaan / individu" />
      </div>
      <div className="form-group">
        <label>No. HP</label>
        <input value={p.phone} onChange={(e) => set({ ...p, phone: e.target.value })} placeholder="+62 812-xxxx-xxxx" />
      </div>
      <div className="form-group">
        <label>Alamat</label>
        <textarea rows={3} value={p.address} onChange={(e) => set({ ...p, address: e.target.value })} />
      </div>
    </div>
  );

  return (
    <section className="invoice-form">
      <h2>{doc ? `Edit ${type.name}` : `Buat ${type.name} Baru`}</h2>
      {error && <div className="error-msg">{error}</div>}

      <div className="form-grid">
        <div className="form-group">
          <label>No. Dokumen</label>
          <input readOnly value={doc?.number ?? '(otomatis saat disimpan)'} />
        </div>
        <div className="form-group">
          <label>Tanggal</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>
        {type.layout === 'invoice' && (
          <div className="form-group">
            <label>Jatuh Tempo</label>
            <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
        )}
        <div className="form-group">
          <label>Status</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)}>
            {type.statuses.map((s) => (
              <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>
      </div>

      <hr />

      {type.layout === 'invoice' ? (
        <>
          <div className="form-grid two-col">
            {partyFields('Bill To', billTo, setBillTo)}
            {partyFields('Send To', sendTo, setSendTo)}
          </div>
          <button type="button" className="btn btn-sm" onClick={() => setSendTo({ ...billTo })}>
            Salin Bill To → Send To
          </button>
          <hr />
        </>
      ) : type.layout === 'payment_request' ? null : (
        <>
          <div className="form-grid">
            {type.fields.map((f) => (
              <div key={f.key} className={`form-group ${f.type === 'textarea' ? 'full-width' : ''}`}>
                <label>
                  {f.label}
                  {f.required && ' *'}
                </label>
                {f.type === 'textarea' ? (
                  <textarea rows={3} value={values[f.key]} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })} />
                ) : f.type === 'select' ? (
                  <select value={values[f.key]} onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}>
                    <option value="">-</option>
                    {(f.options ?? []).map((o) => (
                      <option key={o}>{o}</option>
                    ))}
                  </select>
                ) : f.type === 'money' ? (
                  <MoneyInput value={values[f.key]} onChange={(v) => setValues({ ...values, [f.key]: v })} />
                ) : (
                  <input
                    type={f.type === 'date' ? 'date' : f.type === 'number' ? 'number' : 'text'}
                    value={values[f.key]}
                    onChange={(e) => setValues({ ...values, [f.key]: e.target.value })}
                  />
                )}
                {f.help && <span className="muted">{f.help}</span>}
              </div>
            ))}
          </div>
          <hr />
        </>
      )}

      {(type.layout !== 'generic' || type.has_items) && (
        <>
          <h3>Item</h3>
          <ItemsEditor items={items} onChange={setItems} />
        </>
      )}

      {type.layout === 'invoice' && (
        <>
          <div className="ppn-toggle" style={{ marginTop: 12 }}>
            <input type="checkbox" id="ppn" checked={ppnEnabled} onChange={(e) => setPpnEnabled(e.target.checked)} />
            <label htmlFor="ppn">Gunakan PPN</label>
          </div>
          <div className="totals-section">
            <div className="totals-row">
              <span>Subtotal</span>
              <span>{formatRupiah(computed?.subtotal)}</span>
            </div>
            <div className="totals-row">
              <span>PPN ({(computed as InvoiceData | null)?.taxRate ?? 0}%)</span>
              <span>{formatRupiah((computed as InvoiceData | null)?.taxAmount)}</span>
            </div>
            <div className="totals-row input-row">
              <span>Diskon</span>
              <MoneyInput value={diskon} onChange={setDiskon} />
            </div>
            <div className="totals-row input-row">
              <span>Ongkir</span>
              <MoneyInput value={ongkir} onChange={setOngkir} />
            </div>
            <div className="totals-row total-final">
              <span>TOTAL</span>
              <span>{formatRupiah(computed?.total)}</span>
            </div>
          </div>
        </>
      )}

      {type.layout === 'payment_request' && (
        <>
          <div className="form-grid" style={{ marginTop: 12 }}>
            <div className="form-group">
              <label>Referensi Invoice (opsional)</label>
              <input value={refInvoice} onChange={(e) => setRefInvoice(e.target.value)} placeholder="POLY/INV/102620/344" />
            </div>
          </div>
          <h3 style={{ marginTop: 12 }}>Rekening Tujuan</h3>
          <div className="form-grid">
            <div className="form-group">
              <label>Bank</label>
              <input value={rekening.bank} onChange={(e) => setRekening({ ...rekening, bank: e.target.value })} placeholder="BCA" />
            </div>
            <div className="form-group">
              <label>No. Rekening</label>
              <input value={rekening.number} onChange={(e) => setRekening({ ...rekening, number: e.target.value })} placeholder="1234567890" inputMode="numeric" />
            </div>
            <div className="form-group full-width">
              <label>Atas Nama</label>
              <input value={rekening.name} onChange={(e) => setRekening({ ...rekening, name: e.target.value })} placeholder="Sola" />
            </div>
          </div>
          <div className="ppn-toggle">
            <input type="checkbox" id="tax" checked={taxEnabled} onChange={(e) => setTaxEnabled(e.target.checked)} />
            <label htmlFor="tax">Pakai pajak ({profile.tax_rate}%)</label>
          </div>
          <div className="totals-section">
            <div className="totals-row">
              <span>Subtotal</span>
              <span>{formatRupiah(computed?.subtotal)}</span>
            </div>
            <div className="totals-row">
              <span>Tax</span>
              <span>{formatRupiah((computed as PaymentRequestData | null)?.taxAmount)}</span>
            </div>
            <div className="totals-row input-row">
              <span>Diskon</span>
              <MoneyInput value={prDiskon} onChange={setPrDiskon} />
            </div>
            <div className="totals-row input-row">
              <span>Biaya Lainnya</span>
              <MoneyInput value={biayaLain} onChange={setBiayaLain} />
            </div>
            <div className="totals-row total-final">
              <span>Grand Total</span>
              <span>{formatRupiah(computed?.total)}</span>
            </div>
          </div>
          <hr />
          <div className="form-group full-width">
            <label>Bukti Transfer (gambar)</label>
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              disabled={uploading}
              onChange={async (e) => {
                const file = e.target.files?.[0] ?? null;
                if (file && doc) {
                  setUploading(true);
                  try {
                    await withProgress(() => uploadProof(doc.id, file));
                    refresh();
                  } catch (err) {
                    setError((err as Error).message);
                  }
                  setUploading(false);
                } else setProofFile(file);
              }}
            />
            {uploading && (
              <div className="muted" style={{ marginTop: 6 }}>
                <span className="spinner" /> Mengupload bukti transfer...
              </div>
            )}
            {(localProof || proofUrl) && (
              <div style={{ marginTop: 8, display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={localProof ?? proofUrl!} alt="Bukti transfer" style={{ maxHeight: 220, border: '1px solid #ddd' }} />
                {doc?.proof_path && !localProof && (
                  <button type="button" className="btn btn-sm btn-danger" onClick={removeProof}>
                    Hapus
                  </button>
                )}
              </div>
            )}
          </div>
        </>
      )}

      {type.layout === 'generic' && (type.has_items || computed?.total) ? (
        <div className="totals-section">
          <div className="totals-row total-final">
            <span>TOTAL</span>
            <span>{formatRupiah(computed?.total)}</span>
          </div>
        </div>
      ) : null}

      <hr />

      <div className="form-group full-width">
        <label>{type.layout === 'payment_request' ? 'Note' : 'Catatan'}</label>
        <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Catatan tambahan..." />
      </div>

      <div className="form-actions">
        <button className="btn btn-primary" onClick={save} disabled={saving || refreshing}>
          {saving || refreshing ? (
            <>
              <span className="spinner" />
              Menyimpan...
            </>
          ) : (
            '💾 Simpan'
          )}
        </button>
        <button className="btn btn-success" onClick={() => setPreview(true)} disabled={!computed}>
          👁️ Preview
        </button>
        {doc && (
          <a className="btn btn-success" href={`/p/${doc.share_token}`} target="_blank">
            🖨️ Cetak PDF
          </a>
        )}
        {doc && <DeleteButton id={doc.id} redirectTo="/" />}
      </div>
      {doc && (
        <p className="muted" style={{ marginTop: 8 }}>
          Link share (tanpa login): <code>{shareUrl(doc)}</code>
        </p>
      )}

      {preview && computed && (
        <div className="modal" onClick={() => setPreview(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>Preview</h2>
              <button className="btn btn-sm" onClick={() => setPreview(false)}>✕ Tutup</button>
            </div>
            <div className="preview-body">
              <DocumentView number={doc?.number ?? '(belum disimpan)'} status={status} data={computed} type={type} biz={profile} proofUrl={localProof ?? proofUrl} />
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
