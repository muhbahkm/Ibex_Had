import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';

import { supabasePublicEnvironment } from './env';

let browserClient: SupabaseClient | undefined;

export function createClient(): SupabaseClient {
  if (!browserClient) {
    const { url, publishableKey } = supabasePublicEnvironment();
    browserClient = createBrowserClient(url, publishableKey);
  }
  return browserClient;
}
