import { redirect } from 'next/navigation';

import { createClient } from '../../../../lib/supabase/server';
import { BusinessWorkspaceClient } from './business-workspace-client';

export default async function BusinessWorkspacePage({ params }: { readonly params: Promise<{ businessId: string }> }) {
  const { businessId } = await params;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) redirect('/login');
  return <BusinessWorkspaceClient businessId={businessId} />;
}
