import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Auth callback must be allowed to exchange the OAuth code and set the
  // Supabase session cookies without another middleware redirect.
  if (
    pathname.startsWith('/api/auth/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon') ||
    pathname === '/' ||
    pathname === '/login'
  ) {
    return NextResponse.next({ request });
  }

  // Public project view does not require Supabase at all. Keep this check
  // before client creation so a missing Preview environment cannot cause a
  // middleware invocation failure on public project pages.
  const isProjectView = /^\/projects\/[^/]+$/.test(pathname);
  if (isProjectView) {
    return NextResponse.next({ request });
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Avoid a hard 500 if a deployment is missing its Supabase environment
  // variables. Authenticated routes will fall back to the login page instead.
  if (!supabaseUrl || !supabaseAnonKey) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        // Keep both the request and response cookies in sync. This is required
        // when Supabase refreshes an access token during middleware execution.
        cookiesToSet.forEach(({ name, value }) => {
          request.cookies.set(name, value);
        });

        supabaseResponse = NextResponse.next({ request });

        cookiesToSet.forEach(({ name, value, options }) => {
          supabaseResponse.cookies.set(name, value, {
            ...options,
            path: '/',
            sameSite: options?.sameSite ?? 'lax',
            secure: request.nextUrl.protocol === 'https:',
          });
        });
      },
    },
  });

  const {
    data: { user },
  } = await supabase.auth.getUser();

  // All other routes need auth.
  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
