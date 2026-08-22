import type { LedgerDirection, LedgerTransactionType } from '../../core/src/ledger.js';

export interface RequestContext {
  readonly actorUserId: string;
  readonly requestId?: string;
}

export interface BusinessRecord {
  readonly id: string;
  readonly name: string;
  readonly defaultCurrencyCode?: string;
}

export interface CustomerRecord {
  readonly customerIdentityId: string;
  readonly businessCustomerId: string;
  readonly displayName: string;
}

export interface AccountRecord {
  readonly id: string;
  readonly businessCustomerId: string;
  readonly currencyCode: string;
}

export interface PostedMovementRecord {
  readonly transactionId: string;
  readonly accountId: string;
  readonly balanceMinor: bigint;
  readonly currencyCode: string;
}

export interface StatementEntryRecord {
  readonly transactionId: string;
  readonly transactionType: LedgerTransactionType;
  readonly occurredAt: string;
  readonly description?: string;
  readonly effectMinor: bigint;
  readonly balanceAfterMinor: bigint;
  readonly currencyCode: string;
}

export interface CreateBusinessPortInput {
  readonly actorUserId: string;
  readonly name: string;
  readonly countryCode: string;
  readonly defaultCurrencyCode?: string;
  readonly requestId?: string;
}

export interface CreateCustomerPortInput {
  readonly actorUserId: string;
  readonly businessId: string;
  readonly displayName: string;
  readonly phoneE164?: string;
  readonly requestId?: string;
}

export interface OpenAccountPortInput {
  readonly actorUserId: string;
  readonly businessCustomerId: string;
  readonly currencyCode: string;
  readonly requestId?: string;
}

export interface PostMovementPortInput {
  readonly actorUserId: string;
  readonly businessId: string;
  readonly customerIdentityId: string;
  readonly accountId: string;
  readonly transactionType: LedgerTransactionType;
  readonly direction: LedgerDirection;
  readonly amountMinor: bigint;
  readonly currencyCode: string;
  readonly idempotencyKey: string;
  readonly occurredAt?: string;
  readonly description?: string;
  readonly requestId?: string;
}

export interface ReverseTransactionPortInput {
  readonly actorUserId: string;
  readonly transactionId: string;
  readonly idempotencyKey: string;
  readonly occurredAt?: string;
  readonly reason?: string;
  readonly requestId?: string;
}

export interface GetStatementPortInput {
  readonly actorUserId: string;
  readonly accountId: string;
  readonly limit: number;
  readonly beforeOccurredAt?: string;
}

export interface ApplicationRepository {
  createBusiness(input: CreateBusinessPortInput): Promise<BusinessRecord>;
  createCustomer(input: CreateCustomerPortInput): Promise<CustomerRecord>;
  openCustomerAccount(input: OpenAccountPortInput): Promise<AccountRecord>;
  postMovement(input: PostMovementPortInput): Promise<PostedMovementRecord>;
  reverseTransaction(input: ReverseTransactionPortInput): Promise<PostedMovementRecord>;
  getStatement(input: GetStatementPortInput): Promise<readonly StatementEntryRecord[]>;
}
