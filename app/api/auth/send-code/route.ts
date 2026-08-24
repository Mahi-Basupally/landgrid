import { NextResponse } from 'next/server';
import { readUsers, loginCode } from '@/lib/auth';

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function POST(req: Request) {
  const { email } = await req.json();
  const normalized = String(email || '').trim().toLowerCase();

  if (!emailPattern.test(normalized)) {
    return NextResponse.json({ error: 'Please enter a valid email address.' }, { status: 400 });
  }

  const exists = readUsers().some((u) => u.email.toLowerCase() === normalized);
  const resendKey = process.env.RESEND_API_KEY;
  const from = process.env.LANDGRID_FROM_EMAIL;

  if (resendKey && from) {
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${resendKey}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from,
        to: [normalized],
        subject: 'Your LandGrid verification code',
        text: `Your LandGrid verification code is ${loginCode()}. This code expires when a new code is requested.`,
      }),
    });
    if (!response.ok) {
      console.error('[LandGrid] email delivery failed', await response.text());
      return NextResponse.json({ error: 'We could not send the verification email. Please try again.' }, { status: 502 });
    }
    return NextResponse.json({ message: 'Verification code sent. Check your email.' });
  }

  console.log(`[LandGrid] development verification code requested for ${normalized}`);
  return NextResponse.json({
    message: exists
      ? `Development mode: use the configured login code (${loginCode()}). Email delivery is not configured yet.`
      : `No projects are associated with this email yet. Development mode: use the configured login code (${loginCode()}) to continue.`,
  });
}
