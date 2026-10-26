import { z } from 'zod';
import type { SupabaseClient } from '@supabase/supabase-js';
import { todayISO } from './format';
import type {
  BusinessProfile,
  DocumentData,
  DocumentRow,
  DocumentType,
  FieldDef,
  GenericData,
  InvoiceData,
  LineItem,
  Party,
  PaymentRequestData,
} from './types';

/**
 * Lapisan service bersama untuk UI, REST API, dan MCP.
 * Semua perhitungan (subtotal, PPN, total) dan penomoran dilakukan di sini,
 * jadi agent cukup mengirim data mentah.
 */

export class AppError extends Error {
  constructor(message: string, public status = 400) {
    super(message);
  }
}

// ---------- helper parsing (toleran terhadap input agent: "1.500.000", "Rp 250rb" tidak, tapi "250000" ya) ----------

const money = z.preprocess((v) => {
  if (typeof v === 'string') {
    const digits = v.replace(/[^0-9]/g, '');
    return digits === '' ? 0 : Number(digits);
  }
  return v ?? 0;
}, z.number().nonnegative());

const qty = z.preprocess((v) => (typeof v === 'string' ? Number(v.replace(',', '.')) : v ?? 1), z.number().nonnegative());

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'format tanggal harus YYYY-MM-DD');

const itemInput = z.object({
  description: z.string().default(''),
  qty: qty.default(1),
  rate: money.default(0),
});

const partyInput = z.object({
  name: z.string().default(''),
  phone: z.string().default(''),
  address: z.string().default(''),
});

export const invoiceInput = z.object({
  date: isoDate.optional(),
  dueDate: isoDate.optional(),
  dueInDays: z.number().int().nonnegative().optional(),
  billTo: partyInput,
  sendTo: partyInput.partial().optional(),
  items: z.array(itemInput).min(1, 'minimal 1 item'),
  ppnEnabled: z.boolean().optional(),
  taxRate: z.number().nonnegative().optional(),
  diskon: money.optional(),
  ongkir: money.optional(),
  notes: z.string().optional(),
  payment: z
    .object({
      method: z.string(),
      bankName: z.string(),
      bankAccount: z.string(),
      bankHolder: z.string(),
    })
    .partial()
    .optional(),
  terms: z.array(z.string()).optional(),
});
export type InvoiceInput = z.input<typeof invoiceInput>;

export const genericInput = z.object({
  date: isoDate.optional(),
  values: z.record(z.string(), z.union([z.string(), z.number()])).default({}),
  items: z.array(itemInput).optional(),
  notes: z.string().optional(),
});

export const paymentRequestInput = z.object({
  date: isoDate.optional(),
  items: z.array(itemInput).min(1, 'minimal 1 item'),
  refInvoice: z.string().optional(),
  rekening: z
    .object({ bank: z.string().optional(), number: z.coerce.string().optional(), name: z.string().optional() })
    .optional(),
  taxEnabled: z.boolean().optional(),
  taxRate: z.number().nonnegative().optional(),
  diskon: money.optional(),
  biayaLain: money.optional(),
  notes: z.string().optional(),
});

export const fieldDefSchema = z.object({
  key: z.string().regex(/^[a-zA-Z][a-zA-Z0-9_]*$/, 'key hanya huruf/angka/underscore'),
  label: z.string().min(1),
  type: z.enum(['text', 'textarea', 'number', 'money', 'date', 'phone', 'select']),
  required: z.boolean().optional(),
  options: z.array(z.string()).optional(),
  help: z.string().optional(),
});

export const documentTypeInput = z.object({
  slug: z.string().regex(/^[a-z0-9_]+$/, 'slug hanya huruf kecil, angka, underscore'),
  name: z.string().min(1),
  description: z.string().default(''),
  number_prefix: z.string().min(1),
  layout: z.enum(['generic', 'payment_request']).default('generic'),
  fields: z.array(fieldDefSchema).default([]),
  has_items: z.boolean().default(false),
  defaults: z.record(z.string(), z.unknown()).optional(),
  statuses: z.array(z.object({ value: z.string().min(1), label: z.string().min(1) })).optional(),
  example: z.string().default(''),
});

// ---------- perhitungan ----------

function computeItems(items: z.output<typeof itemInput>[]): LineItem[] {
  return items
    .filter((it) => it.description.trim() || it.qty > 0 || it.rate > 0)
    .map((it) => ({ description: it.description.trim(), qty: it.qty, rate: it.rate, amount: Math.round(it.qty * it.rate) }));
}

