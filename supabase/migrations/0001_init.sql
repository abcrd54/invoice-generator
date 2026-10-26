-- Invoice Generator: skema awal
-- Jalankan di Supabase → SQL Editor (atau `supabase db push`).

-- ============ Profil bisnis (satu baris) ============
create table if not exists public.business_profile (
  id            int primary key default 1 check (id = 1),
  name          text not null default 'Polyline',
  email         text not null default '',
  address       text not null default '',
  phone         text not null default '',
  logo_url      text not null default '/logo.jpg',
  tax_rate      numeric not null default 11,
  bank_name     text not null default '',
  bank_account  text not null default '',
  bank_holder   text not null default '',
  default_terms jsonb not null default '[]'::jsonb,
  updated_at    timestamptz not null default now()
);

-- ============ Jenis dokumen (invoice, req ongkir, req iklan, ...) ============
-- `fields` adalah daftar field form: [{ key, label, type, required, options?, help? }]
--   type: text | textarea | number | money | date | phone | select
-- `example` adalah contoh format dari user, dipakai agent sebagai acuan.
create table if not exists public.document_types (
  slug          text primary key check (slug ~ '^[a-z0-9_]+$'),
  name          text not null,
  description   text not null default '',
  number_prefix text not null,
  layout        text not null default 'generic' check (layout in ('invoice', 'generic')),
  fields        jsonb not null default '[]'::jsonb,
  has_items     boolean not null default false,
  statuses      jsonb not null default '[{"value":"DRAFT","label":"Draft"},{"value":"SENT","label":"Terkirim"},{"value":"DONE","label":"Selesai"}]'::jsonb,
  example       text not null default '',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- ============ Dokumen ============
create table if not exists public.documents (
  id          uuid primary key default gen_random_uuid(),
  type        text not null references public.document_types(slug) on update cascade,
  number      text not null unique,
  status      text not null default 'DRAFT',
  title       text not null default '',
  data        jsonb not null default '{}'::jsonb,
  total       numeric not null default 0,
  share_token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  source      text not null default 'web' check (source in ('web', 'agent')),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists documents_type_created_idx on public.documents (type, created_at desc);
create index if not exists documents_title_idx on public.documents using gin (to_tsvector('simple', title));

-- updated_at otomatis
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists documents_touch on public.documents;
create trigger documents_touch before update on public.documents
  for each row execute function public.touch_updated_at();
drop trigger if exists document_types_touch on public.document_types;
create trigger document_types_touch before update on public.document_types
  for each row execute function public.touch_updated_at();
drop trigger if exists business_profile_touch on public.business_profile;
create trigger business_profile_touch before update on public.business_profile
  for each row execute function public.touch_updated_at();

-- ============ RLS ============
-- Aplikasi dipakai satu bisnis: semua user yang login boleh akses.
-- API agent memakai service role (bypass RLS) setelah cek AGENT_API_KEY.
alter table public.business_profile enable row level security;
alter table public.document_types enable row level security;
alter table public.documents enable row level security;

drop policy if exists "auth all" on public.business_profile;
create policy "auth all" on public.business_profile for all to authenticated using (true) with check (true);
drop policy if exists "auth all" on public.document_types;
create policy "auth all" on public.document_types for all to authenticated using (true) with check (true);
drop policy if exists "auth all" on public.documents;
create policy "auth all" on public.documents for all to authenticated using (true) with check (true);

-- ============ Seed ============
insert into public.business_profile (id, name, address, bank_name, bank_account, bank_holder, default_terms)
values (
  1,
  'Polyline',
  E'Jl. Ngabul - Batealit No.KM. 4, Godang, Mindahan, Kec. Batealit,\nKabupaten Jepara, Jawa Tengah 59461',
  'CIMB NIAGA',
  '800206032000',
  'MAJU ABADI KREATIVA',
  jsonb_build_array(
    E'Order will be processed and shipped after full payment is received.\nPesanan akan diproses dan dikirim setelah pembayaran diterima secara penuh.',
    E'Shipping cost and delivery time depend on the selected shipping method.\nBiaya pengiriman dan waktu pengiriman tergantung pada metode pengiriman yang dipilih.',
    E'The product includes a 6-month warranty for normal use.\nProduk memiliki garansi 6 bulan untuk pemakaian normal.'
  )
)
on conflict (id) do nothing;

insert into public.document_types (slug, name, description, number_prefix, layout, has_items, statuses, example)
values (
  'invoice',
  'Invoice',
  'Invoice penjualan dengan Bill To / Send To, item, PPN, diskon, dan ongkir.',
  'POLY/INV',
  'invoice',
  true,
  '[{"value":"DRAFT","label":"Draft"},{"value":"SENT","label":"Terkirim"},{"value":"PAID","label":"Lunas"},{"value":"OVERDUE","label":"Jatuh Tempo"}]'::jsonb,
  E'Invoice untuk Budi Santoso (0812-3456-7890, Jl. Merdeka 1 Semarang).\nKirim ke alamat yang sama.\nItem: Kursi jati 2 x 1.500.000, Meja makan 1 x 3.250.000.\nOngkir 250.000, tanpa PPN.'
)
on conflict (slug) do nothing;
