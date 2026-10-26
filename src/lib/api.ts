import { NextResponse } from 'next/server';
import { AppError } from './documents';

export function ok(data: unknown, status = 200) {
  return NextResponse.json(data, { status });
}

export function handleError(e: unknown) {
  if (e instanceof AppError) return NextResponse.json({ error: e.message }, { status: e.status });
  console.error(e);
  return NextResponse.json({ error: 'internal error' }, { status: 500 });
}

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  try {
    const body = await req.json();
    if (typeof body !== 'object' || body === null) throw new Error();
    return body as Record<string, unknown>;
  } catch {
    throw new AppError('body harus JSON object');
  }
}
