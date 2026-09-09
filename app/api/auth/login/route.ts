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
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || requestUrl.origin).replace(/\/$/, '');
  const next = requestUrl.searchParams.get('next') || '/projects';
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/projects';
  const cookieStore = await cookies();

  let response = NextResponse.redirect(`${siteUrl}${safeNext}`);

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          try {
            cookieStore.set(name, value, options);
          } catch {
            // Response cookies below are the browser-facing cookies.
          }
          response.cookies.set(name, value, {
            ...options,
            path: '/',
            sameSite: options?.sameSite ?? 'lax',
            secure: requestUrl.protocol === 'https:',
          });
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

  response = NextResponse.redirect(data.url);
  // signInWithOAuth may have updated the cookie adapter after the initial
  // response was created, so copy the current verifier cookies explicitly.
  for (const cookie of cookieStore.getAll()) {
    if (cookie.name.includes('code-verifier')) {
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
