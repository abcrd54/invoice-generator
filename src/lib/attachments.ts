import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError, getDocument } from './documents';
import type { DocumentRow } from './types';

/** Bukti transfer (gambar) disimpan di Supabase Storage bucket privat "attachments". */

const BUCKET = 'attachments';
const MAX_BYTES = 5 * 1024 * 1024;
const EXT: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

export async function uploadProof(db: SupabaseClient, idOrNumber: string, bytes: ArrayBuffer, contentType: string): Promise<DocumentRow> {
  const mime = contentType.split(';')[0].trim().toLowerCase();
  if (!EXT[mime]) throw new AppError('bukti transfer harus gambar PNG, JPG, atau WEBP');
  if (bytes.byteLength === 0) throw new AppError('file kosong');
  if (bytes.byteLength > MAX_BYTES) throw new AppError('ukuran gambar maksimal 5 MB');

  const doc = await getDocument(db, idOrNumber);
  const path = `${doc.id}/proof-${Date.now()}.${EXT[mime]}`;
  const up = await db.storage.from(BUCKET).upload(path, bytes, { contentType: mime });
  if (up.error) throw new AppError(up.error.message, 500);

  const { data, error } = await db.from('documents').update({ proof_path: path }).eq('id', doc.id).select('*').single();
  if (error) throw new AppError(error.message, 500);
  if (doc.proof_path) await db.storage.from(BUCKET).remove([doc.proof_path]);
  return data as DocumentRow;
}

export async function removeProof(db: SupabaseClient, idOrNumber: string): Promise<DocumentRow> {
  const doc = await getDocument(db, idOrNumber);
  const { data, error } = await db.from('documents').update({ proof_path: null }).eq('id', doc.id).select('*').single();
  if (error) throw new AppError(error.message, 500);
  if (doc.proof_path) await db.storage.from(BUCKET).remove([doc.proof_path]);
  return data as DocumentRow;
}

export async function proofUrl(db: SupabaseClient, path: string | null): Promise<string | null> {
  if (!path) return null;
  const { data } = await db.storage.from(BUCKET).createSignedUrl(path, 60 * 60);
  return data?.signedUrl ?? null;
}

/** Unduh gambar dari URL publik (mis. link file Telegram yang diberikan agent). */
export async function fetchImage(url: string): Promise<{ bytes: ArrayBuffer; contentType: string }> {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    throw new AppError('image_url tidak valid');
  }
  const host = u.hostname;
  if (u.protocol !== 'https:' || host === 'localhost' || /^(127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.|\[)/.test(host)) {
    throw new AppError('image_url harus https ke host publik');
  }
  const res = await fetch(u, { signal: AbortSignal.timeout(15000), redirect: 'follow' });
  if (!res.ok) throw new AppError(`gagal mengunduh gambar (HTTP ${res.status})`);
  if (Number(res.headers.get('content-length') ?? 0) > MAX_BYTES) throw new AppError('ukuran gambar maksimal 5 MB');
  return { bytes: await res.arrayBuffer(), contentType: res.headers.get('content-type') ?? '' };
}

/** Terima gambar base64 (boleh berupa data URL). */
export function decodeBase64Image(b64: string, mime?: string): { bytes: ArrayBuffer; contentType: string } {
  const m = /^data:([^;]+);base64,(.*)$/s.exec(b64);
  const buf = Buffer.from(m ? m[2] : b64, 'base64');
  return {
    bytes: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer,
    contentType: m ? m[1] : mime ?? 'image/jpeg',
  };
}
