import type { CreditTermsRecord, TodayFollowUpRecord } from '../../../../packages/application/src/credit-followup';
import { adaptSupabaseJsClient, createCreditFollowUpSessionService } from '../../../../packages/runtime/src/index';

import { isPreviewRuntime } from './ibex';
import { supabase } from './supabase';

const service = createCreditFollowUpSessionService(adaptSupabaseJsClient(supabase));

export function listTodayFollowUps(input: { readonly businessId: string; readonly limit?: number; readonly dueSoonDays?: number }): Promise<readonly TodayFollowUpRecord[]> {
  if (isPreviewRuntime) return Promise.resolve([]);
  return service.listTodayFollowUps(input);
}

export function setCreditTerms(input: { readonly accountId: string; readonly termsDays: number; readonly graceDays?: number; readonly enabled?: boolean }): Promise<CreditTermsRecord> {
  if (isPreviewRuntime) {
    return Promise.resolve({
      accountId: input.accountId,
      termsDays: input.termsDays,
      graceDays: input.graceDays ?? 0,
      enabled: input.enabled ?? true,
      currencyCode: 'PREVIEW',
    });
  }
  return service.setCreditTerms(input, `mobile-credit-terms-${Date.now()}`);
}