export function normalizeInvoice(raw: unknown, profile: BusinessProfile): InvoiceData {
  const input = parseOrThrow(invoiceInput, raw);
  const date = input.date ?? todayISO();
  const dueDate =
    input.dueDate ??
    new Date(new Date(date + 'T00:00:00Z').getTime() + (input.dueInDays ?? 30) * 86400000).toISOString().slice(0, 10);

  const billTo: Party = { name: input.billTo.name.trim(), phone: input.billTo.phone, address: input.billTo.address };
  if (!billTo.name) throw new AppError('billTo.name (nama customer) wajib diisi');
  const sendTo: Party = input.sendTo
    ? { name: input.sendTo.name ?? '', phone: input.sendTo.phone ?? '', address: input.sendTo.address ?? '' }
    : { ...billTo };

  const items = computeItems(input.items);
  if (items.length === 0) throw new AppError('minimal 1 item');

  const ppnEnabled = input.ppnEnabled ?? true;
  // taxRate 0 tersimpan saat PPN dimatikan; jika PPN dinyalakan lagi pakai tarif profil
  const taxRate = ppnEnabled ? input.taxRate || profile.tax_rate : 0;
  const subtotal = items.reduce((s, it) => s + it.amount, 0);
  const taxAmount = Math.round(subtotal * (taxRate / 100));
  const diskon = input.diskon ?? 0;
  const ongkir = input.ongkir ?? 0;

  return {
    date,
    dueDate,
    billTo,
    sendTo,
    items,
    ppnEnabled,
    taxRate,
    diskon,
    ongkir,
    notes: input.notes ?? '',
    payment: {
      method: input.payment?.method ?? 'Bank Transfer',
      bankName: input.payment?.bankName ?? profile.bank_name,
      bankAccount: input.payment?.bankAccount ?? profile.bank_account,
      bankHolder: input.payment?.bankHolder ?? profile.bank_holder,
    },
    terms: input.terms ?? profile.default_terms,
    subtotal,
    taxAmount,
    total: subtotal + taxAmount - diskon + ongkir,
  };
}

export function normalizePaymentRequest(raw: unknown, profile: BusinessProfile): PaymentRequestData {
  const input = parseOrThrow(paymentRequestInput, raw);
  const items = computeItems(input.items);
  if (items.length === 0) throw new AppError('minimal 1 item');

  const taxEnabled = input.taxEnabled ?? false;
  const taxRate = taxEnabled ? input.taxRate || profile.tax_rate : 0;
  const subtotal = items.reduce((s, it) => s + it.amount, 0);
  const taxAmount = Math.round(subtotal * (taxRate / 100));
  const diskon = input.diskon ?? 0;
  const biayaLain = input.biayaLain ?? 0;

  return {
    date: input.date ?? todayISO(),
    items,
    refInvoice: input.refInvoice?.trim() ?? '',
    rekening: {
      bank: input.rekening?.bank?.trim() ?? '',
      number: input.rekening?.number?.trim() ?? '',
      name: input.rekening?.name?.trim() ?? '',
    },
    taxEnabled,
    taxRate,
    diskon,
    biayaLain,
    notes: input.notes ?? '',
    subtotal,
    taxAmount,
    total: subtotal + taxAmount - diskon + biayaLain,
  };
}

export function normalizeGeneric(raw: unknown, type: DocumentType): GenericData {
  const input = parseOrThrow(genericInput, raw);
  const values: Record<string, string | number> = {};
  const missing: string[] = [];

  for (const f of type.fields) {
    let v = input.values[f.key];
    if (v === undefined || v === '') {
      if (f.required) missing.push(`${f.key} (${f.label})`);
      continue;
    }
    if (f.type === 'number' || f.type === 'money') {
      const n = f.type === 'money' ? Number(String(v).replace(/[^0-9]/g, '')) : Number(String(v).replace(',', '.'));
      if (isNaN(n)) throw new AppError(`field ${f.key} harus angka`);
      v = n;
    } else {
      v = String(v);
    }
    values[f.key] = v;
  }
  if (missing.length) throw new AppError(`field wajib belum diisi: ${missing.join(', ')}`);

  const items = type.has_items ? computeItems(input.items ?? []) : [];
  const subtotal = items.reduce((s, it) => s + it.amount, 0);
  const moneyTotal = type.fields
    .filter((f) => f.type === 'money')
    .reduce((s, f) => s + (Number(values[f.key]) || 0), 0);

  return {
    date: input.date ?? todayISO(),
    values,
    items,
    notes: input.notes ?? '',
    subtotal,
    total: type.has_items ? subtotal : moneyTotal,
  };
}

function titleFor(type: DocumentType, data: DocumentData): string {
  if (type.layout === 'invoice') return (data as InvoiceData).billTo.name;
  if (type.layout === 'payment_request') return (data as PaymentRequestData).items.map((it) => it.description).join(', ');
  const g = data as GenericData;
  const first = type.fields.find((f) => g.values[f.key] !== undefined && f.type !== 'money' && f.type !== 'number');
  return first ? String(g.values[first.key]) : '';
}

