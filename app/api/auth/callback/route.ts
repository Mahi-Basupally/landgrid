import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  const requestUrl = new URL(request.url);
  const code = requestUrl.searchParams.get('code');
  const next = requestUrl.searchParams.get('next') ?? '/projects';
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || requestUrl.origin).replace(/\/$/, '');

  if (!code) {
    return NextResponse.redirect(`${siteUrl}/login?error=no_code`);
  }

  const cookieStore = await cookies();
  let response = NextResponse.redirect(`${siteUrl}${next}`);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          // Supabase SSR may refresh/replace several auth cookies. They must be
          // copied to the actual redirect response so the browser keeps the session.
          cookiesToSet.forEach(({ name, value, options }) => {
            try {
              cookieStore.set(name, value, options);
            } catch {
              // The response cookie below is the important one for the browser.
            }

            response.cookies.set(name, value, {
              ...options,
              path: '/',
              sameSite: options?.sameSite ?? 'lax',
              secure: requestUrl.protocol === 'https:',
            });
          });
        },
      },
    }
  );

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.session) {
    console.error('[callback] session exchange failed:', error?.message);
    return NextResponse.redirect(`${siteUrl}/login?error=exchange_failed`);
  }

  // Sync the authenticated user to public.users without affecting login if the
  // optional profile sync fails.
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );

    await admin.from('users').upsert(
      {
        id: data.user.id,
        email: data.user.email!,
        name: data.user.user_metadata?.full_name || null,
      },
      { onConflict: 'id' }
    );
  } catch (syncError) {
    console.error('[callback] user sync failed:', syncError);
  }

  return response;
}
