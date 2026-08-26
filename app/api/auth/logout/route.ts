import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import crypto from 'node:crypto';

export async function POST() {
  const jar = await cookies();
  const token = jar.get('landgrid_user')?.value;
  if (token) {
    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');
    await supabaseAdmin().from('auth_sessions').delete().eq('token_hash', tokenHash);
  }
  jar.set('landgrid_user', '', { httpOnly: true, sameSite: 'lax', path: '/', maxAge: 0, secure: process.env.NODE_ENV === 'production' });
  return NextResponse.json({ ok: true });
}
