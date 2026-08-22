import { describe, expect, it, vi } from 'vitest';

import { CollectionEngagementService, type CollectionEngagementRepository } from './collection-engagement.js';

type RecordInput = Parameters<CollectionEngagementRepository['recordEvent']>[0];

function repository() {
  const recordEvent = vi.fn((input: RecordInput) => Promise.resolve({
    eventId: 'event-1', businessId: 'business-1', businessCustomerId: input.businessCustomerId,
    ...(input.accountId ? { accountId: input.accountId } : {}), eventKind: input.eventKind,
    ...(input.channel ? { channel: input.channel } : {}), ...(input.outcome ? { outcome: input.outcome } : {}),
    ...(input.note ? { note: input.note } : {}), ...(input.promisedAmountMinor ? { promisedAmountMinor: input.promisedAmountMinor } : {}),
    ...(input.currencyCode ? { currencyCode: input.currencyCode } : {}), ...(input.promisedFor ? { promisedFor: input.promisedFor } : {}),
    ...(input.nextActionAt ? { nextActionAt: input.nextActionAt } : {}), createdAt: '2026-08-22T18:00:00Z',
  }));
  const listHistory = vi.fn(() => Promise.resolve([]));
  const listTodayPlan = vi.fn(() => Promise.resolve([]));
  const value: CollectionEngagementRepository = { recordEvent, listHistory, listTodayPlan };
  return { value, recordEvent, listTodayPlan };
}

describe('CollectionEngagementService', () => {
  it('records a normalized promise without changing financial truth', async () => {
    const repo = repository();
    const service = new CollectionEngagementService(repo.value);
    await service.recordEvent({ actorUserId: ' user-1 ', requestId: 'req-1' }, {
      businessCustomerId: ' customer-1 ', accountId: ' account-1 ', eventKind: 'promise_to_pay',
      channel: 'whatsapp', outcome: 'promised', note: '  سداد يوم الأحد  ', promisedAmountMinor: '250000',
      currencyCode: 'yer', promisedFor: '2026-08-24', nextActionAt: '2026-08-24T09:00:00+03:00',
    });
    expect(repo.recordEvent).toHaveBeenCalledWith({
      actorUserId: 'user-1', requestId: 'req-1', businessCustomerId: 'customer-1', accountId: 'account-1',
      eventKind: 'promise_to_pay', channel: 'whatsapp', outcome: 'promised', note: 'سداد يوم الأحد',
      promisedAmountMinor: 250000n, currencyCode: 'YER', promisedFor: '2026-08-24', nextActionAt: '2026-08-24T09:00:00+03:00',
    });
  });

  it('rejects promise fields on ordinary contact events', () => {
    const service = new CollectionEngagementService(repository().value);
    expect(() => service.recordEvent({ actorUserId: 'u' }, { businessCustomerId: 'c', eventKind: 'contact_reached', promisedFor: '2026-08-24' })).toThrow('Promise fields');
  });

  it('validates plan date and limit before repository access', () => {
    const repo = repository();
    const service = new CollectionEngagementService(repo.value);
    expect(() => service.listTodayPlan({ actorUserId: 'u' }, { businessId: 'b', asOf: '22-08-2026' })).toThrow('YYYY-MM-DD');
    expect(() => service.listTodayPlan({ actorUserId: 'u' }, { businessId: 'b', limit: 500 })).toThrow('limit');
    expect(repo.listTodayPlan).not.toHaveBeenCalled();
  });
});
