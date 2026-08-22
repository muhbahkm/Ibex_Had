import type {
  AccountRecord,
  ApplicationRepository,
  BusinessCustomerSummaryRecord,
  BusinessDisputeRecord,
  BusinessRecord,
  BusinessSummaryRecord,
  ClaimedCustomerInviteRecord,
  ClaimCustomerInvitePortInput,
  CreateBusinessPortInput,
  CreateCustomerInvitePortInput,
  CreateCustomerPortInput,
  CustomerAccountSummaryRecord,
  CustomerInviteRecord,
  CustomerRecord,
  DisputeRecord,
  DisputeStatus,
  GetStatementPortInput,
  ListBusinessCustomersPortInput,
  ListBusinessDisputesPortInput,
  ListBusinessesPortInput,
  ListCustomerAccountsPortInput,
  ListMyCustomerAccountsPortInput,
  ListMyDisputesPortInput,
  ListNotificationsPortInput,
  ListTransactionDocumentsPortInput,
  MarkedNotificationRecord,
  MarkNotificationReadPortInput,
  MyCustomerAccountRecord,
  MyDisputeRecord,
  NotificationKind,
  NotificationRecord,
  OpenAccountPortInput,
  OpenDisputePortInput,
  PostMovementPortInput,
  PostedMovementRecord,
  PreparedTransactionDocumentRecord,
  PrepareTransactionDocumentPortInput,
  ReverseTransactionPortInput,
  StatementEntryRecord,
  TransactionDocumentRecord,
  UpdateDisputePortInput,
} from '../../application/src/ports.js';
import type { LedgerTransactionType } from '../../core/src/ledger.js';

export interface RpcErrorLike { readonly message: string; readonly code?: string | undefined; readonly details?: string | undefined; readonly hint?: string | undefined; }
export interface RpcResponse<T = unknown> { readonly data: T | null; readonly error: RpcErrorLike | null; }
export interface SupabaseRpcClient { rpc(functionName: string, args?: Record<string, unknown>): Promise<RpcResponse>; }

export class InfrastructureError extends Error {
  readonly code?: string;
  readonly details?: string;
  readonly hint?: string;
  constructor(operation: string, error: RpcErrorLike) {
    super(`${operation}: ${error.message}`);
    this.name = 'InfrastructureError';
    if (error.code !== undefined) this.code = error.code;
    if (error.details !== undefined) this.details = error.details;
    if (error.hint !== undefined) this.hint = error.hint;
  }
}

type JsonObject = Record<string, unknown>;
function expectObject(value: unknown, operation: string): JsonObject { if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new InfrastructureError(operation, { message: 'RPC returned an invalid object payload' }); return value as JsonObject; }
function expectArray(value: unknown, operation: string): readonly unknown[] { if (!Array.isArray(value)) throw new InfrastructureError(operation, { message: 'RPC returned an invalid array payload' }); return value; }
function expectString(value: unknown, field: string, operation: string): string { if (typeof value !== 'string' || value.length === 0) throw new InfrastructureError(operation, { message: `RPC payload field ${field} is invalid` }); return value; }
function expectInteger(value: unknown, field: string, operation: string): number { if (typeof value !== 'number' || !Number.isInteger(value)) throw new InfrastructureError(operation, { message: `RPC payload field ${field} is not an integer` }); return value; }
function expectBoolean(value: unknown, field: string, operation: string): boolean { if (typeof value !== 'boolean') throw new InfrastructureError(operation, { message: `RPC payload field ${field} is not a boolean` }); return value; }
function parseBigInt(value: unknown, field: string, operation: string): bigint { if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'bigint') throw new InfrastructureError(operation, { message: `RPC payload field ${field} is not an integer` }); try { return BigInt(value); } catch { throw new InfrastructureError(operation, { message: `RPC payload field ${field} is not a valid bigint` }); } }
function parseSafeInteger(value: unknown, field: string, operation: string): number { const parsed = parseBigInt(value, field, operation); const numberValue = Number(parsed); if (!Number.isSafeInteger(numberValue)) throw new InfrastructureError(operation, { message: `RPC payload field ${field} exceeds the safe integer range` }); return numberValue; }
function nullableArg(value: string | undefined): string | null { return value ?? null; }
function parseDisputeStatus(value: unknown, field: string, operation: string): DisputeStatus {
  const status = expectString(value, field, operation);
  if (!['open','under_review','resolved','rejected','withdrawn'].includes(status)) throw new InfrastructureError(operation, { message: `RPC payload field ${field} is invalid` });
  return status as DisputeStatus;
}
function parseNotificationKind(value: unknown, field: string, operation: string): NotificationKind {
  const kind = expectString(value, field, operation);
  if (!['transaction_posted','dispute_opened','dispute_closed'].includes(kind)) throw new InfrastructureError(operation, { message: `RPC payload field ${field} is invalid` });
  return kind as NotificationKind;
}
function optionalString(value: unknown): string | undefined { return typeof value === 'string' && value.length > 0 ? value : undefined; }

