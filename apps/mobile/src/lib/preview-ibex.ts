import type {
  AccountRecord,
  BusinessCustomerSummaryRecord,
  BusinessDisputeRecord,
  BusinessRecord,
  BusinessSummaryRecord,
  CustomerAccountSummaryRecord,
  CustomerInviteRecord,
  CustomerRecord,
  DisputeRecord,
  MarkedNotificationRecord,
  MyCustomerAccountRecord,
  MyDisputeRecord,
  NotificationRecord,
  PostedMovementRecord,
  PreparedTransactionDocumentRecord,
  StatementEntryRecord,
  TransactionDocumentRecord,
} from '../../../../packages/application/src/ports';

const now = () => new Date().toISOString();
const id = (prefix: string) => `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

type DemoCustomer = BusinessCustomerSummaryRecord;
type DemoAccount = CustomerAccountSummaryRecord & { readonly customerIdentityId: string; readonly businessId: string };

const businesses: BusinessSummaryRecord[] = [
  { businessId: 'demo-business-1', name: 'باحكم للعسل — تجريبي', role: 'owner', defaultCurrencyCode: 'YER' },
];

const customers: DemoCustomer[] = [
  { businessCustomerId: 'demo-customer-1', customerIdentityId: 'demo-identity-1', displayName: 'أحمد سالم', accountCount: 2, createdAt: '2026-08-20T09:00:00.000Z', phoneE164: '+967771234567' },
  { businessCustomerId: 'demo-customer-2', customerIdentityId: 'demo-identity-2', displayName: 'محمد عبدالله', accountCount: 1, createdAt: '2026-08-21T11:00:00.000Z', phoneE164: '+967733456789' },
  { businessCustomerId: 'demo-customer-3', customerIdentityId: 'demo-identity-3', displayName: 'زبون عام', accountCount: 1, createdAt: '2026-08-22T08:00:00.000Z' },
];

const accounts: DemoAccount[] = [
  { accountId: 'demo-account-1', businessCustomerId: 'demo-customer-1', customerIdentityId: 'demo-identity-1', businessId: 'demo-business-1', currencyCode: 'YER', status: 'active', balanceMinor: 8500000n },
  { accountId: 'demo-account-2', businessCustomerId: 'demo-customer-1', customerIdentityId: 'demo-identity-1', businessId: 'demo-business-1', currencyCode: 'SAR', status: 'active', balanceMinor: 12500n },
  { accountId: 'demo-account-3', businessCustomerId: 'demo-customer-2', customerIdentityId: 'demo-identity-2', businessId: 'demo-business-1', currencyCode: 'YER', status: 'active', balanceMinor: 3200000n },
  { accountId: 'demo-account-4', businessCustomerId: 'demo-customer-3', customerIdentityId: 'demo-identity-3', businessId: 'demo-business-1', currencyCode: 'YER', status: 'active', balanceMinor: 0n },
];

const statements = new Map<string, StatementEntryRecord[]>([
  ['demo-account-1', [
    { transactionId: 'demo-tx-3', transactionType: 'receipt', transactionStatus: 'posted', occurredAt: '2026-08-22T10:30:00.000Z', description: 'دفعة نقدية', effectMinor: -1500000n, balanceAfterMinor: 8500000n, currencyCode: 'YER', canReverse: true },
    { transactionId: 'demo-tx-2', transactionType: 'sale_on_account', transactionStatus: 'posted', occurredAt: '2026-08-21T15:10:00.000Z', description: 'عسل سدر درجة أولى', effectMinor: 5000000n, balanceAfterMinor: 10000000n, currencyCode: 'YER', canReverse: true },
    { transactionId: 'demo-tx-1', transactionType: 'opening_balance', transactionStatus: 'posted', occurredAt: '2026-08-20T09:00:00.000Z', description: 'رصيد افتتاحي', effectMinor: 5000000n, balanceAfterMinor: 5000000n, currencyCode: 'YER', canReverse: false },
  ]],
  ['demo-account-2', [
    { transactionId: 'demo-tx-sar-1', transactionType: 'sale_on_account', transactionStatus: 'posted', occurredAt: '2026-08-22T12:15:00.000Z', description: 'طلب تجريبي', effectMinor: 12500n, balanceAfterMinor: 12500n, currencyCode: 'SAR', canReverse: true },
  ]],
]);

const notifications: NotificationRecord[] = [
  { notificationId: 'demo-notification-1', kind: 'dispute_opened', businessId: 'demo-business-1', businessName: 'باحكم للعسل — تجريبي', transactionId: 'demo-tx-2', transactionType: 'sale_on_account', disputeId: 'demo-dispute-1', disputeStatus: 'open', createdAt: '2026-08-22T13:20:00.000Z' },
  { notificationId: 'demo-notification-2', kind: 'transaction_posted', businessId: 'demo-business-1', businessName: 'باحكم للعسل — تجريبي', transactionId: 'demo-tx-3', transactionType: 'receipt', createdAt: '2026-08-22T10:30:00.000Z' },
];

const disputes: BusinessDisputeRecord[] = [
  { disputeId: 'demo-dispute-1', transactionId: 'demo-tx-2', businessId: 'demo-business-1', customerIdentityId: 'demo-identity-1', customerName: 'أحمد سالم', status: 'open', reason: 'أرجو مراجعة قيمة هذه الحركة التجريبية.', createdAt: '2026-08-22T13:20:00.000Z' },
];

function accountById(accountId: string): DemoAccount {
  const account = accounts.find((row) => row.accountId === accountId);
  if (!account) throw new Error('الحساب التجريبي غير موجود.');
  return account;
}

function rebuildStatement(accountId: string) {
  const rows = statements.get(accountId) ?? [];
  let balance = 0n;
  const chronological = [...rows].sort((a, b) => a.occurredAt.localeCompare(b.occurredAt));
  for (const row of chronological) {
    balance += row.effectMinor;
    (row as { balanceAfterMinor: bigint }).balanceAfterMinor = balance;
  }
  statements.set(accountId, chronological.reverse());
  const account = accountById(accountId);
  (account as { balanceMinor: bigint }).balanceMinor = balance;
}

export class PreviewIbexApplication {
  async currentUserId() { return 'preview-user'; }

  async listBusinesses(): Promise<readonly BusinessSummaryRecord[]> { return businesses; }

  async createBusiness(input: { readonly name: string; readonly countryCode?: string; readonly defaultCurrencyCode?: string }): Promise<BusinessRecord> {
    const businessId = id('demo-business');
    const defaultCurrencyCode = input.defaultCurrencyCode ?? 'YER';
    const row: BusinessSummaryRecord = { businessId, name: input.name.trim(), role: 'owner', defaultCurrencyCode };
    businesses.unshift(row);
    return { id: businessId, name: row.name, defaultCurrencyCode };
  }

  async listBusinessCustomers(input: { readonly businessId: string; readonly limit?: number; readonly search?: string }): Promise<readonly BusinessCustomerSummaryRecord[]> {
    const search = input.search?.trim().toLowerCase();
    const rows = search ? customers.filter((row) => row.displayName.toLowerCase().includes(search) || row.phoneE164?.includes(search)) : customers;
    return rows.slice(0, input.limit ?? 100);
  }

  async createCustomer(input: { readonly businessId: string; readonly displayName: string; readonly phone?: string }): Promise<CustomerRecord> {
    const businessCustomerId = id('demo-customer');
    const customerIdentityId = id('demo-identity');
    customers.unshift({ businessCustomerId, customerIdentityId, displayName: input.displayName.trim(), accountCount: 0, createdAt: now(), ...(input.phone?.trim() ? { phoneE164: input.phone.trim() } : {}) });
    return { businessCustomerId, customerIdentityId, displayName: input.displayName.trim() };
  }

  async listCustomerAccounts(input: { readonly businessCustomerId: string }): Promise<readonly CustomerAccountSummaryRecord[]> {
    return accounts.filter((row) => row.businessCustomerId === input.businessCustomerId);
  }

  async openCustomerAccount(input: { readonly businessCustomerId: string; readonly currencyCode: string }): Promise<AccountRecord> {
    const customer = customers.find((row) => row.businessCustomerId === input.businessCustomerId);
    if (!customer) throw new Error('العميل التجريبي غير موجود.');
    const existing = accounts.find((row) => row.businessCustomerId === input.businessCustomerId && row.currencyCode === input.currencyCode.toUpperCase());
    if (existing) return { id: existing.accountId, businessCustomerId: existing.businessCustomerId, currencyCode: existing.currencyCode };
    const accountId = id('demo-account');
    accounts.unshift({ accountId, businessCustomerId: input.businessCustomerId, customerIdentityId: customer.customerIdentityId, businessId: 'demo-business-1', currencyCode: input.currencyCode.toUpperCase(), status: 'active', balanceMinor: 0n });
    (customer as { accountCount: number }).accountCount += 1;
    return { id: accountId, businessCustomerId: input.businessCustomerId, currencyCode: input.currencyCode.toUpperCase() };
  }

  async listMyCustomerAccounts(): Promise<readonly MyCustomerAccountRecord[]> {
    return [
      { businessId: 'demo-external-business', businessName: 'متجر حضرموت — تجريبي', businessCustomerId: 'demo-self-customer', customerIdentityId: 'demo-self-identity', accountId: 'demo-self-account', currencyCode: 'YER', accountStatus: 'active', balanceMinor: 2400000n },
    ];
  }

  async getStatement(input: { readonly accountId: string; readonly limit?: number }): Promise<readonly StatementEntryRecord[]> {
    if (input.accountId === 'demo-self-account') {
      return [{ transactionId: 'demo-self-tx', transactionType: 'sale_on_account', transactionStatus: 'posted', occurredAt: '2026-08-21T16:00:00.000Z', description: 'عملية شراء تجريبية', effectMinor: 2400000n, balanceAfterMinor: 2400000n, currencyCode: 'YER', canReverse: false }];
    }
    return (statements.get(input.accountId) ?? []).slice(0, input.limit ?? 50);
  }

  private async post(input: { readonly businessId: string; readonly customerIdentityId: string; readonly accountId: string; readonly amountMinor: string; readonly currencyCode: string; readonly description?: string }, type: 'sale_on_account' | 'receipt'): Promise<PostedMovementRecord> {
    const account = accountById(input.accountId);
    const amount = BigInt(input.amountMinor);
    if (amount <= 0n) throw new Error('المبلغ يجب أن يكون أكبر من صفر.');
    const effect = type === 'sale_on_account' ? amount : -amount;
    const transactionId = id('demo-tx');
    const rows = statements.get(input.accountId) ?? [];
    rows.unshift({ transactionId, transactionType: type, transactionStatus: 'posted', occurredAt: now(), ...(input.description?.trim() ? { description: input.description.trim() } : {}), effectMinor: effect, balanceAfterMinor: account.balanceMinor + effect, currencyCode: input.currencyCode, canReverse: true });
    statements.set(input.accountId, rows);
    rebuildStatement(input.accountId);
    notifications.unshift({ notificationId: id('demo-notification'), kind: 'transaction_posted', businessId: input.businessId, businessName: businesses.find((row) => row.businessId === input.businessId)?.name ?? 'النشاط التجريبي', transactionId, transactionType: type, createdAt: now() });
    return { transactionId, accountId: input.accountId, balanceMinor: accountById(input.accountId).balanceMinor, currencyCode: input.currencyCode };
  }

  async postSale(input: { readonly businessId: string; readonly customerIdentityId: string; readonly accountId: string; readonly amountMinor: string; readonly currencyCode: string; readonly idempotencyKey: string; readonly description?: string }) { return this.post(input, 'sale_on_account'); }
  async postReceipt(input: { readonly businessId: string; readonly customerIdentityId: string; readonly accountId: string; readonly amountMinor: string; readonly currencyCode: string; readonly idempotencyKey: string; readonly description?: string }) { return this.post(input, 'receipt'); }

  async reverseTransaction(input: { readonly transactionId: string; readonly idempotencyKey: string; readonly reason?: string }): Promise<PostedMovementRecord> {
    for (const [accountId, rows] of statements) {
      const original = rows.find((row) => row.transactionId === input.transactionId);
      if (!original) continue;
      if (!original.canReverse) throw new Error('هذه الحركة لا يمكن عكسها في وضع العرض.');
      (original as { canReverse: boolean; transactionStatus: 'posted' | 'reversed' }).canReverse = false;
      (original as { transactionStatus: 'posted' | 'reversed' }).transactionStatus = 'reversed';
      const reversalId = id('demo-reversal');
      rows.unshift({ transactionId: reversalId, transactionType: 'reversal', transactionStatus: 'posted', occurredAt: now(), description: input.reason ?? 'عكس تجريبي', effectMinor: -original.effectMinor, balanceAfterMinor: 0n, currencyCode: original.currencyCode, canReverse: false });
      rebuildStatement(accountId);
      const account = accountById(accountId);
      return { transactionId: reversalId, accountId, balanceMinor: account.balanceMinor, currencyCode: account.currencyCode };
    }
    throw new Error('الحركة التجريبية غير موجودة.');
  }

  async listNotifications(input: { readonly unreadOnly?: boolean; readonly limit?: number } = {}): Promise<readonly NotificationRecord[]> {
    const rows = input.unreadOnly ? notifications.filter((row) => !row.readAt) : notifications;
    return rows.slice(0, input.limit ?? 50);
  }

  async markNotificationRead(input: { readonly notificationId: string }): Promise<MarkedNotificationRecord> {
    const row = notifications.find((item) => item.notificationId === input.notificationId);
    if (!row) throw new Error('الإشعار التجريبي غير موجود.');
    const readAt = now();
    (row as { readAt?: string }).readAt = readAt;
    return { notificationId: row.notificationId, readAt };
  }

  async listBusinessDisputes(input: { readonly businessId: string; readonly status?: string; readonly limit?: number }): Promise<readonly BusinessDisputeRecord[]> {
    const rows = disputes.filter((row) => row.businessId === input.businessId && (!input.status || row.status === input.status));
    return rows.slice(0, input.limit ?? 100);
  }

  async listMyDisputes(): Promise<readonly MyDisputeRecord[]> { return []; }

  async openDispute(input: { readonly transactionId: string; readonly reason: string }): Promise<DisputeRecord> {
    const disputeId = id('demo-dispute');
    const row: BusinessDisputeRecord = { disputeId, transactionId: input.transactionId, businessId: 'demo-business-1', customerIdentityId: 'demo-self-identity', customerName: 'مستخدم المعاينة', status: 'open', reason: input.reason, createdAt: now() };
    disputes.unshift(row);
    return row;
  }

  async updateDispute(input: { readonly disputeId: string; readonly status: 'under_review' | 'resolved' | 'rejected'; readonly resolutionNote?: string }): Promise<DisputeRecord> {
    const row = disputes.find((item) => item.disputeId === input.disputeId);
    if (!row) throw new Error('طلب المراجعة التجريبي غير موجود.');
    (row as { status: 'open' | 'under_review' | 'resolved' | 'rejected' | 'withdrawn'; resolutionNote?: string; resolvedAt?: string }).status = input.status;
    if (input.resolutionNote) (row as { resolutionNote?: string }).resolutionNote = input.resolutionNote;
    if (input.status === 'resolved' || input.status === 'rejected') (row as { resolvedAt?: string }).resolvedAt = now();
    return row;
  }

  async createCustomerInvite(input: { readonly businessCustomerId: string; readonly ttlHours?: number }): Promise<CustomerInviteRecord> {
    const customer = customers.find((row) => row.businessCustomerId === input.businessCustomerId);
    if (!customer) throw new Error('العميل التجريبي غير موجود.');
    return { inviteId: id('demo-invite'), token: '0123456789abcdef0123456789abcdef0123456789abcdef', expiresAt: new Date(Date.now() + (input.ttlHours ?? 168) * 3600000).toISOString(), businessCustomerId: customer.businessCustomerId, customerIdentityId: customer.customerIdentityId, displayName: customer.displayName };
  }

  async claimCustomerInvite() { return { businessId: 'demo-business-1', businessName: 'باحكم للعسل — تجريبي', businessCustomerId: 'demo-customer-1', customerIdentityId: 'demo-identity-1' }; }

  async prepareTransactionDocument(input: { readonly transactionId: string; readonly fileName: string; readonly mimeType: string; readonly sizeBytes: number }): Promise<PreparedTransactionDocumentRecord> {
    return { documentId: id('demo-document'), transactionId: input.transactionId, storageBucket: 'preview-only', storagePath: 'preview-only/no-upload', fileName: input.fileName, mimeType: input.mimeType, sizeBytes: input.sizeBytes };
  }

  async listTransactionDocuments(input: { readonly transactionId: string }): Promise<readonly TransactionDocumentRecord[]> {
    if (!input.transactionId.startsWith('demo-')) return [];
    return [{ documentId: 'demo-document-1', transactionId: input.transactionId, storageBucket: 'preview-only', storagePath: 'preview-only/sample.pdf', fileName: 'فاتورة-تجريبية.pdf', mimeType: 'application/pdf', sizeBytes: 184320, createdAt: '2026-08-22T12:00:00.000Z' }];
  }
}

export function createPreviewIbexApplication() { return new PreviewIbexApplication(); }