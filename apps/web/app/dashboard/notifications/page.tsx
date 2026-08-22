import { redirect } from 'next/navigation';

import { createClient } from '../../../lib/supabase/server';
import { NotificationsClient } from './notifications-client';

export default async function NotificationsPage() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims?.sub) redirect('/login');
  return <NotificationsClient />;
}
