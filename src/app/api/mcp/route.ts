import { authorize } from '@/lib/auth';
import { methodNotAllowed, serveMcp, unauthorized } from '@/lib/mcp-server';

/**
 * MCP server untuk agent yang bisa mengatur header (Hermes, Claude Code):
 * POST https://<app>/api/mcp  dengan header  Authorization: Bearer <AGENT_API_KEY>
 */

export async function POST(req: Request) {
  let db;
  try {
    ({ db } = await authorize(req));
  } catch {
    return unauthorized();
  }
  return serveMcp(req, db);
}

export const GET = methodNotAllowed;
export const DELETE = methodNotAllowed;
