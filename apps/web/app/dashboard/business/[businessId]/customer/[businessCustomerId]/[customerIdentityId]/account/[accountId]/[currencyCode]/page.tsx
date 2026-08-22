import { redirect } from 'next/navigation';

import { createClient } from '../../../../../../../../../../lib/supabase/server';
import { AccountStatementClient } from './account-statement-client';

export default async function AccountStatementPage({ params }: { readonly params: Promise<{ businessId: string; businessCustomerId: string; customerIdentityId: string; accountId: string; currencyCode: string }> }) {
  const { businessId, businessCustomerId, customerIdentityId, accountId, currencyCode } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) redirect('/login');
  return (
    <AccountStatementClient
      businessId={businessId}
      businessCustomerId={businessCustomerId}
      customerIdentityId={customerIdentityId}
      accountId={accountId}
      currencyCode={currencyCode}
    />
  );
}
