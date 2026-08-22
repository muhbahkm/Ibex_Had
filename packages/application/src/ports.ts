import type { LedgerDirection, LedgerTransactionType } from '../../core/src/ledger.js';

export interface RequestContext { readonly actorUserId: string; readonly requestId?: string; }
export interface BusinessRecord { readonly id: string; readonly name: string; readonly defaultCurrencyCode?: string; }
export interface BusinessSummaryRecord { readonly businessId: string; readonly name: string; readonly role: string; readonly defaultCurrencyCode?: string; }
export interface CustomerRecord { readonly customerIdentityId: string; readonly businessCustomerId: string; readonly displayName: string; }
export interface BusinessCustomerSummaryRecord { readonly businessCustomerId: string; readonly customerIdentityId: string; readonly displayName: string; readonly accountCount: number; readonly createdAt: string; readonly phoneE164?: string; }
export interface AccountRecord { readonly id: string; readonly businessCustomerId: string; readonly currencyCode: string; }
export interface CustomerAccountSummaryRecord { readonly accountId: string; readonly businessCustomerId: string; readonly currencyCode: string; readonly status: string; readonly balanceMinor: bigint; }
export interface MyCustomerAccountRecord { readonly businessId: string; readonly businessName: string; readonly businessCustomerId: string; readonly customerIdentityId: string; readonly accountId: string; readonly currencyCode: string; readonly accountStatus: string; readonly balanceMinor: bigint; }
export interface CustomerInviteRecord { readonly inviteId: string; readonly token: string; readonly expiresAt: string; readonly businessCustomerId: string; readonly customerIdentityId: string; readonly displayName: string; }
export interface ClaimedCustomerInviteRecord { readonly businessId: string; readonly businessName: string; readonly businessCustomerId: string; readonly customerIdentityId: string; }
export interface PostedMovementRecord { readonly transactionId: string; readonly accountId: string; readonly balanceMinor: bigint; readonly currencyCode: string; }
export interface StatementEntryRecord { readonly transactionId: string; readonly transactionType: LedgerTransactionType; readonly transactionStatus: 'posted' | 'reversed'; readonly occurredAt: string; readonly description?: string; readonly effectMinor: bigint; readonly balanceAfterMinor: bigint; readonly currencyCode: string; readonly canReverse: boolean; }

export interface PreparedTransactionDocumentRecord {
  readonly documentId: string;
  readonly transactionId: string;
  readonly storageBucket: string;
  readonly storagePath: string;
  readonly fileName: string;
  readonly mimeType: string;
  readonly sizeBytes: number;
}
export interface TransactionDocumentRecord extends PreparedTransactionDocumentRecord { readonly createdAt: string; }

export type DisputeStatus = 'open' | 'under_review' | 'resolved' | 'rejected' | 'withdrawn';
export interface DisputeRecord {
  readonly disputeId: string;
  readonly transactionId: string;
  readonly businessId: string;
  readonly status: DisputeStatus;
  readonly reason: string;
  readonly resolutionNote?: string;
  readonly createdAt: string;
  readonly resolvedAt?: string;
}
export interface MyDisputeRecord extends DisputeRecord { readonly businessName: string; }
export interface BusinessDisputeRecord extends DisputeRecord { readonly customerIdentityId: string; readonly customerName: string; }

