import { NextResponse } from 'next/server';
export async function POST() {
  return NextResponse.json({ error: 'This auth method is no longer used. Sign in with Google.' }, { status: 410 });
}
