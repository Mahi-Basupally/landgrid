import './globals.css';
import type { ReactNode } from 'react';
import AppShell from '@/components/app-shell';

export const metadata = { title: 'LandGrid', description: 'Interactive site plans for the web.' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body><AppShell>{children}</AppShell></body></html>;
}