export class SupabaseApplicationRepository implements ApplicationRepository {
  constructor(private readonly client: SupabaseRpcClient) {}

  async createBusiness(input: CreateBusinessPortInput): Promise<BusinessRecord> {
    const operation = 'app_create_business';
    const row = expectObject(await this.call(operation, { p_actor_user_id: input.actorUserId, p_name: input.name, p_country_code: input.countryCode, p_default_currency_code: nullableArg(input.defaultCurrencyCode), p_request_id: nullableArg(input.requestId) }), operation);
    return { id: expectString(row.id, 'id', operation), name: expectString(row.name, 'name', operation), ...(typeof row.defaultCurrencyCode === 'string' ? { defaultCurrencyCode: row.defaultCurrencyCode } : {}) };
  }
  async createCustomer(input: CreateCustomerPortInput): Promise<CustomerRecord> {
    const operation = 'app_create_customer';
    const row = expectObject(await this.call(operation, { p_actor_user_id: input.actorUserId, p_business_id: input.businessId, p_display_name: input.displayName, p_phone_e164: nullableArg(input.phoneE164), p_request_id: nullableArg(input.requestId) }), operation);
    return { customerIdentityId: expectString(row.customerIdentityId, 'customerIdentityId', operation), businessCustomerId: expectString(row.businessCustomerId, 'businessCustomerId', operation), displayName: expectString(row.displayName, 'displayName', operation) };
  }
  async openCustomerAccount(input: OpenAccountPortInput): Promise<AccountRecord> {
    const operation = 'app_open_customer_account';
    const row = expectObject(await this.call(operation, { p_actor_user_id: input.actorUserId, p_business_customer_id: input.businessCustomerId, p_currency_code: input.currencyCode, p_request_id: nullableArg(input.requestId) }), operation);
    return { id: expectString(row.id, 'id', operation), businessCustomerId: expectString(row.businessCustomerId, 'businessCustomerId', operation), currencyCode: expectString(row.currencyCode, 'currencyCode', operation) };
  }
  async createCustomerInvite(input: CreateCustomerInvitePortInput): Promise<CustomerInviteRecord> {
    const operation = 'app_create_customer_invite';
    const row = expectObject(await this.call(operation, { p_actor_user_id: input.actorUserId, p_business_customer_id: input.businessCustomerId, p_ttl_hours: input.ttlHours, p_request_id: nullableArg(input.requestId) }), operation);
    return { inviteId: expectString(row.inviteId, 'inviteId', operation), token: expectString(row.token, 'token', operation), expiresAt: expectString(row.expiresAt, 'expiresAt', operation), businessCustomerId: expectString(row.businessCustomerId, 'businessCustomerId', operation), customerIdentityId: expectString(row.customerIdentityId, 'customerIdentityId', operation), displayName: expectString(row.displayName, 'displayName', operation) };
  }
  async claimCustomerInvite(input: ClaimCustomerInvitePortInput): Promise<ClaimedCustomerInviteRecord> {
    const operation = 'app_claim_customer_invite';
    const row = expectObject(await this.call(operation, { p_actor_user_id: input.actorUserId, p_token: input.token, p_request_id: nullableArg(input.requestId) }), operation);
    return { businessId: expectString(row.businessId, 'businessId', operation), businessName: expectString(row.businessName, 'businessName', operation), businessCustomerId: expectString(row.businessCustomerId, 'businessCustomerId', operation), customerIdentityId: expectString(row.customerIdentityId, 'customerIdentityId', operation) };
  }
  async openDispute(input: OpenDisputePortInput): Promise<DisputeRecord> {
    const operation = 'app_open_dispute';
    const row = expectObject(await this.call(operation, { p_actor_user_id: input.actorUserId, p_transaction_id: input.transactionId, p_reason: input.reason, p_request_id: nullableArg(input.requestId) }), operation);
    return this.parseDispute(row, operation);
  }
  async updateDispute(input: UpdateDisputePortInput): Promise<DisputeRecord> {
    const operation = 'app_update_dispute';
    const row = expectObject(await this.call(operation, { p_actor_user_id: input.actorUserId, p_dispute_id: input.disputeId, p_status: input.status, p_resolution_note: nullableArg(input.resolutionNote), p_request_id: nullableArg(input.requestId) }), operation);
    return this.parseDispute(row, operation);
  }
  async prepareTransactionDocument(input: PrepareTransactionDocumentPortInput): Promise<PreparedTransactionDocumentRecord> {
    const operation = 'app_prepare_transaction_document';
    const row = expectObject(await this.call(operation, { p_actor_user_id: input.actorUserId, p_transaction_id: input.transactionId, p_file_name: input.fileName, p_mime_type: input.mimeType, p_size_bytes: input.sizeBytes, p_request_id: nullableArg(input.requestId) }), operation);
    return {
      documentId: expectString(row.documentId, 'documentId', operation),
      transactionId: expectString(row.transactionId, 'transactionId', operation),
      storageBucket: expectString(row.storageBucket, 'storageBucket', operation),
      storagePath: expectString(row.storagePath, 'storagePath', operation),
      fileName: expectString(row.fileName, 'fileName', operation),
      mimeType: expectString(row.mimeType, 'mimeType', operation),
      sizeBytes: parseSafeInteger(row.sizeBytes, 'sizeBytes', operation),
    };
  }
  async listTransactionDocuments(input: ListTransactionDocumentsPortInput): Promise<readonly TransactionDocumentRecord[]> {
    const operation = 'app_list_transaction_documents';
    const payload = expectArray(await this.call(operation, { p_actor_user_id: input.actorUserId, p_transaction_id: input.transactionId }), operation);
    return payload.map((value, index) => {
      const row = expectObject(value, operation);
      return {
        documentId: expectString(row.document_id, `rows[${index}].document_id`, operation),
        transactionId: expectString(row.transaction_id, `rows[${index}].transaction_id`, operation),
        storageBucket: expectString(row.storage_bucket, `rows[${index}].storage_bucket`, operation),
        storagePath: expectString(row.storage_path, `rows[${index}].storage_path`, operation),
        fileName: expectString(row.file_name, `rows[${index}].file_name`, operation),
        mimeType: expectString(row.mime_type, `rows[${index}].mime_type`, operation),
        sizeBytes: parseSafeInteger(row.size_bytes, `rows[${index}].size_bytes`, operation),
        createdAt: expectString(row.created_at, `rows[${index}].created_at`, operation),
      } satisfies TransactionDocumentRecord;
    });
  }
  async listNotifications(input: ListNotificationsPortInput): Promise<readonly NotificationRecord[]> {
    const operation = 'app_list_notifications';
    const payload = expectArray(await this.call(operation, { p_actor_user_id: input.actorUserId, p_unread_only: input.unreadOnly, p_limit: input.limit }), operation);
    return payload.map((value, index) => {
      const row = expectObject(value, operation);
      const disputeStatus = row.dispute_status === null || row.dispute_status === undefined ? undefined : parseDisputeStatus(row.dispute_status, `rows[${index}].dispute_status`, operation);
      return {
        notificationId: expectString(row.notification_id, `rows[${index}].notification_id`, operation),
        kind: parseNotificationKind(row.kind, `rows[${index}].kind`, operation),
        businessId: expectString(row.business_id, `rows[${index}].business_id`, operation),
        businessName: expectString(row.business_name, `rows[${index}].business_name`, operation),
        transactionId: expectString(row.transaction_id, `rows[${index}].transaction_id`, operation),
        transactionType: expectString(row.transaction_type, `rows[${index}].transaction_type`, operation) as LedgerTransactionType,
        ...(typeof row.dispute_id === 'string' ? { disputeId: row.dispute_id } : {}),
        ...(disputeStatus ? { disputeStatus } : {}),
        ...(typeof row.read_at === 'string' ? { readAt: row.read_at } : {}),
        createdAt: expectString(row.created_at, `rows[${index}].created_at`, operation),
      } satisfies NotificationRecord;
    });
  }
  async markNotificationRead(input: MarkNotificationReadPortInput): Promise<MarkedNotificationRecord> {
    const operation = 'app_mark_notification_read';
    const row = expectObject(await this.call(operation, { p_actor_user_id: input.actorUserId, p_notification_id: input.notificationId }), operation);
    return { notificationId: expectString(row.notificationId, 'notificationId', operation), readAt: expectString(row.readAt, 'readAt', operation) };
  }
  async postMovement(input: PostMovementPortInput): Promise<PostedMovementRecord> {
    const operation = 'app_post_movement';
    const row = expectObject(await this.call(operation, { p_actor_user_id: input.actorUserId, p_business_id: input.businessId, p_customer_identity_id: input.customerIdentityId, p_account_id: input.accountId, p_transaction_type: input.transactionType, p_direction: input.direction, p_amount_minor: input.amountMinor.toString(), p_currency_code: input.currencyCode, p_idempotency_key: input.idempotencyKey, p_occurred_at: nullableArg(input.occurredAt), p_description: nullableArg(input.description), p_request_id: nullableArg(input.requestId) }), operation);
    return this.parseMovement(row, operation);
  }
  async reverseTransaction(input: ReverseTransactionPortInput): Promise<PostedMovementRecord> {
    const operation = 'app_reverse_transaction';
    const row = expectObject(await this.call(operation, { p_actor_user_id: input.actorUserId, p_transaction_id: input.transactionId, p_idempotency_key: input.idempotencyKey, p_occurred_at: nullableArg(input.occurredAt), p_reason: nullableArg(input.reason), p_request_id: nullableArg(input.requestId) }), operation);
    return this.parseMovement(row, operation);
  }
  async listBusinesses(input: ListBusinessesPortInput): Promise<readonly BusinessSummaryRecord[]> {
    const operation = 'app_list_businesses';
    const payload = expectArray(await this.call(operation, { p_actor_user_id: input.actorUserId }), operation);
    return payload.map((value, index) => { const row = expectObject(value, operation); return { businessId: expectString(row.business_id, `rows[${index}].business_id`, operation), name: expectString(row.name, `rows[${index}].name`, operation), role: expectString(row.role, `rows[${index}].role`, operation), ...(typeof row.default_currency_code === 'string' ? { defaultCurrencyCode: row.default_currency_code } : {}) } satisfies BusinessSummaryRecord; });
  }
  async listBusinessCustomers(input: ListBusinessCustomersPortInput): Promise<readonly BusinessCustomerSummaryRecord[]> {
    const operation = 'app_list_business_customers';
    const payload = expectArray(await this.call(operation, { p_actor_user_id: input.actorUserId, p_business_id: input.businessId, p_limit: input.limit, p_search: nullableArg(input.search) }), operation);
    return payload.map((value, index) => { const row = expectObject(value, operation); return { businessCustomerId: expectString(row.business_customer_id, `rows[${index}].business_customer_id`, operation), customerIdentityId: expectString(row.customer_identity_id, `rows[${index}].customer_identity_id`, operation), displayName: expectString(row.display_name, `rows[${index}].display_name`, operation), accountCount: expectInteger(row.account_count, `rows[${index}].account_count`, operation), createdAt: expectString(row.created_at, `rows[${index}].created_at`, operation), ...(typeof row.phone_e164 === 'string' ? { phoneE164: row.phone_e164 } : {}) } satisfies BusinessCustomerSummaryRecord; });
  }
  async listCustomerAccounts(input: ListCustomerAccountsPortInput): Promise<readonly CustomerAccountSummaryRecord[]> {
    const operation = 'app_list_customer_accounts';
    const payload = expectArray(await this.call(operation, { p_actor_user_id: input.actorUserId, p_business_customer_id: input.businessCustomerId }), operation);
    return payload.map((value, index) => { const row = expectObject(value, operation); return { accountId: expectString(row.account_id, `rows[${index}].account_id`, operation), businessCustomerId: expectString(row.business_customer_id, `rows[${index}].business_customer_id`, operation), currencyCode: expectString(row.currency_code, `rows[${index}].currency_code`, operation), status: expectString(row.status, `rows[${index}].status`, operation), balanceMinor: parseBigInt(row.balance_minor, `rows[${index}].balance_minor`, operation) } satisfies CustomerAccountSummaryRecord; });
  }
  async listMyCustomerAccounts(input: ListMyCustomerAccountsPortInput): Promise<readonly MyCustomerAccountRecord[]> {
    const operation = 'app_list_my_customer_accounts';
    const payload = expectArray(await this.call(operation, { p_actor_user_id: input.actorUserId }), operation);
    return payload.map((value, index) => { const row = expectObject(value, operation); return { businessId: expectString(row.business_id, `rows[${index}].business_id`, operation), businessName: expectString(row.business_name, `rows[${index}].business_name`, operation), businessCustomerId: expectString(row.business_customer_id, `rows[${index}].business_customer_id`, operation), customerIdentityId: expectString(row.customer_identity_id, `rows[${index}].customer_identity_id`, operation), accountId: expectString(row.account_id, `rows[${index}].account_id`, operation), currencyCode: expectString(row.currency_code, `rows[${index}].currency_code`, operation), accountStatus: expectString(row.account_status, `rows[${index}].account_status`, operation), balanceMinor: parseBigInt(row.balance_minor, `rows[${index}].balance_minor`, operation) } satisfies MyCustomerAccountRecord; });
  }
  async listMyDisputes(input: ListMyDisputesPortInput): Promise<readonly MyDisputeRecord[]> {
    const operation = 'app_list_my_disputes';
    const payload = expectArray(await this.call(operation, { p_actor_user_id: input.actorUserId }), operation);
    return payload.map((value, index) => {
      const row = expectObject(value, operation);
      const base = this.parseDisputeRow(row, index, operation);
      return { ...base, businessName: expectString(row.business_name, `rows[${index}].business_name`, operation) } satisfies MyDisputeRecord;
    });
  }
  async listBusinessDisputes(input: ListBusinessDisputesPortInput): Promise<readonly BusinessDisputeRecord[]> {
    const operation = 'app_list_business_disputes';
    const payload = expectArray(await this.call(operation, { p_actor_user_id: input.actorUserId, p_business_id: input.businessId, p_status: nullableArg(input.status), p_limit: input.limit }), operation);
    return payload.map((value, index) => {
      const row = expectObject(value, operation);
      const base = this.parseDisputeRow(row, index, operation, input.businessId);
      return { ...base, customerIdentityId: expectString(row.customer_identity_id, `rows[${index}].customer_identity_id`, operation), customerName: expectString(row.customer_name, `rows[${index}].customer_name`, operation) } satisfies BusinessDisputeRecord;
    });
  }
  async getStatement(input: GetStatementPortInput): Promise<readonly StatementEntryRecord[]> {
    const operation = 'app_get_statement_v2';
    const payload = expectArray(await this.call(operation, { p_actor_user_id: input.actorUserId, p_account_id: input.accountId, p_limit: input.limit, p_before_occurred_at: nullableArg(input.beforeOccurredAt) }), operation);
    return payload.map((value, index) => {
      const row = expectObject(value, operation);
      const status = expectString(row.transaction_status, `rows[${index}].transaction_status`, operation);
      if (status !== 'posted' && status !== 'reversed') throw new InfrastructureError(operation, { message: `RPC payload field rows[${index}].transaction_status is invalid` });
      return { transactionId: expectString(row.transaction_id, `rows[${index}].transaction_id`, operation), transactionType: expectString(row.transaction_type, `rows[${index}].transaction_type`, operation) as LedgerTransactionType, transactionStatus: status, occurredAt: expectString(row.occurred_at, `rows[${index}].occurred_at`, operation), ...(typeof row.description === 'string' ? { description: row.description } : {}), effectMinor: parseBigInt(row.effect_minor, `rows[${index}].effect_minor`, operation), balanceAfterMinor: parseBigInt(row.balance_after_minor, `rows[${index}].balance_after_minor`, operation), currencyCode: expectString(row.currency_code, `rows[${index}].currency_code`, operation), canReverse: expectBoolean(row.can_reverse, `rows[${index}].can_reverse`, operation) } satisfies StatementEntryRecord;
    });
  }

