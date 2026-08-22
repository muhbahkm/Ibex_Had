import { describe, expect, it } from 'vitest';

import type { RpcResponse, SupabaseRpcClient } from './supabase-application-repository.js';
import {
  InfrastructureError,
  SupabaseApplicationRepository,
} from './supabase-application-repository.js';

class RecordingRpcClient implements SupabaseRpcClient {
  functionName?: string;
  args: Record<string, unknown> | undefined;

  constructor(private readonly response: RpcResponse) {}

  rpc(functionName: string, args?: Record<string, unknown>): Promise<RpcResponse> {
    this.functionName = functionName;
    this.args = args;
    return Promise.resolve(this.response);
  }
}

describe('SupabaseApplicationRepository', () => {
  it('serializes bigint money as decimal text for JSON-safe RPC transport', async () => {
    const client = new RecordingRpcClient({
      data: {
        transactionId: 'tx-1',
        accountId: 'account-1',
        balanceMinor: '900719925474099312345',
        currencyCode: 'YER',
      },
      error: null,
    });
    const repository = new SupabaseApplicationRepository(client);

    const result = await repository.postMovement({
      actorUserId: 'user-1',
      businessId: 'business-1',
      customerIdentityId: 'customer-1',
      accountId: 'account-1',
      transactionType: 'sale_on_account',
      direction: 'debit',
      amountMinor: 900719925474099312345n,
      currencyCode: 'YER',
      idempotencyKey: 'sale-command-0001',
    });

    expect(client.functionName).toBe('app_post_movement');
    expect(client.args?.p_amount_minor).toBe('900719925474099312345');
    expect(result.balanceMinor).toBe(900719925474099312345n);
  });

  it('maps snake_case statement rows and preserves lossless balances', async () => {
    const client = new RecordingRpcClient({
      data: [
        {
          transaction_id: 'tx-2',
          transaction_type: 'receipt',
          occurred_at: '2026-08-22T10:00:00+00:00',
          description: 'قبض',
          effect_minor: '-400',
          balance_after_minor: '600',
          currency_code: 'YER',
        },
      ],
      error: null,
    });
    const repository = new SupabaseApplicationRepository(client);

    const rows = await repository.getStatement({
      actorUserId: 'user-1',
      accountId: 'account-1',
      limit: 50,
    });

    expect(rows).toEqual([
      {
        transactionId: 'tx-2',
        transactionType: 'receipt',
        occurredAt: '2026-08-22T10:00:00+00:00',
        description: 'قبض',
        effectMinor: -400n,
        balanceAfterMinor: 600n,
        currencyCode: 'YER',
      },
    ]);
  });

  it('preserves structured RPC failures as InfrastructureError', async () => {
    const client = new RecordingRpcClient({
      data: null,
      error: { message: 'Business mutation is not permitted', code: '42501' },
    });
    const repository = new SupabaseApplicationRepository(client);

    await expect(
      repository.createCustomer({
        actorUserId: 'user-1',
        businessId: 'business-1',
        displayName: 'عميل',
      }),
    ).rejects.toMatchObject({
      name: 'InfrastructureError',
      code: '42501',
    });
  });

  it('rejects malformed RPC payloads instead of silently coercing them', async () => {
    const client = new RecordingRpcClient({
      data: { transactionId: 'tx-1', accountId: 'account-1', balanceMinor: 'bad', currencyCode: 'YER' },
      error: null,
    });
    const repository = new SupabaseApplicationRepository(client);

    await expect(
      repository.reverseTransaction({
        actorUserId: 'user-1',
        transactionId: 'tx-1',
        idempotencyKey: 'reverse-command-001',
      }),
    ).rejects.toBeInstanceOf(InfrastructureError);
  });
});
