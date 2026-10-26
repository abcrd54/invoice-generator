import type { SupabaseClient } from '@supabase/supabase-js';
import { decodeBase64Image, fetchImage, uploadProof } from './attachments';
import {
  AppError,
  createDocument,
  getDocument,
  getProfile,
  listDocuments,
  listTypes,
  summarize,
  updateDocument,
  upsertType,
} from './documents';

/** Tool yang diekspos ke agent lewat MCP (/api/mcp). */

const partySchema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    phone: { type: 'string' },
    address: { type: 'string' },
  },
};

const itemsSchema = {
  type: 'array',
  items: {
    type: 'object',
    properties: {
      description: { type: 'string' },
      qty: { type: 'number' },
      rate: { type: 'number', description: 'harga satuan dalam rupiah, angka bulat (1500000, bukan "1,5jt")' },
    },
    required: ['description', 'qty', 'rate'],
  },
};

export const SERVER_INSTRUCTIONS = `Server dokumen bisnis Polyline: invoice dan Form Request Payment (req_ongkir, req_ads, dll).
Alur kerja:
1. Panggil list_document_types dulu untuk melihat jenis dokumen, field-nya, dan contoh format (example) dari user.
2. Ubah permintaan user menjadi data terstruktur sesuai field, lalu create_document. Server yang menghitung subtotal, PPN, total, dan nomor dokumen — jangan hitung sendiri.
3. Untuk form request payment, lampirkan bukti transfer dengan attach_proof jika user mengirim gambar.
4. Balas user dengan nomor dokumen, total, dan url (link untuk lihat/cetak PDF).
Jika user memberi contoh format form baru, buat jenisnya dengan upsert_document_type (simpan contoh asli di "example").
Semua uang dalam rupiah sebagai angka bulat. Tanggal format YYYY-MM-DD (zona WIB). Tanyakan ke user jika data wajib kurang, jangan mengarang.`;

