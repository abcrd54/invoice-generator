'use client';

import { formatRupiah } from '@/lib/format';

export interface ItemDraft {
  description: string;
  qty: string;
  rate: string;
}

export const emptyItem = (): ItemDraft => ({ description: '', qty: '1', rate: '' });

const digits = (v: string) => v.replace(/[^0-9]/g, '').replace(/^0+(?=\d)/, '');

export function ItemsEditor({ items, onChange }: { items: ItemDraft[]; onChange: (items: ItemDraft[]) => void }) {
  const set = (i: number, patch: Partial<ItemDraft>) => onChange(items.map((it, j) => (j === i ? { ...it, ...patch } : it)));

  return (
    <>
      <table className="items-table">
        <thead>
          <tr>
            <th style={{ width: 40 }}>#</th>
            <th>Deskripsi</th>
            <th style={{ width: 80 }}>Qty</th>
            <th style={{ width: 140 }}>Harga Satuan</th>
            <th style={{ width: 140 }}>Jumlah</th>
            <th style={{ width: 50 }} />
          </tr>
        </thead>
        <tbody>
          {items.map((it, i) => (
            <tr key={i}>
              <td style={{ textAlign: 'center' }}>{i + 1}</td>
              <td>
                <input placeholder="Deskripsi item" value={it.description} onChange={(e) => set(i, { description: e.target.value })} />
              </td>
              <td>
                <input type="number" min="0" value={it.qty} onChange={(e) => set(i, { qty: e.target.value })} />
              </td>
              <td>
                <input inputMode="numeric" placeholder="0" value={it.rate} onChange={(e) => set(i, { rate: digits(e.target.value) })} />
              </td>
              <td>
                <input readOnly value={formatRupiah((Number(it.qty) || 0) * (Number(it.rate) || 0))} />
              </td>
              <td>
                <button
                  type="button"
                  className="btn-remove"
                  title="Hapus"
                  onClick={() => (items.length <= 1 ? alert('Minimal harus ada 1 item') : onChange(items.filter((_, j) => j !== i)))}
                >
                  ×
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <button type="button" className="btn btn-sm" onClick={() => onChange([...items, emptyItem()])}>
        + Tambah Item
      </button>
    </>
  );
}

export function MoneyInput({ value, onChange, id }: { value: string; onChange: (v: string) => void; id?: string }) {
  return <input id={id} inputMode="numeric" placeholder="0" value={value} onChange={(e) => onChange(digits(e.target.value))} />;
}

export function toItemDrafts(items: { description: string; qty: number; rate: number }[] | undefined): ItemDraft[] {
  if (!items?.length) return [emptyItem()];
  return items.map((it) => ({ description: it.description, qty: String(it.qty), rate: String(it.rate) }));
}
