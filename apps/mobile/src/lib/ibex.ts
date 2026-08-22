import {
  adaptSupabaseJsClient,
  createIbexSessionApplication,
} from '../../../../packages/runtime/src/index';

import { createPreviewIbexApplication } from './preview-ibex';
import { supabase } from './supabase';

export const isPreviewRuntime = process.env.EXPO_PUBLIC_AUTH_MODE === 'preview';

export const ibex = isPreviewRuntime
  ? createPreviewIbexApplication()
  : createIbexSessionApplication(adaptSupabaseJsClient(supabase));
