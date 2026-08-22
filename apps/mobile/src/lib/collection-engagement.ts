import type { CollectionFollowUpEventRecord, CollectionTodayPlanRecord } from '../../../../packages/application/src/collection-engagement';
import { adaptSupabaseJsClient, createCollectionEngagementSessionService } from '../../../../packages/runtime/src/index';

import { isPreviewRuntime } from './ibex';
import { supabase } from './supabase';

const service = createCollectionEngagementSessionService(adaptSupabaseJsClient(supabase));
const previewEvents: CollectionFollowUpEventRecord[] = [];

export function listCollectionTodayPlan(input: { readonly businessId: string; readonly limit?: number; readonly dueSoonDays?: number }): Promise<readonly CollectionTodayPlanRecord[]> {
  if (isPreviewRuntime) return Promise.resolve([]);
  return service.listTodayPlan(input);
}

export function listCollectionFollowUpHistory(input: { readonly businessCustomerId: string; readonly limit?: number }): Promise<readonly CollectionFollowUpEventRecord[]> {
  if (isPreviewRuntime) return Promise.resolve(previewEvents.filter((row) => row.businessCustomerId === input.businessCustomerId).slice(0, input.limit ?? 50));
  return service.listHistory(input);
}

export function recordCollectionFollowUpEvent(input: Parameters<typeof service.recordEvent>[0]): Promise<CollectionFollowUpEventRecord> {
  if (isPreviewRuntime) {
    const event: CollectionFollowUpEventRecord = {
      eventId: `preview-followup-${Date.now().toString(36)}`,
      businessId: 'preview-business',
      businessCustomerId: input.businessCustomerId,
      ...(input.accountId ? { accountId: input.accountId } : {}),
      eventKind: input.eventKind,
      ...(input.channel ? { channel: input.channel } : {}),
      ...(input.outcome ? { outcome: input.outcome } : {}),
      ...(input.note?.trim() ? { note: input.note.trim() } : {}),
      ...(input.promisedAmountMinor ? { promisedAmountMinor: BigInt(input.promisedAmountMinor) } : {}),
      ...(input.currencyCode ? { currencyCode: input.currencyCode } : {}),
      ...(input.promisedFor ? { promisedFor: input.promisedFor } : {}),
      ...(input.nextActionAt ? { nextActionAt: input.nextActionAt } : {}),
      createdAt: new Date().toISOString(),
    };
    previewEvents.unshift(event);
    return Promise.resolve(event);
  }
  return service.recordEvent(input, `mobile-collection-followup-${Date.now()}`);
}
