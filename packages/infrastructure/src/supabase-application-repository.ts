import type {
  AccountRecord,
  ApplicationRepository,
  BusinessCustomerSummaryRecord,
  BusinessRecord,
  BusinessSummaryRecord,
  CreateBusinessPortInput,
  CreateCustomerPortInput,
  CustomerAccountSummaryRecord,
  CustomerRecord,
  GetStatementPortInput,
  ListBusinessCustomersPortInput,
  ListBusinessesPortInput,
  ListCustomerAccountsPortInput,
  ListMyCustomerAccountsPortInput,
  MyCustomerAccountRecord,
  OpenAccountPortInput,
  PostMovementPortInput,
  PostedMovementRecord,
  ReverseTransactionPortInput,
  StatementEntryRecord,
} from '../../application/src/ports.js';
import type { LedgerTransactionType } from '../../core/src/ledger.js';

export interface RpcErrorLike {
  readonly message: string;
  readonly code?: string | undefined;
  readonly details?: string | undefined;
  readonly hint?: string | undefined;
}

export interface RpcResponse<T = unknown> {
  readonly data: T | null;
  readonly error: RpcErrorLike | null;
}

export interface SupabaseRpcClient {
  rpc(functionName: string, args?: Record<string, unknown>): Promise<RpcResponse>;
}

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

function expectObject(value: unknown, operation: string): JsonObject {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new InfrastructureError(operation, { message: 'RPC returned an invalid object payload' });
  }
  return value as JsonObject;
}

function expectArray(value: unknown, operation: string): readonly unknown[] {
  if (!Array.isArray(value)) {
    throw new InfrastructureError(operation, { message: 'RPC returned an invalid array payload' });
  }
  return value;
}

function expectString(value: unknown, field: string, operation: string): string {
  if (typeof value !== 'string' || value.length === 0) {
    throw new InfrastructureError(operation, { message: `RPC payload field ${field} is invalid` });
  }
  return value;
}

function expectInteger(value: unknown, field: string, operation: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) {
    throw new InfrastructureError(operation, { message: `RPC payload field ${field} is not an integer` });
  }
  return value;
}

function expectBoolean(value: unknown, field: string, operation: string): boolean {
  if (typeof value !== 'boolean') {
    throw new InfrastructureError(operation, { message: `RPC payload field ${field} is not a boolean` });
  }
  return value;
}

function parseBigInt(value: unknown, field: string, operation: string): bigint {
  if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'bigint') {
    throw new InfrastructureError(operation, { message: `RPC payload field ${field} is not an integer` });
  }
  try {
    return BigInt(value);
  } catch {
    throw new InfrastructureError(operation, { message: `RPC payload field ${field} is not a valid bigint` });
  }
}

function nullableArg(value: string | undefined): string | null {
  return value ?? null;
}

export class SupabaseApplicationRepository implements ApplicationRepository {
  constructor(private readonly client: SupabaseRpcClient) {}

  async createBusiness(input: CreateBusinessPortInput): Promise<BusinessRecord> {
    const operation = 'app_create_business';
    const row = expectObject(
      await this.call(operation, {
        p_actor_user_id: input.actorUserId,
        p_name: input.name,
        p_country_code: input.countryCode,
        p_default_currency_code: nullableArg(input.defaultCurrencyCode),
        p_request_id: nullableArg(input.requestId),
      }),
      operation,
    );
    const defaultCurrencyCode = row.defaultCurrencyCode;
    return {
      id: expectString(row.id, 'id', operation),
      name: expectString(row.name, 'name', operation),
      ...(typeof defaultCurrencyCode === 'string' ? { defaultCurrencyCode } : {}),
    };
  }

  async createCustomer(input: CreateCustomerPortInput): Promise<CustomerRecord> {
    const operation = 'app_create_customer';
    const row = expectObject(
      await this.call(operation, {
        p_actor_user_id: input.actorUserId,
        p_business_id: input.businessId,
        p_display_name: input.displayName,
        p_phone_e164: nullableArg(input.phoneE164),
        p_request_id: nullableArg(input.requestId),
      }),
      operation,
    );
    return {
      customerIdentityId: expectString(row.customerIdentityId, 'customerIdentityId', operation),
      businessCustomerId: expectString(row.businessCustomerId, 'businessCustomerId', operation),
      displayName: expectString(row.displayName, 'displayName', operation),
    };
  }

