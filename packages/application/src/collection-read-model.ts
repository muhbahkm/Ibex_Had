import type {
  ApplicationRepository,
  BusinessCustomerSummaryRecord,
  CustomerAccountSummaryRecord,
  StatementEntryRecord,
} from './ports.js';

export interface CollectionCurrencySummary {
  readonly currencyCode: string;
  readonly receivableMinor: bigint;
  readonly payableMinor: bigint;
  readonly debtorAccountCount: number;
  readonly creditAccountCount: number;
}

export interface CollectionAccountSnapshot {
  readonly accountId: string;
  readonly currencyCode: string;
  readonly balanceMinor: bigint;
  readonly lastMovementAt?: string;
}

export type CollectionFollowUpState = 'stale_debt' | 'active_debt' | 'clear';

export interface CustomerCollectionSummary {
  readonly businessCustomerId: string;
  readonly customerIdentityId: string;
  readonly displayName: string;
  readonly phoneE164?: string;
  readonly accountCount: number;
  readonly debtAccountCount: number;
  readonly lastMovementAt?: string;
  readonly followUpState: CollectionFollowUpState;
  readonly accounts: readonly CollectionAccountSnapshot[];
}

export interface BusinessCollectionOverview {
  readonly businessId: string;
  readonly generatedAt: string;
  readonly staleAfterDays: number;
  readonly customerCount: number;
  readonly debtorCustomerCount: number;
  readonly staleDebtorCustomerCount: number;
  readonly currencies: readonly CollectionCurrencySummary[];
  readonly customers: readonly CustomerCollectionSummary[];
}

type CollectionRepository = Pick<
  ApplicationRepository,
  'listBusinessCustomers' | 'listCustomerAccounts' | 'getStatement'
>;

function latestTimestamp(values: readonly (string | undefined)[]): string | undefined {
  const present = values.filter((value): value is string => Boolean(value));
  return present.length === 0 ? undefined : present.reduce((latest, value) => value > latest ? value : latest);
}

function isStale(lastMovementAt: string | undefined, now: Date, staleAfterDays: number): boolean {
  if (!lastMovementAt) return true;
  const elapsed = now.getTime() - new Date(lastMovementAt).getTime();
  return elapsed >= staleAfterDays * 24 * 60 * 60 * 1000;
}

function followUpState(accounts: readonly CollectionAccountSnapshot[], now: Date, staleAfterDays: number): CollectionFollowUpState {
  const debtAccounts = accounts.filter((account) => account.balanceMinor > 0n);
  if (debtAccounts.length === 0) return 'clear';
  return debtAccounts.some((account) => isStale(account.lastMovementAt, now, staleAfterDays)) ? 'stale_debt' : 'active_debt';
}

function currencySummaries(customers: readonly CustomerCollectionSummary[]): readonly CollectionCurrencySummary[] {
  const byCurrency = new Map<string, { receivableMinor: bigint; payableMinor: bigint; debtorAccountCount: number; creditAccountCount: number }>();
  for (const customer of customers) {
    for (const account of customer.accounts) {
      const current = byCurrency.get(account.currencyCode) ?? { receivableMinor: 0n, payableMinor: 0n, debtorAccountCount: 0, creditAccountCount: 0 };
      if (account.balanceMinor > 0n) {
        current.receivableMinor += account.balanceMinor;
        current.debtorAccountCount += 1;
      } else if (account.balanceMinor < 0n) {
        current.payableMinor += -account.balanceMinor;
        current.creditAccountCount += 1;
      }
      byCurrency.set(account.currencyCode, current);
    }
  }
  return [...byCurrency.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([currencyCode, value]) => ({ currencyCode, ...value }));
}

async function accountSnapshot(
  repository: CollectionRepository,
  actorUserId: string,
  account: CustomerAccountSummaryRecord,
): Promise<CollectionAccountSnapshot> {
  const statement: readonly StatementEntryRecord[] = await repository.getStatement({ actorUserId, accountId: account.accountId, limit: 1 });
  const lastMovementAt = statement[0]?.occurredAt;
  return {
    accountId: account.accountId,
    currencyCode: account.currencyCode,
    balanceMinor: account.balanceMinor,
    ...(lastMovementAt ? { lastMovementAt } : {}),
  };
}

async function customerSummary(
  repository: CollectionRepository,
  actorUserId: string,
  customer: BusinessCustomerSummaryRecord,
  now: Date,
  staleAfterDays: number,
): Promise<CustomerCollectionSummary> {
  const accounts = await repository.listCustomerAccounts({ actorUserId, businessCustomerId: customer.businessCustomerId });
  const snapshots = await Promise.all(accounts.map((account) => accountSnapshot(repository, actorUserId, account)));
  const lastMovementAt = latestTimestamp(snapshots.map((account) => account.lastMovementAt));
  const state = followUpState(snapshots, now, staleAfterDays);
  return {
    businessCustomerId: customer.businessCustomerId,
    customerIdentityId: customer.customerIdentityId,
    displayName: customer.displayName,
    ...(customer.phoneE164 ? { phoneE164: customer.phoneE164 } : {}),
    accountCount: customer.accountCount,
    debtAccountCount: snapshots.filter((account) => account.balanceMinor > 0n).length,
    ...(lastMovementAt ? { lastMovementAt } : {}),
    followUpState: state,
    accounts: snapshots,
  };
}

export async function buildBusinessCollectionOverview(
  repository: CollectionRepository,
  input: { readonly actorUserId: string; readonly businessId: string; readonly limit: number; readonly staleAfterDays?: number; readonly now?: Date },
): Promise<BusinessCollectionOverview> {
  const staleAfterDays = input.staleAfterDays ?? 30;
  if (!Number.isInteger(staleAfterDays) || staleAfterDays < 1 || staleAfterDays > 3650) throw new Error('staleAfterDays must be an integer between 1 and 3650');
  const now = input.now ?? new Date();
  const customerRows = await repository.listBusinessCustomers({ actorUserId: input.actorUserId, businessId: input.businessId, limit: input.limit });
  const customers = await Promise.all(customerRows.map((customer) => customerSummary(repository, input.actorUserId, customer, now, staleAfterDays)));
  const ranked = [...customers].sort((left, right) => {
    const rank = { stale_debt: 0, active_debt: 1, clear: 2 } as const;
    const stateDifference = rank[left.followUpState] - rank[right.followUpState];
    if (stateDifference !== 0) return stateDifference;
    if (left.debtAccountCount !== right.debtAccountCount) return right.debtAccountCount - left.debtAccountCount;
    return (left.lastMovementAt ?? '').localeCompare(right.lastMovementAt ?? '');
  });
  return {
    businessId: input.businessId,
    generatedAt: now.toISOString(),
    staleAfterDays,
    customerCount: ranked.length,
    debtorCustomerCount: ranked.filter((customer) => customer.debtAccountCount > 0).length,
    staleDebtorCustomerCount: ranked.filter((customer) => customer.followUpState === 'stale_debt').length,
    currencies: currencySummaries(ranked),
    customers: ranked,
  };
}
