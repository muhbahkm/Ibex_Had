import {
  adaptSupabaseJsClient,
  createIbexSessionApplication,
} from '../../../../packages/runtime/src/index';

import { createPreviewIbexApplication } from './preview-ibex';
import { supabase } from './supabase';

const isPreviewMode = process.env.EXPO_PUBLIC_AUTH_MODE === 'preview';

export const ibex = isPreviewMode
  ? createPreviewIbexApplication()
  : createIbexSessionApplication(adaptSupabaseJsClient(supabase));
