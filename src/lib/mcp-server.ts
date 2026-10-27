import { NextResponse } from 'next/server';
import type { SupabaseClient } from '@supabase/supabase-js';
import { AppError } from './documents';
import { SERVER_INSTRUCTIONS, TOOLS, callTool } from './mcp-tools';

/** MCP server (Streamable HTTP, stateless, respon JSON). Dipakai /api/mcp dan /api/mcp/<kunci>. */

const SUPPORTED_VERSIONS = ['2025-11-25', '2025-06-18', '2025-03-26', '2024-11-05'];

interface RpcRequest {
  jsonrpc: '2.0';
  id?: string | number | null;
  method: string;
  params?: Record<string, unknown>;
}

function rpcResult(id: RpcRequest['id'], result: unknown) {
  return { jsonrpc: '2.0', id, result };
}

export function rpcError(id: RpcRequest['id'], code: number, message: string) {
  return { jsonrpc: '2.0', id: id ?? null, error: { code, message } };
}

export function unauthorized() {
  return NextResponse.json(rpcError(null, -32001, 'unauthorized'), { status: 401 });
}

async function handle(msg: RpcRequest, db: SupabaseClient) {
  switch (msg.method) {
    case 'initialize': {
      const requested = String(msg.params?.protocolVersion ?? '');
      return rpcResult(msg.id, {
        protocolVersion: SUPPORTED_VERSIONS.includes(requested) ? requested : SUPPORTED_VERSIONS[0],
        capabilities: { tools: { listChanged: false } },
        serverInfo: { name: 'polyline-documents', version: '2.0.0' },
        instructions: SERVER_INSTRUCTIONS,
      });
    }
    case 'ping':
      return rpcResult(msg.id, {});
    case 'tools/list':
      return rpcResult(msg.id, { tools: TOOLS });
    case 'tools/call': {
      const name = String(msg.params?.name ?? '');
      const args = (msg.params?.arguments ?? {}) as Record<string, unknown>;
      try {
        const out = await callTool(db, name, args);
        return rpcResult(msg.id, { content: [{ type: 'text', text: JSON.stringify(out, null, 2) }] });
      } catch (e) {
        // Error tool dikembalikan sebagai hasil (isError) supaya agent bisa memperbaiki input
        const message = e instanceof AppError ? e.message : 'internal error';
        if (!(e instanceof AppError)) console.error(e);
        return rpcResult(msg.id, { content: [{ type: 'text', text: `Error: ${message}` }], isError: true });
      }
    }
    default:
      return rpcError(msg.id, -32601, `method tidak didukung: ${msg.method}`);
  }
}

/** Proses body JSON-RPC (tunggal atau batch) yang sudah lolos autentikasi. */
export async function serveMcp(req: Request, db: SupabaseClient) {
  let body: RpcRequest | RpcRequest[];
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(rpcError(null, -32700, 'parse error'), { status: 400 });
  }

  const messages = Array.isArray(body) ? body : [body];
  const responses = [];
  for (const msg of messages) {
    if (msg.id === undefined || msg.id === null) continue; // notifikasi (mis. notifications/initialized)
    responses.push(await handle(msg, db));
  }

  if (responses.length === 0) return new Response(null, { status: 202 });
  return NextResponse.json(Array.isArray(body) ? responses : responses[0]);
}

// Server stateless: tidak ada stream SSE terpisah / sesi untuk dihapus
export function methodNotAllowed() {
  return new Response('Method Not Allowed', { status: 405, headers: { Allow: 'POST' } });
}
