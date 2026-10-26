import Link from 'next/link';
import { requireUser } from '@/lib/session';
import { LogoutButton } from '@/components/LogoutButton';

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const { user } = await requireUser();
  return (
    <>
      <header>
        <h1>
          <Link href="/">Polyline Documents</Link>
        </h1>
        <nav>
          <Link className="btn btn-sm" href="/">📄 Dokumen</Link>
          <Link className="btn btn-sm" href="/settings">⚙️ Pengaturan</Link>
          <span className="muted" style={{ color: '#bbb' }}>{user.email}</span>
          <LogoutButton />
        </nav>
      </header>
      {children}
    </>
  );
}
