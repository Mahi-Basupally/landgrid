import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/projects';
  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL || origin).replace(/\/$/, '');

  if (!code) return NextResponse.redirect(`${siteUrl}/login?error=no_code`);

  const cookieStore = await cookies();
  const response = NextResponse.redirect(`${siteUrl}${next}`);

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          // Write cookies to BOTH the cookieStore AND the response
          cookiesToSet.forEach(({ name, value, options }) => {
            try { cookieStore.set(name, value, options); } catch {}
            response.cookies.set(name, value, {
              ...options,
              secure: true,
              sameSite: 'lax',
              httpOnly: true,
              path: '/',
            });
          });
        },
      },
    }
  );

  const { data, error } = await supabase.auth.exchangeCodeForSession(code);

  if (error || !data.session) {
    console.error('[callback] error:', error?.message);
    return NextResponse.redirect(`${siteUrl}/login?error=exchange_failed`);
  }

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
  } catch {}

  return response;
}
