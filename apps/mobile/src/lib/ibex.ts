import {
  adaptSupabaseJsClient,
  createIbexSessionApplication,
} from '../../../../packages/runtime/src/index';

import { supabase } from './supabase';

export const ibex = createIbexSessionApplication(adaptSupabaseJsClient(supabase));
