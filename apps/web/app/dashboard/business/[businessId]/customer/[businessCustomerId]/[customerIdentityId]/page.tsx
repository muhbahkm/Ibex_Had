import { redirect } from 'next/navigation';

import { createClient } from '../../../../../../../lib/supabase/server';
import { CustomerAccountsClient } from './customer-accounts-client';

export default async function CustomerAccountsPage({ params }: { readonly params: Promise<{ businessId: string; businessCustomerId: string; customerIdentityId: string }> }) {
  const { businessId, businessCustomerId, customerIdentityId } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) redirect('/login');
  return <CustomerAccountsClient businessId={businessId} businessCustomerId={businessCustomerId} customerIdentityId={customerIdentityId} />;
}
