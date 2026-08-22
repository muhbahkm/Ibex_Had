'use client';

import { adaptSupabaseJsClient, createCollectionEngagementSessionService } from '../../../packages/runtime/src/index';
import { createClient } from './supabase/client';

const supabase = createClient();
export const collectionEngagement = createCollectionEngagementSessionService(adaptSupabaseJsClient(supabase));
