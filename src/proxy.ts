import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from './lib/supabase/env';

/** Refresh sesi Supabase dan arahkan ke /login untuk halaman UI yang butuh login. */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll: () => request.cookies.getAll(),
      setAll: (list) => {
        list.forEach(({ name, value }) => request.cookies.set(name, value));
        response = NextResponse.next({ request });
        list.forEach(({ name, value, options }) => response.cookies.set(name, value, options));
      },
    },
  });

  // getClaims memverifikasi JWT secara lokal (dan me-refresh token bila kedaluwarsa)
  const { data } = await supabase.auth.getClaims();
  const path = request.nextUrl.pathname;
  if (!data?.claims && path !== '/login') {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', path);
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  // API (punya auth sendiri), halaman share publik /p/*, dan aset statis tidak lewat proxy
  matcher: ['/((?!api/|p/|_next/static|_next/image|favicon.ico|.*\.(?:png|jpg|jpeg|svg|webp)$).*)'],
};
