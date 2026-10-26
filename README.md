# Polyline Documents (Invoice Generator v2)

Next.js + Supabase, deploy di Vercel. Mendukung invoice dan jenis form lain (req ongkir, req iklan, ...)
yang bisa dibuat & diisi oleh agent AI (Hermes Agent, Claude, dll) lewat MCP / REST API.

```
[Telegram/WA/CLI] → Agent (Hermes/Claude) ──MCP──► Next.js di Vercel ──► Supabase
                                                    (UI + /api/v1 + /api/mcp)
```

Versi lama (HTML/JS + localStorage) disimpan di `legacy/`.

## Setup

### 1. Supabase
1. Buat project di https://supabase.com.
2. **SQL Editor** → jalankan isi `supabase/migrations/0001_init.sql`, lalu `0002_payment_request.sql`.
3. **Authentication → Users → Add user**: buat akun login (email + password) untuk kamu/tim.
4. **Authentication → Sign In / Providers**: matikan *Allow new users to sign up* supaya orang lain tidak bisa daftar.
5. **Project Settings → API**: catat `Project URL`, *publishable key*, dan *secret key* (menu API Keys).

### 2. Lokal
```bash
cp .env.example .env.local   # isi nilainya
npm install
npm run dev                  # http://localhost:3000
```

### 3. Vercel
1. Import repo ini di https://vercel.com/new (framework terdeteksi otomatis: Next.js).
2. Isi Environment Variables sesuai `.env.example`
   (`NEXT_PUBLIC_APP_URL` = domain Vercel kamu, mis. `https://polyline-docs.vercel.app`).
3. Deploy.

## Fitur
- Login (Supabase Auth), data di Supabase — bisa diakses dari device mana pun.
- Invoice: Bill To / Send To, item, PPN, diskon, ongkir, stempel LUNAS, nomor `POLY/INV/MMYYDD/xxx`.
- Form Request Payment (req ongkir, req ads) A4 landscape + upload bukti transfer (Supabase Storage).
- Jenis dokumen generic: field didefinisikan di tabel `document_types`, form & tampilan cetak otomatis.
- Link share `/p/<token>` untuk lihat & cetak PDF tanpa login (token acak per dokumen).
- API untuk agent: lihat [AGENT.md](AGENT.md).
