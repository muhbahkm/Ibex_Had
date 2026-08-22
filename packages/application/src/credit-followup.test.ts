import { describe, expect, it, vi } from 'vitest';

import { CreditFollowUpService, type CreditFollowUpRepository } from './credit-followup.js';

function repository(): CreditFollowUpRepository {
  return {
    setCreditTerms: vi.fn((input) => Promise.resolve({ accountId: input.accountId, termsDays: input.termsDays, graceDays: input.graceDays, enabled: input.enabled, currencyCode: 'YER' })),
    listTodayFollowUps: vi.fn(() => Promise.resolve([])),
  };
}

describe('CreditFollowUpService', () => {
  it('normalizes and forwards credit terms', async () => {
    const repo = repository();
    const service = new CreditFollowUpService(repo);
    const result = await service.setCreditTerms({ actorUserId: ' user-1 ', requestId: 'req-1' }, { accountId: ' account-1 ', termsDays: 30, graceDays: 5 });
    expect(result).toEqual({ accountId: 'account-1', termsDays: 30, graceDays: 5, enabled: true, currencyCode: 'YER' });
    expect(repo.setCreditTerms).toHaveBeenCalledWith({ actorUserId: 'user-1', accountId: 'account-1', termsDays: 30, graceDays: 5, enabled: true, requestId: 'req-1' });
  });

  it('rejects unsafe ranges and invalid dates', async () => {
    const service = new CreditFollowUpService(repository());
    await expect(service.setCreditTerms({ actorUserId: 'u' }, { accountId: 'a', termsDays: 4000 })).rejects.toThrow('termsDays');
    await expect(service.listTodayFollowUps({ actorUserId: 'u' }, { businessId: 'b', asOf: '22-08-2026' })).rejects.toThrow('asOf');
  });
});
