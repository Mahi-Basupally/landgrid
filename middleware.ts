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
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const { data: { user } } = await supabase.auth.getUser();
  const { pathname } = request.nextUrl;

  // Public routes — no auth needed.
  const isPublic =
    pathname === '/' ||
    pathname === '/login' ||
    pathname.startsWith('/api/auth/') ||
    pathname.startsWith('/embed/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/favicon');

  // Public project viewer. The project page and plan API perform the
  // actual is_public/member authorization; middleware must not redirect
  // an anonymous visitor to /login before those checks can run.
  const isProjectView = /^\/projects\/[^/]+$/.test(pathname);

  // Public viewer data endpoints. Their route handlers are responsible for
  // deciding whether the project is public or the requester is a member.
  const isPublicProjectApi =
    /^\/api\/projects\/[^/]+\/plan$/.test(pathname) ||
    /^\/api\/projects\/[^/]+\/assets\/file$/.test(pathname);

  if (!isPublic && !isProjectView && !isPublicProjectApi && !user) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    url.searchParams.set('next', pathname);
    return NextResponse.redirect(url);
  }

  // Redirect logged-in users away from login page.
  if (pathname === '/login' && user) {
    const url = request.nextUrl.clone();
    url.pathname = '/projects';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)'],
};
