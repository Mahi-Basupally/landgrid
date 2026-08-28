import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return request.cookies.getAll(); },
        setAll(cookiesToSet) {
          // Set on request for downstream
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          // Rebuild response with updated cookies
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // IMPORTANT: do not add any logic between createServerClient and getUser
  // that could prevent cookies from being set correctly
  const { data: { user } } = await supabase.auth.getUser();

  const { pathname } = request.nextUrl;

  // Always public
  const isPublic =
    pathname === '/' ||
    pathname === '/login' ||
    pathname.startsWith('/api/auth/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon');

  // Public project view (no auth needed)
  const isProjectView = /^\/projects\/[^/]+$/.test(pathname);

  // Protect all other routes
  if (!isPublic && !isProjectView && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  // Redirect logged-in users away from login
  if (pathname === '/login' && user) {
    const url = request.nextUrl.clone();
    url.pathname = '/projects';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