function parseOrThrow<T extends z.ZodType>(schema: T, raw: unknown): z.output<T> {
  const r = schema.safeParse(raw);
  if (!r.success) {
    throw new AppError(r.error.issues.map((i) => `${i.path.join('.') || 'data'}: ${i.message}`).join('; '));
  }
  return r.data;
}

/** Nomor: PREFIX/MMYYDD/xxx (mengikuti format lama POLY/INV/MMYYDD/xxx). */
function makeNumber(prefix: string, date: string): string {
  const [yyyy, mm, dd] = date.split('-');
  const rand = String(Math.floor(Math.random() * 900) + 100);
  return `${prefix}/${mm}${yyyy.slice(-2)}${dd}/${rand}`;
}

// ---------- akses database ----------

const DEFAULT_PROFILE: BusinessProfile = {
  name: 'Polyline',
  email: '',
  address: '',
  phone: '',
  logo_url: '/logo.jpg',
  tax_rate: 11,
  bank_name: '',
  bank_account: '',
  bank_holder: '',
  default_terms: [],
};

export async function getProfile(db: SupabaseClient): Promise<BusinessProfile> {
  const { data, error } = await db.from('business_profile').select('*').eq('id', 1).maybeSingle();
  if (error) throw new AppError(error.message, 500);
  return { ...DEFAULT_PROFILE, ...(data ?? {}), tax_rate: Number(data?.tax_rate ?? 11) };
}

export const profileInput = z
  .object({
    name: z.string(),
    email: z.string(),
    address: z.string(),
    phone: z.string(),
    logo_url: z.string(),
    tax_rate: z.number().min(0).max(100),
    bank_name: z.string(),
    bank_account: z.string(),
    bank_holder: z.string(),
    default_terms: z.array(z.string()),
  })
  .partial();

export async function updateProfile(db: SupabaseClient, raw: unknown): Promise<BusinessProfile> {
  const patch = parseOrThrow(profileInput, raw);
  const { error } = await db.from('business_profile').upsert({ id: 1, ...patch });
  if (error) throw new AppError(error.message, 500);
  return getProfile(db);
}

export async function listTypes(db: SupabaseClient): Promise<DocumentType[]> {
  const { data, error } = await db.from('document_types').select('*').order('created_at');
  if (error) throw new AppError(error.message, 500);
  return data as DocumentType[];
}

export async function getType(db: SupabaseClient, slug: string): Promise<DocumentType> {
  const { data, error } = await db.from('document_types').select('*').eq('slug', slug).maybeSingle();
  if (error) throw new AppError(error.message, 500);
  if (!data) throw new AppError(`jenis dokumen "${slug}" tidak ada. Gunakan list_document_types.`, 404);
  return data as DocumentType;
}

export async function upsertType(db: SupabaseClient, raw: unknown): Promise<DocumentType> {
  const input = parseOrThrow(documentTypeInput, raw);
  if (input.slug === 'invoice') throw new AppError('jenis "invoice" bawaan tidak bisa diubah lewat sini');
  const row: Record<string, unknown> = { ...input };
  if (!input.statuses) delete row.statuses;
  if (!input.defaults) delete row.defaults;
  if (input.layout === 'generic' && input.fields.length === 0) throw new AppError('layout generic butuh minimal 1 field');
  const { data, error } = await db.from('document_types').upsert(row).select('*').single();
  if (error) throw new AppError(error.message, 500);
  return data as DocumentType;
}

export interface ListFilter {
  type?: string;
  status?: string;
  search?: string;
  limit?: number;
}

export async function listDocuments(db: SupabaseClient, f: ListFilter = {}): Promise<DocumentRow[]> {
  let q = db.from('documents').select('*').order('created_at', { ascending: false }).limit(Math.min(f.limit ?? 50, 200));
  if (f.type) q = q.eq('type', f.type);
  if (f.status) q = q.eq('status', f.status);
  if (f.search) {
    const s = f.search.replace(/[%,()]/g, ' ');
    q = q.or(`title.ilike.%${s}%,number.ilike.%${s}%`);
  }
  const { data, error } = await q;
  if (error) throw new AppError(error.message, 500);
  return data as DocumentRow[];
}

/** Ambil dokumen berdasarkan id (uuid) atau nomor dokumen. */
export async function getDocument(db: SupabaseClient, idOrNumber: string): Promise<DocumentRow> {
  const isUuid = /^[0-9a-f-]{36}$/i.test(idOrNumber);
  const { data, error } = await db
    .from('documents')
    .select('*')
    .eq(isUuid ? 'id' : 'number', idOrNumber)
    .maybeSingle();
  if (error) throw new AppError(error.message, 500);
  if (!data) throw new AppError(`dokumen "${idOrNumber}" tidak ditemukan`, 404);
  return data as DocumentRow;
}

