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

export interface CollectionBackendRow {
  readonly businessCustomerId: string;
  readonly customerIdentityId: string;
  readonly displayName: string;
  readonly phoneE164?: string;
  readonly accountCount: number;
  readonly accountId?: string;
  readonly currencyCode?: string;
  readonly balanceMinor?: bigint;
  readonly lastMovementAt?: string;
}

export interface CollectionBackendSource {
  listBusinessCollectionRows(input: { readonly businessId: string; readonly limit: number }): Promise<readonly CollectionBackendRow[]>;
}

export interface CollectionDataSource {
  listBusinessCustomers(input: { readonly businessId: string; readonly limit: number }): Promise<readonly BusinessCustomerSummaryRecord[]>;
  listCustomerAccounts(input: { readonly businessCustomerId: string }): Promise<readonly CustomerAccountSummaryRecord[]>;
  getStatement(input: { readonly accountId: string; readonly limit: number }): Promise<readonly StatementEntryRecord[]>;
}

type CollectionRepository = Pick<ApplicationRepository, 'listBusinessCustomers' | 'listCustomerAccounts' | 'getStatement'>;

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

function rankCustomers(customers: readonly CustomerCollectionSummary[]): readonly CustomerCollectionSummary[] {
  return [...customers].sort((left, right) => {
    const rank = { stale_debt: 0, active_debt: 1, clear: 2 } as const;
    const stateDifference = rank[left.followUpState] - rank[right.followUpState];
    if (stateDifference !== 0) return stateDifference;
    if (left.debtAccountCount !== right.debtAccountCount) return right.debtAccountCount - left.debtAccountCount;
    return (left.lastMovementAt ?? '').localeCompare(right.lastMovementAt ?? '');
  });
}

function finalizeOverview(
  businessId: string,
  customers: readonly CustomerCollectionSummary[],
  now: Date,
  staleAfterDays: number,
): BusinessCollectionOverview {
  const ranked = rankCustomers(customers);
  return {
    businessId,
    generatedAt: now.toISOString(),
    staleAfterDays,
    customerCount: ranked.length,
    debtorCustomerCount: ranked.filter((customer) => customer.debtAccountCount > 0).length,
    staleDebtorCustomerCount: ranked.filter((customer) => customer.followUpState === 'stale_debt').length,
    currencies: currencySummaries(ranked),
    customers: ranked,
  };
}

function normalizeStaleAfterDays(value: number | undefined): number {
  const staleAfterDays = value ?? 30;
  if (!Number.isInteger(staleAfterDays) || staleAfterDays < 1 || staleAfterDays > 3650) throw new Error('staleAfterDays must be an integer between 1 and 3650');
  return staleAfterDays;
}

async function accountSnapshot(dataSource: CollectionDataSource, account: CustomerAccountSummaryRecord): Promise<CollectionAccountSnapshot> {
  const statement = await dataSource.getStatement({ accountId: account.accountId, limit: 1 });
  const lastMovementAt = statement[0]?.occurredAt;
  return {
    accountId: account.accountId,
    currencyCode: account.currencyCode,
    balanceMinor: account.balanceMinor,
    ...(lastMovementAt ? { lastMovementAt } : {}),
  };
}

async function customerSummary(
  dataSource: CollectionDataSource,
  customer: BusinessCustomerSummaryRecord,
  now: Date,
  staleAfterDays: number,
): Promise<CustomerCollectionSummary> {
  const accounts = await dataSource.listCustomerAccounts({ businessCustomerId: customer.businessCustomerId });
  const snapshots = await Promise.all(accounts.map((account) => accountSnapshot(dataSource, account)));
  const lastMovementAt = latestTimestamp(snapshots.map((account) => account.lastMovementAt));
  return {
    businessCustomerId: customer.businessCustomerId,
    customerIdentityId: customer.customerIdentityId,
    displayName: customer.displayName,
    ...(customer.phoneE164 ? { phoneE164: customer.phoneE164 } : {}),
    accountCount: customer.accountCount,
    debtAccountCount: snapshots.filter((account) => account.balanceMinor > 0n).length,
    ...(lastMovementAt ? { lastMovementAt } : {}),
    followUpState: followUpState(snapshots, now, staleAfterDays),
    accounts: snapshots,
  };
}

