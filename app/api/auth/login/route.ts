import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

const SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL ||
  'https://gjruvyoykroerdlgxjcm.supabase.co';
const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  'sb_publishable_7s6wxgyKEy_cxHIm4R8MXQ_4PannqRs';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  // Keep the entire OAuth flow on the same host that started it. Using a
  // configured site URL here can move the callback to another Vercel alias,
  // which cannot receive the verifier cookie created on this host.
  const siteUrl = requestUrl.origin.replace(/\/$/, '');
  const next = requestUrl.searchParams.get('next') || '/projects';
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/projects';
  const cookieStore = await cookies();

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          cookieStore.set(name, value, options);
        }
      },
    },
  });

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: `${siteUrl}/api/auth/callback?next=${encodeURIComponent(safeNext)}`,
      queryParams: { access_type: 'offline', prompt: 'select_account' },
    },
  });

  if (error || !data.url) {
    console.error('[login] OAuth start failed:', error?.message);
    return NextResponse.redirect(`${siteUrl}/login?error=oauth_start_failed`);
  }

  const response = NextResponse.redirect(data.url);
  // signInWithOAuth stores the PKCE verifier in the request cookie store.
  // Copy every auth cookie to the actual browser response, including any
  // chunked cookie variants, so the callback can exchange the code reliably.
  for (const cookie of cookieStore.getAll()) {
    if (cookie.name.includes('auth-token')) {
      response.cookies.set(cookie.name, cookie.value, {
        path: '/',
        httpOnly: true,
        sameSite: 'lax',
        secure: requestUrl.protocol === 'https:',
      });
    }
  }

  return response;
}
