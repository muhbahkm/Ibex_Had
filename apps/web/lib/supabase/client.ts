import { createBrowserClient } from '@supabase/ssr';

import { supabasePublicEnvironment } from './env';

let browserClient: ReturnType<typeof createBrowserClient> | undefined;

export function createClient() {
  if (!browserClient) {
    const { url, publishableKey } = supabasePublicEnvironment();
    browserClient = createBrowserClient(url, publishableKey);
  }
  return browserClient;
}
