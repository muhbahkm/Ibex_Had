import { redirect } from 'next/navigation';

import { createClient } from '../lib/supabase/server';

export default async function HomePage() {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  redirect(!error && data?.claims?.sub ? '/dashboard' : '/login');
}