  async openCustomerAccount(input: OpenAccountPortInput): Promise<AccountRecord> {
    const operation = 'app_open_customer_account';
    const row = expectObject(
      await this.call(operation, {
        p_actor_user_id: input.actorUserId,
        p_business_customer_id: input.businessCustomerId,
        p_currency_code: input.currencyCode,
        p_request_id: nullableArg(input.requestId),
      }),
      operation,
    );
    return {
      id: expectString(row.id, 'id', operation),
      businessCustomerId: expectString(row.businessCustomerId, 'businessCustomerId', operation),
      currencyCode: expectString(row.currencyCode, 'currencyCode', operation),
    };
  }

  async postMovement(input: PostMovementPortInput): Promise<PostedMovementRecord> {
    const operation = 'app_post_movement';
    const row = expectObject(
      await this.call(operation, {
        p_actor_user_id: input.actorUserId,
        p_business_id: input.businessId,
        p_customer_identity_id: input.customerIdentityId,
        p_account_id: input.accountId,
        p_transaction_type: input.transactionType,
        p_direction: input.direction,
        p_amount_minor: input.amountMinor.toString(),
        p_currency_code: input.currencyCode,
        p_idempotency_key: input.idempotencyKey,
        p_occurred_at: nullableArg(input.occurredAt),
        p_description: nullableArg(input.description),
        p_request_id: nullableArg(input.requestId),
      }),
      operation,
    );
    return this.parseMovement(row, operation);
  }

  async reverseTransaction(input: ReverseTransactionPortInput): Promise<PostedMovementRecord> {
    const operation = 'app_reverse_transaction';
    const row = expectObject(
      await this.call(operation, {
        p_actor_user_id: input.actorUserId,
        p_transaction_id: input.transactionId,
        p_idempotency_key: input.idempotencyKey,
        p_occurred_at: nullableArg(input.occurredAt),
        p_reason: nullableArg(input.reason),
        p_request_id: nullableArg(input.requestId),
      }),
      operation,
    );
    return this.parseMovement(row, operation);
  }

  async listBusinesses(input: ListBusinessesPortInput): Promise<readonly BusinessSummaryRecord[]> {
    const operation = 'app_list_businesses';
    const payload = expectArray(await this.call(operation, { p_actor_user_id: input.actorUserId }), operation);
    return payload.map((value, index) => {
      const row = expectObject(value, operation);
      return {
        businessId: expectString(row.business_id, `rows[${index}].business_id`, operation),
        name: expectString(row.name, `rows[${index}].name`, operation),
        role: expectString(row.role, `rows[${index}].role`, operation),
        ...(typeof row.default_currency_code === 'string' ? { defaultCurrencyCode: row.default_currency_code } : {}),
      } satisfies BusinessSummaryRecord;
    });
  }

  async listBusinessCustomers(input: ListBusinessCustomersPortInput): Promise<readonly BusinessCustomerSummaryRecord[]> {
    const operation = 'app_list_business_customers';
    const payload = expectArray(
      await this.call(operation, {
        p_actor_user_id: input.actorUserId,
        p_business_id: input.businessId,
        p_limit: input.limit,
        p_search: nullableArg(input.search),
      }),
      operation,
    );
    return payload.map((value, index) => {
      const row = expectObject(value, operation);
      return {
        businessCustomerId: expectString(row.business_customer_id, `rows[${index}].business_customer_id`, operation),
        customerIdentityId: expectString(row.customer_identity_id, `rows[${index}].customer_identity_id`, operation),
        displayName: expectString(row.display_name, `rows[${index}].display_name`, operation),
        accountCount: expectInteger(row.account_count, `rows[${index}].account_count`, operation),
        createdAt: expectString(row.created_at, `rows[${index}].created_at`, operation),
        ...(typeof row.phone_e164 === 'string' ? { phoneE164: row.phone_e164 } : {}),
      } satisfies BusinessCustomerSummaryRecord;
    });
  }

