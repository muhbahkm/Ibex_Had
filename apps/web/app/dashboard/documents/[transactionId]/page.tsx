import { redirect } from 'next/navigation';

import { createClient } from '../../../../lib/supabase/server';
import { TransactionDocumentsClient } from './transaction-documents-client';

export default async function TransactionDocumentsPage({ params }: { readonly params: Promise<{ transactionId: string }> }) {
  const { transactionId } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) redirect('/login');
  return <TransactionDocumentsClient transactionId={transactionId} />;
}
