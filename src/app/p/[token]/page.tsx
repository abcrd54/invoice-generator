import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { createAdminClient } from '@/lib/supabase/server';
import { getDocumentByToken, getProfile, getType } from '@/lib/documents';
import { DocumentView } from '@/components/DocumentView';
import { PrintButton } from '@/components/PrintButton';
import { proofUrl } from '@/lib/attachments';

type Params = Promise<{ token: string }>;

export const metadata: Metadata = { robots: { index: false, follow: false } };

/** Halaman publik (lewat link rahasia) untuk melihat & mencetak dokumen sebagai PDF. */
export default async function SharePage({ params }: { params: Params }) {
  const { token } = await params;
  const db = createAdminClient();
  const doc = await getDocumentByToken(db, token);
  if (!doc) notFound();
  const [type, biz, proof] = await Promise.all([getType(db, doc.type), getProfile(db), proofUrl(db, doc.proof_path)]);

  return (
    <div className="print-page">
      <title>{doc.number.replace(/\//g, '-')}</title>
      <div className="print-toolbar">
        <a className="btn" href={`/p/${token}/pdf?download`}>
          ⬇️ Download PDF
        </a>
        <PrintButton />
      </div>
      <DocumentView number={doc.number} status={doc.status} data={doc.data} type={type} biz={biz} proofUrl={proof} />
    </div>
  );
}
