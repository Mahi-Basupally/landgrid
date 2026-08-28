import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/projects';

  // Use NEXT_PUBLIC_SITE_URL if set, otherwise derive from request origin
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || origin).replace(/\/$/, '');

  if (!code) {
    return NextResponse.redirect(`${siteUrl}/login?error=no_code`);
  }

  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            try { cookieStore.set(name, value, options); } catch {}
          });
        },
      },
    }
  );

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.session) {
    console.error('[callback] exchangeCodeForSession error:', error?.message);
    return NextResponse.redirect(`${siteUrl}/login?error=exchange_failed`);
  }

  // Build redirect response and explicitly copy ALL sb- cookies onto it
  const response = NextResponse.redirect(`${siteUrl}${next}`);

  // Supabase SSR sets cookies via cookieStore but in a Server Action context
  // those don't propagate to a NextResponse redirect — copy them manually
  cookieStore.getAll().forEach((cookie) => {
    if (cookie.name.startsWith('sb-')) {
      response.cookies.set(cookie.name, cookie.value, {
        httpOnly: true,
        secure: true,
        sameSite: 'lax',
        path: '/',
        maxAge: 60 * 60 * 24 * 365,
      });
    }
  });

  // Sync user to public.users
  try {
    const { createClient } = await import('@supabase/supabase-js');
    const admin = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!,
      { auth: { autoRefreshToken: false, persistSession: false } }
    );
    await admin.from('users').upsert(
      { id: data.user.id, email: data.user.email!, name: data.user.user_metadata?.full_name || null },
      { onConflict: 'id' }
    );
  } catch (e) {
    console.error('[callback] user sync error:', e);
  }

  return response;
}
