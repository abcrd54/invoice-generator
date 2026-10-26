-- Form Request Payment (req ongkir, req ads, ...) + bukti transfer

alter table public.document_types drop constraint if exists document_types_layout_check;
alter table public.document_types
  add constraint document_types_layout_check check (layout in ('invoice', 'generic', 'payment_request'));

-- Nilai default yang di-merge ke data saat dokumen dibuat (mis. pajak aktif untuk req ads)
alter table public.document_types add column if not exists defaults jsonb not null default '{}'::jsonb;

-- Path file bukti transfer di Supabase Storage (bucket "attachments")
alter table public.documents add column if not exists proof_path text;

insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do nothing;

insert into public.document_types (slug, name, description, number_prefix, layout, has_items, statuses, defaults, example)
values
(
  'req_ongkir',
  'Request Ongkir',
  'Form Request Payment untuk biaya ongkir/pengiriman. Biasanya mereferensikan nomor invoice dan tanpa pajak.',
  'POLY/REQ-ONG',
  'payment_request',
  true,
  '[{"value":"DRAFT","label":"Draft"},{"value":"SUBMITTED","label":"Diajukan"},{"value":"PAID","label":"Dibayar"}]'::jsonb,
  '{"taxEnabled": false}'::jsonb,
  E'FORM REQUEST PAYMENT — Date 09/10/26\nDescription: Ongkir pengiriman Lampung (J&T Cargo), QTY 1, Price Rp 1.292.000\nINVOICE : POLY/INV/102620/344\nSubtotal Rp 1.292.000, Tax -, Diskon -, Grand Total Rp 1.292.000\nNOTE: Transfer ke Nomer Rekening Pak Antoine\n+ lampiran bukti transfer (screenshot Jenius)'
),
(
  'req_ads',
  'Request Ads',
  'Form Request Payment untuk biaya iklan / marketplace (Shopee Ads, dll). Biasanya kena pajak 11% dan biaya admin.',
  'POLY/REQ-ADS',
  'payment_request',
  true,
  '[{"value":"DRAFT","label":"Draft"},{"value":"SUBMITTED","label":"Diajukan"},{"value":"PAID","label":"Dibayar"}]'::jsonb,
  '{"taxEnabled": true}'::jsonb,
  E'FORM REQUEST PAYMENT — Date 09/10/26\nDescription: POLYLINE Lola Chair (1 pcs), QTY 1, Price Rp 3.500.000\nSubtotal Rp 3.500.000, Tax Rp 385.000 (11%), Biaya Lainnya Rp 1.000, Grand Total Rp 3.886.000\nNOTE: Transfer ke rekening BCA Pak Sola\n+ lampiran bukti transfer (screenshot BCA, Shopee VA)'
)
on conflict (slug) do nothing;
