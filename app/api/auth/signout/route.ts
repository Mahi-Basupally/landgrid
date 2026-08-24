import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export async function POST() {
  const cookieStore = await cookies();
  const token = cookieStore.get('landgrid_user')?.value;

  if (token) {
    await supabaseAdmin().from('auth_sessions').delete().eq('token', token);
  }

  const response = NextResponse.json({ ok: true });
  response.cookies.set('landgrid_user', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 0,
  });
  return response;
}
