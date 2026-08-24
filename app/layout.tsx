import './globals.css';
import type { ReactNode } from 'react';

export const metadata = { title: 'LandGrid', description: 'Interactive site plans for the web.' };

export default function RootLayout({ children }: { children: ReactNode }) {
  return <html lang="en"><body>{children}</body></html>;
}
