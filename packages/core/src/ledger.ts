export type LedgerDirection = 'debit' | 'credit';

export type LedgerTransactionType =
  | 'opening_balance'
  | 'sale_on_account'
  | 'receipt'
  | 'disbursement'
  | 'return'
  | 'discount'
  | 'adjustment'
  | 'reversal';

export type LedgerStatus = 'draft' | 'posted' | 'reversed' | 'voided';

export interface LedgerEntryInput {
  readonly direction: LedgerDirection;
  readonly amountMinor: bigint;
}

export function entryEffectMinor(entry: LedgerEntryInput): bigint {
  if (entry.amountMinor <= 0n) {
    throw new Error('Ledger entry amount must be positive');
  }

  return entry.direction === 'debit' ? entry.amountMinor : -entry.amountMinor;
}

export function transactionEffectMinor(entries: readonly LedgerEntryInput[]): bigint {
  return entries.reduce((total, entry) => total + entryEffectMinor(entry), 0n);
}

export function rebuildBalanceMinor(
  transactions: readonly {
    readonly status: LedgerStatus;
    readonly entries: readonly LedgerEntryInput[];
  }[],
): bigint {
  return transactions.reduce((balance, transaction) => {
    if (transaction.status !== 'posted' && transaction.status !== 'reversed') {
      return balance;
    }

    return balance + transactionEffectMinor(transaction.entries);
  }, 0n);
}

export function assertTransactionEffect(
  transactionType: LedgerTransactionType,
  netEffectMinor: bigint,
  originalEffectMinor?: bigint,
): void {
  if (netEffectMinor === 0n) {
    throw new Error('Posted transaction must have a non-zero ledger effect');
  }

  if (
    (transactionType === 'sale_on_account' || transactionType === 'disbursement') &&
    netEffectMinor <= 0n
  ) {
    throw new Error(`${transactionType} must increase customer balance`);
  }

  if (
    (transactionType === 'receipt' || transactionType === 'return' || transactionType === 'discount') &&
    netEffectMinor >= 0n
  ) {
    throw new Error(`${transactionType} must decrease customer balance`);
  }

  if (transactionType === 'reversal') {
    if (originalEffectMinor === undefined || originalEffectMinor === 0n) {
      throw new Error('Reversal requires a non-zero original effect');
    }

    if (netEffectMinor !== -originalEffectMinor) {
      throw new Error('Reversal must exactly negate the original transaction');
    }
  }
}