export async function assembleBusinessCollectionOverview(
  dataSource: CollectionDataSource,
  input: { readonly businessId: string; readonly limit: number; readonly staleAfterDays?: number; readonly now?: Date },
): Promise<BusinessCollectionOverview> {
  const staleAfterDays = normalizeStaleAfterDays(input.staleAfterDays);
  const now = input.now ?? new Date();
  const customerRows = await dataSource.listBusinessCustomers({ businessId: input.businessId, limit: input.limit });
  const customers = await Promise.all(customerRows.map((customer) => customerSummary(dataSource, customer, now, staleAfterDays)));
  return finalizeOverview(input.businessId, customers, now, staleAfterDays);
}

export function assembleBusinessCollectionOverviewFromRows(
  rows: readonly CollectionBackendRow[],
  input: { readonly businessId: string; readonly staleAfterDays?: number; readonly now?: Date },
): BusinessCollectionOverview {
  const staleAfterDays = normalizeStaleAfterDays(input.staleAfterDays);
  const now = input.now ?? new Date();
  const byCustomer = new Map<string, { row: CollectionBackendRow; accounts: CollectionAccountSnapshot[] }>();
  for (const row of rows) {
    const current = byCustomer.get(row.businessCustomerId) ?? { row, accounts: [] };
    if (row.accountId && row.currencyCode && row.balanceMinor !== undefined) {
      current.accounts.push({
        accountId: row.accountId,
        currencyCode: row.currencyCode,
        balanceMinor: row.balanceMinor,
        ...(row.lastMovementAt ? { lastMovementAt: row.lastMovementAt } : {}),
      });
    }
    byCustomer.set(row.businessCustomerId, current);
  }
  const customers = [...byCustomer.values()].map(({ row, accounts }) => {
    const lastMovementAt = latestTimestamp(accounts.map((account) => account.lastMovementAt));
    return {
      businessCustomerId: row.businessCustomerId,
      customerIdentityId: row.customerIdentityId,
      displayName: row.displayName,
      ...(row.phoneE164 ? { phoneE164: row.phoneE164 } : {}),
      accountCount: row.accountCount,
      debtAccountCount: accounts.filter((account) => account.balanceMinor > 0n).length,
      ...(lastMovementAt ? { lastMovementAt } : {}),
      followUpState: followUpState(accounts, now, staleAfterDays),
      accounts,
    } satisfies CustomerCollectionSummary;
  });
  return finalizeOverview(input.businessId, customers, now, staleAfterDays);
}

export async function getBusinessCollectionOverviewFromBackend(
  source: CollectionBackendSource,
  input: { readonly businessId: string; readonly limit: number; readonly staleAfterDays?: number; readonly now?: Date },
): Promise<BusinessCollectionOverview> {
  const rows = await source.listBusinessCollectionRows({ businessId: input.businessId, limit: input.limit });
  return assembleBusinessCollectionOverviewFromRows(rows, input);
}

export async function buildBusinessCollectionOverview(
  repository: CollectionRepository,
  input: { readonly actorUserId: string; readonly businessId: string; readonly limit: number; readonly staleAfterDays?: number; readonly now?: Date },
): Promise<BusinessCollectionOverview> {
  const dataSource: CollectionDataSource = {
    listBusinessCustomers: ({ businessId, limit }) => repository.listBusinessCustomers({ actorUserId: input.actorUserId, businessId, limit }),
    listCustomerAccounts: ({ businessCustomerId }) => repository.listCustomerAccounts({ actorUserId: input.actorUserId, businessCustomerId }),
    getStatement: ({ accountId, limit }) => repository.getStatement({ actorUserId: input.actorUserId, accountId, limit }),
  };
  return assembleBusinessCollectionOverview(dataSource, input);
}
