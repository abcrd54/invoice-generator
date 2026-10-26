-- Bot WhatsApp: riwayat chat per nomor + penanda pesan masuk (WhatsApp bisa mengirim webhook yang sama lebih dari sekali)

create table if not exists wa_messages (
  id bigserial primary key,
  phone text not null,
  role text not null check (role in ('user', 'assistant')),
  content text not null,
  created_at timestamptz not null default now()
);
create index if not exists wa_messages_phone_idx on wa_messages (phone, id desc);

create table if not exists wa_inbound (
  message_id text primary key,
  phone text not null,
  created_at timestamptz not null default now()
);

-- Hanya diakses server (secret key); tidak ada policy untuk user login
alter table wa_messages enable row level security;
alter table wa_inbound enable row level security;
