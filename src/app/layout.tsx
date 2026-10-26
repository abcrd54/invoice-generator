import type { Metadata } from 'next';
import './globals.css';
import { NavProgress } from '@/components/NavProgress';

export const metadata: Metadata = {
  title: 'Polyline Documents',
  description: 'Invoice & form generator Polyline',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>
        <NavProgress />
        {children}
      </body>
    </html>
  );
}
