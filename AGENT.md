# Menghubungkan Agent

Semua akses agent memakai header `Authorization: Bearer <AGENT_API_KEY>`.
Server yang menghitung total & membuat nomor dokumen — agent cukup mengirim data mentah.

## MCP (disarankan)

Endpoint: `https://<domain-kamu>/api/mcp` (Streamable HTTP).

Tools:
| Tool | Fungsi |
|---|---|
| `list_document_types` | Jenis dokumen + field + contoh format |
| `get_business_profile` | Profil bisnis, rekening, PPN default |
| `create_document` | Buat invoice / form → dapat nomor, total, link PDF |
| `list_documents` | Cari dokumen (type, status, nama/nomor) |
| `get_document` | Detail dokumen (by id atau nomor) |
| `update_document` | Ubah data / status (mis. `PAID` → stempel LUNAS) |
| `attach_proof` | Lampirkan gambar bukti transfer ke Form Request Payment |
| `upsert_document_type` | Buat jenis form baru dari contoh format |

### Hermes Agent
Tambahkan server MCP HTTP di konfigurasi Hermes (`~/.hermes/config.yaml`), kurang lebih:
```yaml
mcp_servers:
  polyline:
    url: "https://<domain-kamu>/api/mcp"
    headers:
      Authorization: "Bearer <AGENT_API_KEY>"
```
Setelah mengubah config, jalankan `/reload-mcp` di Hermes (atau restart gateway).

### Hermes via WhatsApp
Hermes punya gateway WhatsApp bawaan (bridge WhatsApp Web / Baileys, tidak perlu URL publik). Di VPS:
```bash
hermes whatsapp            # pilih mode "bot" (nomor khusus) lalu scan QR:
                           # WhatsApp → Setelan → Perangkat tertaut → Tautkan perangkat
```
`~/.hermes/.env`:
```env
WHATSAPP_ENABLED=true
WHATSAPP_MODE=bot
WHATSAPP_ALLOWED_USERS=6281234567890,6289876543210   # nomor yang boleh pakai bot, tanpa "+"
```
Jalankan sebagai service supaya tetap hidup: `sudo hermes gateway install --system`.

Catatan:
- Pakai **nomor khusus** untuk bot (bukan nomor utama) — bridge ini tidak resmi, ada risiko nomor dibatasi WhatsApp.
- Folder `~/.hermes/platforms/whatsapp/session` = akses penuh ke akun WA; jangan dibagikan.
- Bukti transfer: kirim foto ke bot. Hermes menyimpan file-nya di VPS lalu meng-upload pakai `curl -F file=@...`
  ke `/api/v1/documents/<id>/proof` (lihat bagian Request Payment). Jangan kirim gambar sebagai base64 lewat tool.

### Claude Code / Claude Desktop
```bash
claude mcp add --transport http polyline https://<domain-kamu>/api/mcp \
  --header "Authorization: Bearer <AGENT_API_KEY>"
```

## Form Request Payment (req ongkir, req ads)
Layout `payment_request` (A4 landscape, bukti transfer di kanan). Jenis bawaan:
- `req_ongkir` (POLY/REQ-ONG/...) — tanpa pajak, bisa isi `refInvoice` (nomor invoice terkait).
- `req_ads` (POLY/REQ-ADS/...) — pajak 11% aktif, ada `biayaLain` (biaya admin).

Keduanya punya `rekening: { bank, number, name }` (rekening tujuan), tampil di bawah kotak NOTE.

Contoh permintaan ke agent:
> req ads shopee: Lola Chair 1 pcs 3.500.000, biaya lain 1.000, rekening tujuan BCA 1234567890 a.n. Sola. (+ kirim foto bukti transfer)

> req ongkir Lampung J&T Cargo 1.292.000 untuk invoice POLY/INV/102620/344, rekening tujuan Mandiri 1370012345678 a.n. Antoine.

Upload bukti transfer dari file lokal (mis. Hermes menerima foto dari Telegram):
```bash
curl -X POST https://<domain>/api/v1/documents/<id>/proof \
  -H "Authorization: Bearer $AGENT_API_KEY" -F "file=@bukti.jpg"
```

## Menambah form baru
Kirim contoh format ke agent, misalnya:

> Buat jenis request baru "Request Packing" seperti req ongkir, prefix POLY/REQ-PCK.

Agent akan memanggil `upsert_document_type` (layout `payment_request` atau `generic`) dan menyimpan contohmu.

## REST API
| Method | Path | Body |
|---|---|---|
| GET | `/api/v1/document-types` | |
| POST | `/api/v1/document-types` | sama seperti `upsert_document_type` |
| GET | `/api/v1/documents?type=&status=&search=&limit=` | |
| POST | `/api/v1/documents` | `{ "type": "invoice", "data": {...}, "status": "DRAFT" }` |
| GET | `/api/v1/documents/:id` | id atau nomor (URL-encode `/` → `%2F`) |
| PATCH | `/api/v1/documents/:id` | `{ "data": {...patch}, "status": "PAID" }` |
| DELETE | `/api/v1/documents/:id` | |
| POST | `/api/v1/documents/:id/proof` | multipart `file`, atau JSON `{image_url}` / `{image_base64, mime}` |
| DELETE | `/api/v1/documents/:id/proof` | |
| GET/PATCH | `/api/v1/profile` | |

Contoh:
```bash
curl -X POST https://<domain>/api/v1/documents \
  -H "Authorization: Bearer $AGENT_API_KEY" -H "Content-Type: application/json" \
  -d '{"type":"invoice","data":{"billTo":{"name":"Budi","phone":"0812..."},
       "items":[{"description":"Kursi jati","qty":2,"rate":1500000}],"ongkir":250000,"ppnEnabled":false}}'
```
