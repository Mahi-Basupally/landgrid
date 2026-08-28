import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';

export async function GET() {
  const cookieStore = await cookies();
  const all = cookieStore.getAll();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll() {},
      },
    }
  );

  const { data: { user }, error } = await supabase.auth.getUser();

  return NextResponse.json({
    cookieNames: all.map(c => c.name),
    sbCookies: all.filter(c => c.name.startsWith('sb-')).map(c => ({ name: c.name, len: c.value.length })),
    user: user ? { id: user.id, email: user.email } : null,
    error: error?.message || null,
    env: {
      hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasAnon: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      siteUrl: process.env.NEXT_PUBLIC_SITE_URL,
    }
  });
}
