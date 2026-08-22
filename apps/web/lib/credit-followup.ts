'use client';

import { adaptSupabaseJsClient, createCreditFollowUpSessionService } from '../../../packages/runtime/src/index';
import { createClient } from './supabase/client';

const supabase = createClient();
export const creditFollowUp = createCreditFollowUpSessionService(adaptSupabaseJsClient(supabase));
