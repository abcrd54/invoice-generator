import type { CSSProperties, ReactNode } from 'react';
import { formatDate, formatRupiah } from '@/lib/format';
import type { BusinessProfile, DocumentData, DocumentType, GenericData, InvoiceData, LineItem, PaymentRequestData } from '@/lib/types';

/** Tampilan dokumen siap cetak (A4). Port dari js/invoice-template.js versi lama. */

const muted: CSSProperties = { fontSize: 11, color: '#555' };
const th: CSSProperties = { background: '#222', color: '#fff', padding: '7px 10px', textAlign: 'left', fontSize: 11, fontWeight: 600 };
const boxStyle: CSSProperties = { flex: 1, background: '#f5f5f5', padding: '8px 12px', borderRadius: 3, borderLeft: '3px solid #222' };
const boxLabel: CSSProperties = { fontSize: 11, color: '#777', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 4, fontWeight: 600 };
const totalRow: CSSProperties = { display: 'flex', justifyContent: 'space-between', padding: '3px 0', fontSize: 12 };

function Lines({ text }: { text: string }) {
  return (
    <>
      {text.split('\n').map((l, i, arr) => (
        <span key={i}>
          {l}
          {i < arr.length - 1 && <br />}
        </span>
      ))}
    </>
  );
}

function Header({ biz, title, number, rows }: { biz: BusinessProfile; title: string; number: string; rows: [string, string][] }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 12, borderBottom: '2px solid #222', paddingBottom: 10 }}>
      <div>
        {biz.logo_url && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={biz.logo_url} alt="Logo" style={{ maxHeight: 70, maxWidth: 180, objectFit: 'contain' }} />
        )}
        <div style={{ ...muted, marginTop: 5 }}>
          <Lines text={biz.address} />
        </div>
        <div style={muted}>
          {biz.phone} {biz.email ? `| ${biz.email}` : ''}
        </div>
      </div>
      <div style={{ textAlign: 'right' }}>
        <div style={{ fontSize: 26, fontWeight: 800, color: '#222', letterSpacing: 2, textTransform: 'uppercase' }}>{title}</div>
        <table style={{ borderCollapse: 'collapse', marginLeft: 'auto', marginTop: 5 }}>
          <tbody>
            <tr>
              <td style={{ padding: '1px 8px 1px 0', color: '#777', fontSize: 11 }}>No.</td>
              <td style={{ padding: '1px 0', fontSize: 11, fontWeight: 600 }}>{number}</td>
            </tr>
            {rows.map(([k, v]) => (
              <tr key={k}>
                <td style={{ padding: '1px 8px 1px 0', color: '#777', fontSize: 11 }}>{k}</td>
                <td style={{ padding: '1px 0', fontSize: 11 }}>{v}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function ItemsTable({ items }: { items: LineItem[] }) {
  return (
    <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12 }}>
      <thead>
        <tr>
          <th style={{ ...th, width: 35 }}>#</th>
          <th style={th}>Deskripsi</th>
          <th style={{ ...th, textAlign: 'right', width: 55 }}>Qty</th>
          <th style={{ ...th, textAlign: 'right', width: 110 }}>Harga</th>
          <th style={{ ...th, textAlign: 'right', width: 110 }}>Jumlah</th>
        </tr>
      </thead>
      <tbody>
        {items.map((it, i) => (
          <tr key={i}>
            <td style={{ textAlign: 'center' }}>{i + 1}</td>
            <td>{it.description}</td>
            <td style={{ textAlign: 'right' }}>{it.qty}</td>
            <td style={{ textAlign: 'right' }}>{formatRupiah(it.rate)}</td>
            <td style={{ textAlign: 'right' }}>{formatRupiah(it.amount)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Notes({ notes }: { notes: string }) {
  if (!notes) return null;
  return (
    <div style={{ border: '1px solid #222', padding: '8px 12px', marginBottom: 10, fontSize: 11, color: '#444' }}>
      <strong style={{ display: 'block', marginBottom: 3, color: '#222' }}>Notes</strong>
      <Lines text={notes} />
    </div>
  );
}

function Signatures() {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 20 }}>
      {['Penerima', 'Hormat Kami'].map((l) => (
        <div key={l} style={{ textAlign: 'center', width: 160 }}>
          <div style={{ borderTop: '1px solid #222', marginTop: 40, paddingTop: 4, fontSize: 11, color: '#555' }}>{l}</div>
        </div>
      ))}
    </div>
  );
}

function Paper({ children }: { children: ReactNode }) {
  return (
    <div className="paper">
      <div style={{ fontFamily: "'Segoe UI',Tahoma,Geneva,Verdana,sans-serif", color: '#222', fontSize: 12, lineHeight: 1.5, padding: '10mm 12mm' }}>
        {children}
      </div>
    </div>
  );
}

export function InvoiceView({ number, status, data, biz }: { number: string; status: string; data: InvoiceData; biz: BusinessProfile }) {
  const isPaid = status === 'PAID';
  const terms = (data.terms ?? []).filter(Boolean);

  return (
    <Paper>
      <Header biz={biz} title="Invoice" number={number} rows={[['Tanggal', formatDate(data.date)], ['Jatuh Tempo', formatDate(data.dueDate)]]} />

      <div style={{ display: 'flex', gap: 14, marginBottom: 12 }}>
        {(
          [
            ['Bill To', data.billTo],
            ['Send To', data.sendTo],
          ] as const
        ).map(([label, p]) => (
          <div key={label} style={boxStyle}>
            <div style={boxLabel}>{label}</div>
            <div style={{ fontSize: 13, fontWeight: 600 }}>{p.name || '-'}</div>
            <div style={{ fontSize: 11, color: '#444' }}>{p.phone}</div>
            <div style={muted}>
              <Lines text={p.address} />
            </div>
          </div>
        ))}
      </div>

      <ItemsTable items={data.items} />

      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 14, marginBottom: 12, alignItems: 'stretch' }}>
        {isPaid ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <div style={{ border: '3px solid #222', padding: '6px 24px', fontSize: 22, fontWeight: 800, color: '#222', letterSpacing: 4, transform: 'rotate(-12deg)', borderRadius: 4 }}>
              LUNAS
            </div>
          </div>
        ) : data.payment.bankName ? (
          <div style={{ ...boxStyle, fontSize: 11, color: '#444' }}>
            <strong style={{ display: 'block', marginBottom: 3, color: '#222' }}>Payment Method: {data.payment.method || 'Bank Transfer'}</strong>
            {data.payment.bankName} - {data.payment.bankAccount}
            <br />
            a/n {data.payment.bankHolder}
          </div>
        ) : (
          <div style={{ flex: 1 }} />
        )}
        <div style={{ width: 240 }}>
          <div style={totalRow}>
            <span>Subtotal</span>
            <span>{formatRupiah(data.subtotal)}</span>
          </div>
          {data.ppnEnabled && (
            <div style={totalRow}>
              <span>PPN ({data.taxRate}%)</span>
              <span>{formatRupiah(data.taxAmount)}</span>
            </div>
          )}
          {data.diskon > 0 && (
            <div style={totalRow}>
              <span>Diskon</span>
              <span>- {formatRupiah(data.diskon)}</span>
            </div>
          )}
          {data.ongkir > 0 && (
            <div style={totalRow}>
              <span>Ongkir</span>
              <span>+ {formatRupiah(data.ongkir)}</span>
            </div>
          )}
          <div style={{ ...totalRow, padding: '5px 0', fontSize: 15, fontWeight: 700, borderTop: '2px solid #222', marginTop: 4 }}>
            <span>TOTAL</span>
            <span>{formatRupiah(data.total)}</span>
          </div>
        </div>
      </div>

      <Notes notes={data.notes} />

      {terms.length > 0 && (
        <div style={{ background: '#fafafa', padding: '8px 12px', borderRadius: 3, marginBottom: 12, fontSize: 10, color: '#555', border: '1px solid #ddd' }}>
          <strong style={{ display: 'block', marginBottom: 4, color: '#222', fontSize: 11 }}>Terms &amp; Conditions</strong>
          <ol style={{ margin: 0, paddingLeft: 16 }}>
            {terms.map((t, i) => (
              <li key={i} style={{ marginBottom: 3 }}>
                <Lines text={t} />
              </li>
            ))}
          </ol>
        </div>
      )}

      <Signatures />
    </Paper>
  );
}

export function GenericView({ number, data, type, biz }: { number: string; data: GenericData; type: DocumentType; biz: BusinessProfile }) {
  const fmt = (key: string) => {
    const f = type.fields.find((x) => x.key === key)!;
    const v = data.values[key];
    if (f.type === 'money') return formatRupiah(Number(v));
    if (f.type === 'date') return formatDate(String(v));
    return String(v);
  };
  const filled = type.fields.filter((f) => data.values[f.key] !== undefined && data.values[f.key] !== '');

  return (
    <Paper>
      <Header biz={biz} title={type.name} number={number} rows={[['Tanggal', formatDate(data.date)]]} />

      <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 12 }}>
        <tbody>
          {filled.map((f) => (
            <tr key={f.key} style={{ borderBottom: '1px solid #eee' }}>
              <td style={{ padding: '6px 10px 6px 0', width: '35%', color: '#555', fontWeight: 600, verticalAlign: 'top' }}>{f.label}</td>
              <td style={{ padding: '6px 0' }}>
                <Lines text={fmt(f.key)} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {type.has_items && data.items.length > 0 && (
        <>
          <ItemsTable items={data.items} />
          <div style={{ ...totalRow, width: 240, marginLeft: 'auto', fontSize: 15, fontWeight: 700, borderTop: '2px solid #222', marginBottom: 12 }}>
            <span>TOTAL</span>
            <span>{formatRupiah(data.total)}</span>
          </div>
        </>
      )}

      <Notes notes={data.notes} />
      <Signatures />
    </Paper>
  );
}

/** Format tanggal seperti di form lama: dd/mm/yy */
function shortDate(iso: string) {
  const [y, m, d] = iso.split('-');
  return d && m && y ? `${d}/${m}/${y.slice(-2)}` : iso;
}

function RpCell({ amount, size = 13 }: { amount: number; size?: number }) {
  return (
    <span style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: size }}>
      <span>Rp</span>
      <span>{amount ? amount.toLocaleString('id-ID') : '-'}</span>
    </span>
  );
}

