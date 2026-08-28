import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/projects';

  const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || new URL(request.url).origin;

  if (code) {
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

    if (error) {
      console.error('Auth callback error:', error.message);
      return NextResponse.redirect(`${siteUrl}/login?error=auth`);
    }

    if (data.user) {
      // Sync user to public.users table
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

      // Use a response that carries the session cookies through the redirect
      const response = NextResponse.redirect(`${siteUrl}${next}`);

      // Copy any auth cookies set by supabase onto the response
      cookieStore.getAll().forEach(({ name, value }) => {
        if (name.startsWith('sb-')) {
          response.cookies.set(name, value, {
            httpOnly: true,
            sameSite: 'lax',
            secure: process.env.NODE_ENV === 'production',
            path: '/',
            maxAge: 60 * 60 * 24 * 7, // 7 days
          });
        }
      });

      return response;
    }
  }

  return NextResponse.redirect(`${siteUrl}/login?error=auth`);
}