export const TOOLS = [
  {
    name: 'list_document_types',
    description: 'Daftar jenis dokumen (invoice, form lain), beserta field, status yang valid, dan contoh format dari user. Panggil ini sebelum membuat dokumen.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'get_business_profile',
    description: 'Profil bisnis: nama, alamat, rekening bank default, tarif PPN, syarat & ketentuan default.',
    inputSchema: { type: 'object', properties: {} },
  },
  {
    name: 'create_document',
    description: `Buat dokumen baru. Mengembalikan nomor, total, dan url untuk dicetak.
Untuk type "invoice", data = {
  billTo: {name, phone, address}  (name wajib),
  sendTo?: {name, phone, address} (jika tidak diisi = sama dengan billTo),
  items: [{description, qty, rate}] (minimal 1),
  ppnEnabled?: boolean (default true), diskon?: number, ongkir?: number, notes?: string,
  date?: "YYYY-MM-DD" (default hari ini), dueDate? atau dueInDays? (default 30 hari),
  payment?: {bankName, bankAccount, bankHolder} (default dari profil), terms?: string[]
}
Untuk layout "payment_request" (req_ongkir, req_ads, ...), data = {
  items: [{description, qty, rate}] (minimal 1),
  refInvoice?: string (nomor invoice terkait, mis. untuk ongkir),
  taxEnabled?: boolean (default dari jenis: req_ads = true / 11%, req_ongkir = false),
  diskon?: number, biayaLain?: number (biaya admin/lainnya), notes?: string (mis. "Transfer ke rekening BCA Pak Sola"), date?
}
Untuk layout "generic", data = { values: { <key field>: nilai, ... }, items?: [...] (jika has_items), notes?, date? }.`,
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string', description: 'slug jenis dokumen, mis. "invoice"' },
        status: { type: 'string', description: 'default DRAFT' },
        data: {
          type: 'object',
          properties: {
            billTo: partySchema,
            sendTo: partySchema,
            items: itemsSchema,
            ppnEnabled: { type: 'boolean' },
            diskon: { type: 'number' },
            ongkir: { type: 'number' },
            notes: { type: 'string' },
            date: { type: 'string' },
            dueDate: { type: 'string' },
            dueInDays: { type: 'number' },
            refInvoice: { type: 'string' },
            taxEnabled: { type: 'boolean' },
            biayaLain: { type: 'number' },
            values: { type: 'object', description: 'untuk layout generic' },
          },
        },
      },
      required: ['type', 'data'],
    },
  },
  {
    name: 'list_documents',
    description: 'Cari dokumen. Filter opsional: type, status, search (nama customer / nomor).',
    inputSchema: {
      type: 'object',
      properties: {
        type: { type: 'string' },
        status: { type: 'string' },
        search: { type: 'string' },
        limit: { type: 'number', description: 'default 20' },
      },
    },
  },
  {
    name: 'get_document',
    description: 'Ambil detail lengkap satu dokumen berdasarkan id atau nomor (mis. POLY/INV/102626/123).',
    inputSchema: { type: 'object', properties: { id: { type: 'string' } }, required: ['id'] },
  },
  {
    name: 'update_document',
    description:
      'Ubah dokumen. "data" di-merge ke data lama (objek digabung, array seperti items diganti utuh — kirim daftar items lengkap). "status" untuk ubah status, mis. PAID = Lunas (stempel LUNAS muncul di invoice). Total dihitung ulang otomatis.',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'id atau nomor dokumen' },
        data: { type: 'object' },
        status: { type: 'string' },
      },
      required: ['id'],
    },
  },
  {
    name: 'attach_proof',
    description:
      'Lampirkan gambar bukti transfer ke dokumen (tampil di sisi kanan Form Request Payment). Kirim image_url (https publik) atau image_base64. Lampiran lama diganti. Alternatif untuk file lokal: POST multipart ke /api/v1/documents/<id>/proof (field "file").',
    inputSchema: {
      type: 'object',
      properties: {
        id: { type: 'string', description: 'id atau nomor dokumen' },
        image_url: { type: 'string' },
        image_base64: { type: 'string', description: 'base64 atau data URL' },
        mime: { type: 'string', description: 'image/png | image/jpeg | image/webp' },
      },
      required: ['id'],
    },
  },
  {
    name: 'upsert_document_type',
    description: `Buat atau perbarui jenis dokumen/form baru berdasarkan contoh format dari user.
layout "payment_request": Form Request Payment (item + pajak + biaya lain + note + bukti transfer) — pakai ini untuk request pembayaran baru (mis. req_packing); fields boleh kosong; defaults mis. {"taxEnabled": true}.
layout "generic": form bebas berbasis fields.
fields: [{key, label, type, required?, options?, help?}], type salah satu: text, textarea, number, money, date, phone, select.
has_items: true jika form punya daftar item (deskripsi/qty/harga). Simpan contoh asli dari user di "example".`,
    inputSchema: {
      type: 'object',
      properties: {
        slug: { type: 'string', description: 'huruf kecil + underscore, mis. req_ongkir' },
        name: { type: 'string' },
        description: { type: 'string' },
        number_prefix: { type: 'string', description: 'mis. POLY/REQ-PCK' },
        layout: { type: 'string', enum: ['generic', 'payment_request'] },
        defaults: { type: 'object', description: 'nilai default data saat dokumen dibuat' },
        fields: {
          type: 'array',
          items: {
            type: 'object',
            properties: {
              key: { type: 'string' },
              label: { type: 'string' },
              type: { type: 'string', enum: ['text', 'textarea', 'number', 'money', 'date', 'phone', 'select'] },
              required: { type: 'boolean' },
              options: { type: 'array', items: { type: 'string' } },
              help: { type: 'string' },
            },
            required: ['key', 'label', 'type'],
          },
        },
        has_items: { type: 'boolean' },
        statuses: {
          type: 'array',
          items: { type: 'object', properties: { value: { type: 'string' }, label: { type: 'string' } }, required: ['value', 'label'] },
        },
        example: { type: 'string' },
      },
      required: ['slug', 'name', 'number_prefix'],
    },
  },
] as const;

type Args = Record<string, unknown>;

export async function callTool(db: SupabaseClient, name: string, args: Args): Promise<unknown> {
  const str = (k: string) => (typeof args[k] === 'string' ? (args[k] as string) : undefined);
  switch (name) {
    case 'list_document_types':
      return { document_types: await listTypes(db) };
    case 'get_business_profile':
      return { profile: await getProfile(db) };
    case 'create_document': {
      const doc = await createDocument(db, { type: str('type') ?? '', data: args.data, status: str('status'), source: 'agent' });
      return { ...summarize(doc), data: doc.data };
    }
    case 'list_documents': {
      const docs = await listDocuments(db, {
        type: str('type'),
        status: str('status'),
        search: str('search'),
        limit: typeof args.limit === 'number' ? args.limit : 20,
      });
      return { documents: docs.map(summarize) };
    }
    case 'get_document': {
      const doc = await getDocument(db, str('id') ?? '');
      return { ...summarize(doc), data: doc.data };
    }
    case 'update_document': {
      const doc = await updateDocument(db, str('id') ?? '', { data: args.data, status: str('status') });
      return { ...summarize(doc), data: doc.data };
    }
    case 'attach_proof': {
      const img =
        typeof args.image_url === 'string'
          ? await fetchImage(args.image_url)
          : typeof args.image_base64 === 'string'
            ? decodeBase64Image(args.image_base64, str('mime'))
            : null;
      if (!img) throw new AppError('kirim image_url atau image_base64');
      return summarize(await uploadProof(db, str('id') ?? '', img.bytes, img.contentType));
    }
    case 'upsert_document_type':
      return { document_type: await upsertType(db, args) };
    default:
      throw new AppError(`tool tidak dikenal: ${name}`, 404);
  }
}
