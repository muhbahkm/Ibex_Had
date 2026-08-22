import { describe, expect, it, vi } from 'vitest';

import { CreditFollowUpService, type CreditFollowUpRepository } from './credit-followup.js';

type SetTermsInput = Parameters<CreditFollowUpRepository['setCreditTerms']>[0];

function repository() {
  const setCreditTerms = vi.fn((input: SetTermsInput) => Promise.resolve({
    accountId: input.accountId,
    termsDays: input.termsDays,
    graceDays: input.graceDays,
    enabled: input.enabled,
    currencyCode: 'YER',
  }));
  const listTodayFollowUps = vi.fn(() => Promise.resolve([]));
  const value: CreditFollowUpRepository = { setCreditTerms, listTodayFollowUps };
  return { value, setCreditTerms };
}

describe('CreditFollowUpService', () => {
  it('normalizes and forwards credit terms', async () => {
    const repo = repository();
    const service = new CreditFollowUpService(repo.value);
    const result = await service.setCreditTerms({ actorUserId: ' user-1 ', requestId: 'req-1' }, { accountId: ' account-1 ', termsDays: 30, graceDays: 5 });
    expect(result).toEqual({ accountId: 'account-1', termsDays: 30, graceDays: 5, enabled: true, currencyCode: 'YER' });
    expect(repo.setCreditTerms).toHaveBeenCalledWith({ actorUserId: 'user-1', accountId: 'account-1', termsDays: 30, graceDays: 5, enabled: true, requestId: 'req-1' });
  });

  it('rejects unsafe ranges and invalid dates', () => {
    const service = new CreditFollowUpService(repository().value);
    expect(() => service.setCreditTerms({ actorUserId: 'u' }, { accountId: 'a', termsDays: 4000 })).toThrow('termsDays');
    expect(() => service.listTodayFollowUps({ actorUserId: 'u' }, { businessId: 'b', asOf: '22-08-2026' })).toThrow('asOf');
  });
});