export interface CreateBusinessPortInput { readonly actorUserId: string; readonly name: string; readonly countryCode: string; readonly defaultCurrencyCode?: string; readonly requestId?: string; }
export interface CreateCustomerPortInput { readonly actorUserId: string; readonly businessId: string; readonly displayName: string; readonly phoneE164?: string; readonly requestId?: string; }
export interface OpenAccountPortInput { readonly actorUserId: string; readonly businessCustomerId: string; readonly currencyCode: string; readonly requestId?: string; }
export interface CreateCustomerInvitePortInput { readonly actorUserId: string; readonly businessCustomerId: string; readonly ttlHours: number; readonly requestId?: string; }
export interface ClaimCustomerInvitePortInput { readonly actorUserId: string; readonly token: string; readonly requestId?: string; }
export interface OpenDisputePortInput { readonly actorUserId: string; readonly transactionId: string; readonly reason: string; readonly requestId?: string; }
export interface UpdateDisputePortInput { readonly actorUserId: string; readonly disputeId: string; readonly status: 'under_review' | 'resolved' | 'rejected'; readonly resolutionNote?: string; readonly requestId?: string; }
export interface PrepareTransactionDocumentPortInput { readonly actorUserId: string; readonly transactionId: string; readonly fileName: string; readonly mimeType: string; readonly sizeBytes: number; readonly requestId?: string; }
export interface ListTransactionDocumentsPortInput { readonly actorUserId: string; readonly transactionId: string; }
export interface PostMovementPortInput { readonly actorUserId: string; readonly businessId: string; readonly customerIdentityId: string; readonly accountId: string; readonly transactionType: LedgerTransactionType; readonly direction: LedgerDirection; readonly amountMinor: bigint; readonly currencyCode: string; readonly idempotencyKey: string; readonly occurredAt?: string; readonly description?: string; readonly requestId?: string; }
export interface ReverseTransactionPortInput { readonly actorUserId: string; readonly transactionId: string; readonly idempotencyKey: string; readonly occurredAt?: string; readonly reason?: string; readonly requestId?: string; }
export interface ListBusinessesPortInput { readonly actorUserId: string; }
export interface ListBusinessCustomersPortInput { readonly actorUserId: string; readonly businessId: string; readonly limit: number; readonly search?: string; }
export interface ListCustomerAccountsPortInput { readonly actorUserId: string; readonly businessCustomerId: string; }
export interface ListMyCustomerAccountsPortInput { readonly actorUserId: string; }
export interface ListMyDisputesPortInput { readonly actorUserId: string; }
export interface ListBusinessDisputesPortInput { readonly actorUserId: string; readonly businessId: string; readonly status?: DisputeStatus; readonly limit: number; }
export interface GetStatementPortInput { readonly actorUserId: string; readonly accountId: string; readonly limit: number; readonly beforeOccurredAt?: string; }

export interface ApplicationRepository {
  createBusiness(input: CreateBusinessPortInput): Promise<BusinessRecord>;
  createCustomer(input: CreateCustomerPortInput): Promise<CustomerRecord>;
  openCustomerAccount(input: OpenAccountPortInput): Promise<AccountRecord>;
  createCustomerInvite(input: CreateCustomerInvitePortInput): Promise<CustomerInviteRecord>;
  claimCustomerInvite(input: ClaimCustomerInvitePortInput): Promise<ClaimedCustomerInviteRecord>;
  openDispute(input: OpenDisputePortInput): Promise<DisputeRecord>;
  updateDispute(input: UpdateDisputePortInput): Promise<DisputeRecord>;
  prepareTransactionDocument(input: PrepareTransactionDocumentPortInput): Promise<PreparedTransactionDocumentRecord>;
  listTransactionDocuments(input: ListTransactionDocumentsPortInput): Promise<readonly TransactionDocumentRecord[]>;
  postMovement(input: PostMovementPortInput): Promise<PostedMovementRecord>;
  reverseTransaction(input: ReverseTransactionPortInput): Promise<PostedMovementRecord>;
  listBusinesses(input: ListBusinessesPortInput): Promise<readonly BusinessSummaryRecord[]>;
  listBusinessCustomers(input: ListBusinessCustomersPortInput): Promise<readonly BusinessCustomerSummaryRecord[]>;
  listCustomerAccounts(input: ListCustomerAccountsPortInput): Promise<readonly CustomerAccountSummaryRecord[]>;
  listMyCustomerAccounts(input: ListMyCustomerAccountsPortInput): Promise<readonly MyCustomerAccountRecord[]>;
  listMyDisputes(input: ListMyDisputesPortInput): Promise<readonly MyDisputeRecord[]>;
  listBusinessDisputes(input: ListBusinessDisputesPortInput): Promise<readonly BusinessDisputeRecord[]>;
  getStatement(input: GetStatementPortInput): Promise<readonly StatementEntryRecord[]>;
}
