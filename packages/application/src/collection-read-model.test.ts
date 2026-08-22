import { describe, expect, it } from 'vitest';

import { assembleBusinessCollectionOverview, type CollectionDataSource } from './collection-read-model.js';

const dataSource: CollectionDataSource = {
  async listBusinessCustomers() {
    return [
      { businessCustomerId: 'c1', customerIdentityId: 'i1', displayName: 'أحمد', accountCount: 2, createdAt: '2026-01-01T00:00:00.000Z' },
      { businessCustomerId: 'c2', customerIdentityId: 'i2', displayName: 'سالم', accountCount: 1, createdAt: '2026-01-02T00:00:00.000Z' },
    ];
  },
  async listCustomerAccounts({ businessCustomerId }) {
    if (businessCustomerId === 'c1') {
      return [
        { accountId: 'a1', businessCustomerId: 'c1', currencyCode: 'YER', status: 'active', balanceMinor: 1000n },
        { accountId: 'a2', businessCustomerId: 'c1', currencyCode: 'SAR', status: 'active', balanceMinor: 500n },
      ];
    }
    return [{ accountId: 'a3', businessCustomerId: 'c2', currencyCode: 'YER', status: 'active', balanceMinor: -300n }];
  },
  async getStatement({ accountId }) {
    if (accountId === 'a1') return [{ transactionId: 't1', transactionType: 'sale_on_account', transactionStatus: 'posted', occurredAt: '2026-01-01T00:00:00.000Z', effectMinor: 1000n, balanceAfterMinor: 1000n, currencyCode: 'YER', canReverse: true }];
    if (accountId === 'a2') return [{ transactionId: 't2', transactionType: 'sale_on_account', transactionStatus: 'posted', occurredAt: '2026-02-15T00:00:00.000Z', effectMinor: 500n, balanceAfterMinor: 500n, currencyCode: 'SAR', canReverse: true }];
    return [{ transactionId: 't3', transactionType: 'receipt', transactionStatus: 'posted', occurredAt: '2026-02-20T00:00:00.000Z', effectMinor: -300n, balanceAfterMinor: -300n, currencyCode: 'YER', canReverse: true }];
  },
};

describe('assembleBusinessCollectionOverview', () => {
  it('keeps currencies separate and ranks stale debt first', async () => {
    const overview = await assembleBusinessCollectionOverview(dataSource, {
      businessId: 'b1',
      limit: 100,
      staleAfterDays: 30,
      now: new Date('2026-03-10T00:00:00.000Z'),
    });

    expect(overview.customerCount).toBe(2);
    expect(overview.debtorCustomerCount).toBe(1);
    expect(overview.staleDebtorCustomerCount).toBe(1);
    expect(overview.customers[0]?.followUpState).toBe('stale_debt');
    expect(overview.currencies).toEqual([
      { currencyCode: 'SAR', receivableMinor: 500n, payableMinor: 0n, debtorAccountCount: 1, creditAccountCount: 0 },
      { currencyCode: 'YER', receivableMinor: 1000n, payableMinor: 300n, debtorAccountCount: 1, creditAccountCount: 1 },
    ]);
  });

  it('rejects invalid staleness thresholds', async () => {
    await expect(assembleBusinessCollectionOverview(dataSource, { businessId: 'b1', limit: 100, staleAfterDays: 0 })).rejects.toThrow('staleAfterDays');
  });
});
