import { timingSafeEqual } from 'node:crypto';
import { methodNotAllowed, serveMcp, unauthorized } from '@/lib/mcp-server';
import { createAdminClient } from '@/lib/supabase/server';

/**
 * MCP server untuk claude.ai (custom connector tidak bisa mengirim header Bearer):
 * kunci ada di path → https://<app>/api/mcp/<MCP_URL_KEY>. Jaga URL ini seperti password.
 */

function keyMatches(key: string): boolean {
  const expected = process.env.MCP_URL_KEY;
  if (!expected || expected.length < 32) return false; // nonaktif kalau belum diisi / terlalu pendek
  const a = Buffer.from(key);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function POST(req: Request, { params }: { params: Promise<{ key: string }> }) {
  if (!keyMatches((await params).key)) return unauthorized();
  return serveMcp(req, createAdminClient());
}

export const GET = methodNotAllowed;
export const DELETE = methodNotAllowed;
