import { redirect } from 'next/navigation';

import { DashboardClient } from './dashboard-client';
import { createClient } from '../../lib/supabase/server';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) redirect('/login');
  return <DashboardClient />;
}
