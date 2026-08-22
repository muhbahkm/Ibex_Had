import { describe, expect, it } from 'vitest';

import {
  assertTransactionEffect,
  rebuildBalanceMinor,
  transactionEffectMinor,
} from './ledger.js';

describe('ledger invariants', () => {
  it('uses positive balance for money owed by the customer', () => {
    const sale = transactionEffectMinor([{ direction: 'debit', amountMinor: 1000n }]);
    const receipt = transactionEffectMinor([{ direction: 'credit', amountMinor: 400n }]);

    expect(sale).toBe(1000n);
    expect(receipt).toBe(-400n);
    expect(
      rebuildBalanceMinor([
        { status: 'posted', entries: [{ direction: 'debit', amountMinor: 1000n }] },
        { status: 'posted', entries: [{ direction: 'credit', amountMinor: 400n }] },
      ]),
    ).toBe(600n);
  });

  it('allows a negative balance when the business owes the customer', () => {
    expect(
      rebuildBalanceMinor([
        { status: 'posted', entries: [{ direction: 'credit', amountMinor: 300n }] },
      ]),
    ).toBe(-300n);
  });

  it('ignores draft and voided transactions', () => {
    expect(
      rebuildBalanceMinor([
        { status: 'draft', entries: [{ direction: 'debit', amountMinor: 500n }] },
        { status: 'voided', entries: [{ direction: 'debit', amountMinor: 700n }] },
      ]),
    ).toBe(0n);
  });

  it('keeps reversed originals in history and cancels them with a posted reversal', () => {
    expect(
      rebuildBalanceMinor([
        { status: 'reversed', entries: [{ direction: 'debit', amountMinor: 1000n }] },
        { status: 'posted', entries: [{ direction: 'credit', amountMinor: 1000n }] },
      ]),
    ).toBe(0n);
  });

  it('enforces transaction direction rules', () => {
    expect(() => assertTransactionEffect('sale_on_account', 1000n)).not.toThrow();
    expect(() => assertTransactionEffect('receipt', -500n)).not.toThrow();
    expect(() => assertTransactionEffect('receipt', 500n)).toThrow();
    expect(() => assertTransactionEffect('sale_on_account', -1000n)).toThrow();
  });

  it('requires an exact opposite effect for reversals', () => {
    expect(() => assertTransactionEffect('reversal', -1000n, 1000n)).not.toThrow();
    expect(() => assertTransactionEffect('reversal', -900n, 1000n)).toThrow();
  });

  it('rejects non-positive entry amounts', () => {
    expect(() => transactionEffectMinor([{ direction: 'debit', amountMinor: 0n }])).toThrow();
    expect(() => transactionEffectMinor([{ direction: 'credit', amountMinor: -1n }])).toThrow();
  });
});