  private async call(operation: string, args: Record<string, unknown>): Promise<unknown> { const { data, error } = await this.client.rpc(operation, args); if (error !== null) throw new InfrastructureError(operation, error); return data; }
  private parseMovement(row: JsonObject, operation: string): PostedMovementRecord { return { transactionId: expectString(row.transactionId, 'transactionId', operation), accountId: expectString(row.accountId, 'accountId', operation), balanceMinor: parseBigInt(row.balanceMinor, 'balanceMinor', operation), currencyCode: expectString(row.currencyCode, 'currencyCode', operation) }; }
  private parseDispute(row: JsonObject, operation: string): DisputeRecord {
    const resolutionNote = optionalString(row.resolutionNote);
    const resolvedAt = optionalString(row.resolvedAt);
    return { disputeId: expectString(row.disputeId, 'disputeId', operation), transactionId: expectString(row.transactionId, 'transactionId', operation), businessId: expectString(row.businessId, 'businessId', operation), status: parseDisputeStatus(row.status, 'status', operation), reason: expectString(row.reason, 'reason', operation), createdAt: expectString(row.createdAt, 'createdAt', operation), ...(resolutionNote ? { resolutionNote } : {}), ...(resolvedAt ? { resolvedAt } : {}) };
  }
  private parseDisputeRow(row: JsonObject, index: number, operation: string, fallbackBusinessId?: string): DisputeRecord {
    const resolutionNote = optionalString(row.resolution_note);
    const resolvedAt = optionalString(row.resolved_at);
    return { disputeId: expectString(row.dispute_id, `rows[${index}].dispute_id`, operation), transactionId: expectString(row.transaction_id, `rows[${index}].transaction_id`, operation), businessId: typeof row.business_id === 'string' ? row.business_id : expectString(fallbackBusinessId, `rows[${index}].business_id`, operation), status: parseDisputeStatus(row.status, `rows[${index}].status`, operation), reason: expectString(row.reason, `rows[${index}].reason`, operation), createdAt: expectString(row.created_at, `rows[${index}].created_at`, operation), ...(resolutionNote ? { resolutionNote } : {}), ...(resolvedAt ? { resolvedAt } : {}) };
  }
}
