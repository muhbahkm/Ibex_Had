import type { CollectionBackendRow, CollectionBackendSource } from '../../application/src/collection-read-model.js';
import { InfrastructureError, type SupabaseRpcClient } from './supabase-application-repository.js';

type JsonObject = Record<string, unknown>;

function expectObject(value: unknown, operation: string): JsonObject {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    throw new InfrastructureError(operation, { message: 'RPC returned an invalid object payload' });
  }
  return value as JsonObject;
}

function expectArray(value: unknown, operation: string): readonly unknown[] {
  if (!Array.isArray(value)) throw new InfrastructureError(operation, { message: 'RPC returned an invalid array payload' });
  return value;
}

function expectString(value: unknown, field: string, operation: string): string {
  if (typeof value !== 'string' || value.length === 0) throw new InfrastructureError(operation, { message: `RPC payload field ${field} is invalid` });
  return value;
}

function expectInteger(value: unknown, field: string, operation: string): number {
  if (typeof value !== 'number' || !Number.isInteger(value)) throw new InfrastructureError(operation, { message: `RPC payload field ${field} is not an integer` });
  return value;
}

function parseBigInt(value: unknown, field: string, operation: string): bigint {
  if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'bigint') throw new InfrastructureError(operation, { message: `RPC payload field ${field} is not an integer` });
  try { return BigInt(value); } catch { throw new InfrastructureError(operation, { message: `RPC payload field ${field} is not a valid bigint` }); }
}

export class SupabaseCollectionReadRepository implements CollectionBackendSource {
  constructor(private readonly client: SupabaseRpcClient, private readonly actorUserId: () => Promise<string>) {}

  async listBusinessCollectionRows(input: { readonly businessId: string; readonly limit: number }): Promise<readonly CollectionBackendRow[]> {
    const operation = 'app_list_business_collection_rows';
    const actorUserId = await this.actorUserId();
    const { data, error } = await this.client.rpc(operation, {
      p_actor_user_id: actorUserId,
      p_business_id: input.businessId,
      p_limit: input.limit,
    });
    if (error !== null) throw new InfrastructureError(operation, error);
    const payload = expectArray(data, operation);
    return payload.map((value, index) => {
      const row = expectObject(value, operation);
      const accountId = typeof row.account_id === 'string' ? row.account_id : undefined;
      const currencyCode = typeof row.currency_code === 'string' ? row.currency_code : undefined;
      const balanceMinor = accountId ? parseBigInt(row.balance_minor, `rows[${index}].balance_minor`, operation) : undefined;
      const lastMovementAt = typeof row.last_movement_at === 'string' ? row.last_movement_at : undefined;
      return {
        businessCustomerId: expectString(row.business_customer_id, `rows[${index}].business_customer_id`, operation),
        customerIdentityId: expectString(row.customer_identity_id, `rows[${index}].customer_identity_id`, operation),
        displayName: expectString(row.display_name, `rows[${index}].display_name`, operation),
        accountCount: expectInteger(row.account_count, `rows[${index}].account_count`, operation),
        ...(typeof row.phone_e164 === 'string' ? { phoneE164: row.phone_e164 } : {}),
        ...(accountId ? { accountId } : {}),
        ...(currencyCode ? { currencyCode } : {}),
        ...(balanceMinor !== undefined ? { balanceMinor } : {}),
        ...(lastMovementAt ? { lastMovementAt } : {}),
      } satisfies CollectionBackendRow;
    });
  }
}
