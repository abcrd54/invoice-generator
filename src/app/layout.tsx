import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Polyline Documents',
  description: 'Invoice & form generator Polyline',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id">
      <body>{children}</body>
    </html>
  );
}
