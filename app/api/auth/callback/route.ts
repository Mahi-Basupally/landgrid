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
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') ?? '/projects';
  const safeNext = next.startsWith('/') && !next.startsWith('//') ? next : '/projects';
  const siteUrl = requestUrl.origin.replace(/\/$/, '');

  if (!code) {
    return NextResponse.redirect(`${siteUrl}/login?error=no_code`);
  }

  const cookieStore = await cookies();
  const response = NextResponse.redirect(`${siteUrl}${safeNext}`);

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value, options } of cookiesToSet) {
          cookieStore.set(name, value, options);
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

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.session) {
    console.error('[callback] session exchange failed:', error?.message);
    return NextResponse.redirect(`${siteUrl}/login?error=exchange_failed`);
  }

  // Profile sync is optional; it must never turn a successful OAuth login into
  // a failed login when the server-only service-role key is unavailable.
  try {
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (serviceRoleKey) {
      const { createClient } = await import('@supabase/supabase-js');
      const admin = createClient(SUPABASE_URL, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
      });

      await admin.from('users').upsert(
        {
          id: data.user.id,
          email: data.user.email!,
          name: data.user.user_metadata?.full_name || null,
        },
        { onConflict: 'id' }
      );
    }
  } catch (syncError) {
    console.error('[callback] user sync failed:', syncError);
  }

  return response;
}