/** Form Request Payment (req ongkir, req ads, ...) — A4 landscape dengan bukti transfer di kanan. */
export function PaymentRequestView({
  number,
  data,
  biz,
  proofUrl,
}: {
  number: string;
  data: PaymentRequestData;
  biz: BusinessProfile;
  proofUrl?: string | null;
}) {
  const line = '1.5px solid #111';
  const rows: ReactNode[] = data.items.map((it, i) => (
    <tr key={i} style={{ borderBottom: line }}>
      <td style={{ padding: '7px 4px' }}>{it.description}</td>
      <td style={{ textAlign: 'center' }}>{it.qty}</td>
      <td style={{ padding: '0 10px' }}>
        <RpCell amount={it.rate} />
      </td>
      <td style={{ padding: '0 4px 0 10px' }}>
        <RpCell amount={it.amount} />
      </td>
    </tr>
  ));
  if (data.refInvoice) {
    rows.push(
      <tr key="ref" style={{ borderBottom: line }}>
        <td colSpan={4} style={{ padding: '7px 4px', fontSize: 12 }}>INVOICE : {data.refInvoice}</td>
      </tr>,
    );
  }
  while (rows.length < 7) {
    rows.push(
      <tr key={`pad${rows.length}`} style={{ borderBottom: line, height: 36 }}>
        <td colSpan={4} />
      </tr>,
    );
  }

  const sumRow = (label: string, amount: number) => (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 12, fontSize: 14 }}>
      <span>{label}</span>
      <span style={{ fontSize: 11 }}>
        <RpCell amount={amount} size={11} />
      </span>
    </div>
  );

  return (
    <div className="paper landscape">
      <div style={{ display: 'flex', gap: '12mm', padding: '12mm 14mm', fontFamily: "'Segoe UI',Tahoma,Geneva,Verdana,sans-serif", color: '#111' }}>
        <div style={{ flex: 1 }}>
          {biz.logo_url && (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={biz.logo_url} alt="Logo" style={{ height: 40, objectFit: 'contain' }} />
          )}
          <div style={{ fontSize: 10, color: '#333', marginTop: 6, paddingBottom: 8, borderBottom: '4px solid #111' }}>
            <Lines text={biz.address} />
          </div>

          <div style={{ textAlign: 'right', fontSize: 13, fontWeight: 300, marginTop: 12, paddingRight: 30 }}>
            Date :<br />
            {shortDate(data.date)}
            <div style={{ fontSize: 9, color: '#888' }}>{number}</div>
          </div>
          <div style={{ textAlign: 'center', fontSize: 21, fontWeight: 300, letterSpacing: 0.5, margin: '2px 0 14px' }}>FORM REQUEST PAYMENT</div>

          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13, fontWeight: 300 }}>
            <thead>
              <tr style={{ background: '#000', color: '#fff', fontSize: 17 }}>
                <th style={{ textAlign: 'left', padding: '14px 4px', fontWeight: 300 }}>Description</th>
                <th style={{ width: 70, fontWeight: 300 }}>QTY</th>
                <th style={{ width: 130, fontWeight: 300 }}>Price</th>
                <th style={{ width: 130, fontWeight: 300 }}>Total</th>
              </tr>
            </thead>
            <tbody>{rows}</tbody>
          </table>

          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 24, marginTop: 16 }}>
            <div style={{ width: '55%', border: '1.5px solid #111' }}>
              <div style={{ background: '#000', color: '#fff', textAlign: 'center', fontWeight: 700, fontSize: 14, padding: 6 }}>NOTE</div>
              <div style={{ padding: '14px 10px', fontSize: 17, fontWeight: 300, textAlign: 'center' }}>
                <Lines text={data.notes || ' '} />
              </div>
            </div>
            <div style={{ flex: 1, fontWeight: 300, display: 'flex', flexDirection: 'column', gap: 2 }}>
              {sumRow('Subtotal', data.subtotal)}
              {sumRow(data.taxEnabled ? `Tax (${data.taxRate}%)` : 'Tax', data.taxAmount)}
              {(data.diskon > 0 || data.biayaLain === 0) && sumRow('Diskon', data.diskon)}
              {data.biayaLain > 0 && sumRow('Biaya Lainnya', data.biayaLain)}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 120px', gap: 12, fontSize: 16, marginTop: 4 }}>
                <span>Grand Total</span>
                <RpCell amount={data.total} size={16} />
              </div>
            </div>
          </div>
        </div>

        <div style={{ width: '34%', paddingTop: 30 }}>
          {proofUrl ? (
            <div style={{ background: '#ddd', padding: 10 }}>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={proofUrl} alt="Bukti transfer" style={{ width: '100%', maxHeight: '160mm', objectFit: 'contain', display: 'block' }} />
            </div>
          ) : (
            <div className="no-print" style={{ border: '2px dashed #ccc', color: '#aaa', padding: 40, textAlign: 'center', fontSize: 12 }}>Bukti transfer belum dilampirkan</div>
          )}
        </div>
      </div>
    </div>
  );
}

export function DocumentView(props: {
  number: string;
  status: string;
  data: DocumentData;
  type: DocumentType;
  biz: BusinessProfile;
  proofUrl?: string | null;
}) {
  if (props.type.layout === 'invoice') {
    return <InvoiceView number={props.number} status={props.status} data={props.data as InvoiceData} biz={props.biz} />;
  }
  if (props.type.layout === 'payment_request') {
    return <PaymentRequestView number={props.number} data={props.data as PaymentRequestData} biz={props.biz} proofUrl={props.proofUrl} />;
  }
  return <GenericView number={props.number} data={props.data as GenericData} type={props.type} biz={props.biz} />;
}
