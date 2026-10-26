import { notFound } from 'next/navigation';
import { requireUser } from '@/lib/session';
import { AppError, getDocument, getProfile, getType } from '@/lib/documents';
import { DocumentEditor } from '@/components/DocumentEditor';
import { proofUrl } from '@/lib/attachments';

export default async function EditDocumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { db } = await requireUser();
  const { id } = await params;
  const doc = await getDocument(db, id).catch((e) => {
    if (e instanceof AppError && e.status === 404) notFound();
    throw e;
  });
  const [type, profile, proof] = await Promise.all([getType(db, doc.type), getProfile(db), proofUrl(db, doc.proof_path)]);
  // key: remount editor saat dokumen berganti / disimpan ulang
  return <DocumentEditor key={doc.updated_at} type={type} profile={profile} doc={doc} proofUrl={proof} />;
}
