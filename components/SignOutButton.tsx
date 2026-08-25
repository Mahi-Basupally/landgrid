'use client';

import { signOut } from '@/lib/signout';

export default function SignOutButton() {
  return <button type="button" className="button secondary" onClick={signOut}>Sign out</button>;
}