  async listCustomerAccounts(input: ListCustomerAccountsPortInput): Promise<readonly CustomerAccountSummaryRecord[]> {
    const operation = 'app_list_customer_accounts';
    const payload = expectArray(
      await this.call(operation, {
        p_actor_user_id: input.actorUserId,
        p_business_customer_id: input.businessCustomerId,
      }),
      operation,
    );
    return payload.map((value, index) => {
      const row = expectObject(value, operation);
      return {
        accountId: expectString(row.account_id, `rows[${index}].account_id`, operation),
        businessCustomerId: expectString(row.business_customer_id, `rows[${index}].business_customer_id`, operation),
        currencyCode: expectString(row.currency_code, `rows[${index}].currency_code`, operation),
        status: expectString(row.status, `rows[${index}].status`, operation),
        balanceMinor: parseBigInt(row.balance_minor, `rows[${index}].balance_minor`, operation),
      } satisfies CustomerAccountSummaryRecord;
    });
  }

  async listMyCustomerAccounts(input: ListMyCustomerAccountsPortInput): Promise<readonly MyCustomerAccountRecord[]> {
    const operation = 'app_list_my_customer_accounts';
    const payload = expectArray(await this.call(operation, { p_actor_user_id: input.actorUserId }), operation);
    return payload.map((value, index) => {
      const row = expectObject(value, operation);
      return {
        businessId: expectString(row.business_id, `rows[${index}].business_id`, operation),
        businessName: expectString(row.business_name, `rows[${index}].business_name`, operation),
        businessCustomerId: expectString(row.business_customer_id, `rows[${index}].business_customer_id`, operation),
        customerIdentityId: expectString(row.customer_identity_id, `rows[${index}].customer_identity_id`, operation),
        accountId: expectString(row.account_id, `rows[${index}].account_id`, operation),
        currencyCode: expectString(row.currency_code, `rows[${index}].currency_code`, operation),
        accountStatus: expectString(row.account_status, `rows[${index}].account_status`, operation),
        balanceMinor: parseBigInt(row.balance_minor, `rows[${index}].balance_minor`, operation),
      } satisfies MyCustomerAccountRecord;
    });
  }

  async getStatement(input: GetStatementPortInput): Promise<readonly StatementEntryRecord[]> {
    const operation = 'app_get_statement_v2';
    const payload = expectArray(
      await this.call(operation, {
        p_actor_user_id: input.actorUserId,
        p_account_id: input.accountId,
        p_limit: input.limit,
        p_before_occurred_at: nullableArg(input.beforeOccurredAt),
      }),
      operation,
    );
    return payload.map((value, index) => {
      const row = expectObject(value, operation);
      const status = expectString(row.transaction_status, `rows[${index}].transaction_status`, operation);
      if (status !== 'posted' && status !== 'reversed') {
        throw new InfrastructureError(operation, { message: `RPC payload field rows[${index}].transaction_status is invalid` });
      }
      return {
        transactionId: expectString(row.transaction_id, `rows[${index}].transaction_id`, operation),
        transactionType: expectString(row.transaction_type, `rows[${index}].transaction_type`, operation) as LedgerTransactionType,
        transactionStatus: status,
        occurredAt: expectString(row.occurred_at, `rows[${index}].occurred_at`, operation),
        ...(typeof row.description === 'string' ? { description: row.description } : {}),
        effectMinor: parseBigInt(row.effect_minor, `rows[${index}].effect_minor`, operation),
        balanceAfterMinor: parseBigInt(row.balance_after_minor, `rows[${index}].balance_after_minor`, operation),
        currencyCode: expectString(row.currency_code, `rows[${index}].currency_code`, operation),
        canReverse: expectBoolean(row.can_reverse, `rows[${index}].can_reverse`, operation),
      } satisfies StatementEntryRecord;
    });
  }

  private async call(operation: string, args: Record<string, unknown>): Promise<unknown> {
    const { data, error } = await this.client.rpc(operation, args);
    if (error !== null) throw new InfrastructureError(operation, error);
    return data;
  }

  private parseMovement(row: JsonObject, operation: string): PostedMovementRecord {
    return {
      transactionId: expectString(row.transactionId, 'transactionId', operation),
      accountId: expectString(row.accountId, 'accountId', operation),
      balanceMinor: parseBigInt(row.balanceMinor, 'balanceMinor', operation),
      currencyCode: expectString(row.currencyCode, 'currencyCode', operation),
    };
  }
}
