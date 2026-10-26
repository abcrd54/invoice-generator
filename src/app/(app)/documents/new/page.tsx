import { requireUser } from '@/lib/session';
import { getProfile, getType } from '@/lib/documents';
import { DocumentEditor } from '@/components/DocumentEditor';

export default async function NewDocumentPage({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const { db } = await requireUser();
  const { type: slug = 'invoice' } = await searchParams;
  const [type, profile] = await Promise.all([getType(db, slug), getProfile(db)]);
  return <DocumentEditor type={type} profile={profile} />;
}