export async function getDocumentByToken(db: SupabaseClient, token: string): Promise<DocumentRow | null> {
  const { data } = await db.from('documents').select('*').eq('share_token', token).maybeSingle();
  return (data as DocumentRow) ?? null;
}

export function normalizeFor(type: DocumentType, raw: unknown, profile: BusinessProfile): DocumentData {
  if (type.layout === 'invoice') return normalizeInvoice(raw, profile);
  if (type.layout === 'payment_request') return normalizePaymentRequest(raw, profile);
  return normalizeGeneric(raw, type);
}

function checkStatus(type: DocumentType, status: string) {
  if (!type.statuses.some((s) => s.value === status)) {
    throw new AppError(`status "${status}" tidak valid untuk ${type.slug}. Pilihan: ${type.statuses.map((s) => s.value).join(', ')}`);
  }
}

export async function createDocument(
  db: SupabaseClient,
  args: { type: string; data: unknown; status?: string; source?: 'web' | 'agent' },
): Promise<DocumentRow> {
  const [type, profile] = await Promise.all([getType(db, args.type), getProfile(db)]);
  const data = normalizeFor(type, deepMerge(type.defaults ?? {}, args.data), profile);
  const status = args.status ?? 'DRAFT';
  checkStatus(type, status);

  for (let attempt = 0; attempt < 8; attempt++) {
    const { data: row, error } = await db
      .from('documents')
      .insert({
        type: type.slug,
        number: makeNumber(type.number_prefix, data.date),
        status,
        title: titleFor(type, data),
        data,
        total: data.total,
        source: args.source ?? 'web',
      })
      .select('*')
      .single();
    if (!error) return row as DocumentRow;
    if (error.code !== '23505') throw new AppError(error.message, 500); // 23505 = nomor bentrok, coba lagi
  }
  throw new AppError('gagal membuat nomor dokumen unik, coba lagi', 500);
}

function deepMerge(base: unknown, patch: unknown): unknown {
  if (Array.isArray(patch) || typeof patch !== 'object' || patch === null) return patch;
  if (typeof base !== 'object' || base === null || Array.isArray(base)) return patch;
  const out: Record<string, unknown> = { ...(base as Record<string, unknown>) };
  for (const [k, v] of Object.entries(patch)) out[k] = deepMerge(out[k], v);
  return out;
}

/**
 * Update dokumen. `data` di-merge ke data lama (objek di-merge, array diganti utuh),
 * lalu dihitung ulang. Kirim `replace: true` untuk mengganti data seluruhnya.
 */
export async function updateDocument(
  db: SupabaseClient,
  idOrNumber: string,
  args: { data?: unknown; status?: string; replace?: boolean },
): Promise<DocumentRow> {
  const existing = await getDocument(db, idOrNumber);
  const [type, profile] = await Promise.all([getType(db, existing.type), getProfile(db)]);
  const patch: Record<string, unknown> = {};

  if (args.data !== undefined) {
    const raw = args.replace ? args.data : deepMerge(existing.data, args.data);
    const data = normalizeFor(type, raw, profile);
    Object.assign(patch, { data, total: data.total, title: titleFor(type, data) });
  }
  if (args.status !== undefined) {
    checkStatus(type, args.status);
    patch.status = args.status;
  }
  if (Object.keys(patch).length === 0) return existing;

  const { data: row, error } = await db.from('documents').update(patch).eq('id', existing.id).select('*').single();
  if (error) throw new AppError(error.message, 500);
  return row as DocumentRow;
}

export async function deleteDocument(db: SupabaseClient, idOrNumber: string): Promise<void> {
  const existing = await getDocument(db, idOrNumber);
  const { error } = await db.from('documents').delete().eq('id', existing.id);
  if (error) throw new AppError(error.message, 500);
  if (existing.proof_path) await db.storage.from('attachments').remove([existing.proof_path]);
}

export function shareUrl(doc: Pick<DocumentRow, 'share_token'>): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_PROJECT_PRODUCTION_URL || 'http://localhost:3000').replace(/\/$/, '');
  return `${base.startsWith('http') ? base : 'https://' + base}/p/${doc.share_token}`;
}

/** Ringkasan dokumen untuk respon API/agent. */
export function summarize(doc: DocumentRow) {
  return {
    id: doc.id,
    type: doc.type,
    number: doc.number,
    status: doc.status,
    title: doc.title,
    total: Number(doc.total),
    has_proof: Boolean(doc.proof_path),
    created_at: doc.created_at,
    url: shareUrl(doc),
    pdf_url: `${shareUrl(doc)}/pdf`,
  };
}

export type { FieldDef };
