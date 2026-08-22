'use client';

import { createIbexSessionApplication } from '../../../packages/runtime/src/session-application';
import { adaptSupabaseJsClient } from '../../../packages/runtime/src/supabase-client-adapter';
import { createClient } from './supabase/client';

const supabase = createClient();

export const ibex = createIbexSessionApplication(adaptSupabaseJsClient(supabase));
