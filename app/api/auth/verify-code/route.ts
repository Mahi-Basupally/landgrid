import { NextResponse } from 'next/server';
import { createSession, loginCode, upsertUser, sessionCookie } from '@/lib/auth';

function validEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export async function POST(req: Request) {
  const { email, code } = await req.json();
  const normalized = String(email || '').trim().toLowerCase();

  if (!validEmail(normalized)) {
    return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
  }

  if (String(code || '').trim() !== loginCode()) {
    return NextResponse.json({ error: 'Invalid verification code' }, { status: 401 });
  }

  try {
    const existing = await upsertUser(normalized);
    const session = await createSession(existing.id);
    const response = NextResponse.json({ ok: true, user: existing });
    response.headers.append('Set-Cookie', sessionCookie(session.token, session.expiresAt));
    return response;
  } catch (error) {
    console.error('verify-code failed', error);
    return NextResponse.json({ error: 'Unable to complete login.' }, { status: 500 });
  }
}
