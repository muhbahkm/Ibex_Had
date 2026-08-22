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
      data: { transactionId: 'tx-1', accountId: 'account-1', balanceMinor: '900719925474099312345', currencyCode: 'YER' },
      error: null,
    });
    const repository = new SupabaseApplicationRepository(client);
    const result = await repository.postMovement({ actorUserId: 'user-1', businessId: 'business-1', customerIdentityId: 'customer-1', accountId: 'account-1', transactionType: 'sale_on_account', direction: 'debit', amountMinor: 900719925474099312345n, currencyCode: 'YER', idempotencyKey: 'sale-command-0001' });
    expect(client.functionName).toBe('app_post_movement');
    expect(client.args?.p_amount_minor).toBe('900719925474099312345');
    expect(result.balanceMinor).toBe(900719925474099312345n);
  });

  it('maps invite creation without losing the one-time token', async () => {
    const token = 'c'.repeat(48);
    const client = new RecordingRpcClient({
      data: {
        inviteId: 'invite-1',
        token,
        expiresAt: '2026-08-29T10:00:00+00:00',
        businessCustomerId: 'relationship-1',
        customerIdentityId: 'customer-1',
        displayName: 'محمد علي',
      },
      error: null,
    });
    const repository = new SupabaseApplicationRepository(client);
    const invite = await repository.createCustomerInvite({
      actorUserId: 'merchant-1',
      businessCustomerId: 'relationship-1',
      ttlHours: 168,
      requestId: 'request-1',
    });
    expect(client.functionName).toBe('app_create_customer_invite');
    expect(client.args).toMatchObject({
      p_actor_user_id: 'merchant-1',
      p_business_customer_id: 'relationship-1',
      p_ttl_hours: 168,
      p_request_id: 'request-1',
    });
    expect(invite.token).toBe(token);
  });

  it('maps an invite claim to the resulting customer relationship', async () => {
    const client = new RecordingRpcClient({
      data: {
        businessId: 'business-1',
        businessName: 'باحكم للعسل',
        businessCustomerId: 'relationship-1',
        customerIdentityId: 'customer-1',
      },
      error: null,
    });
    const repository = new SupabaseApplicationRepository(client);
    const result = await repository.claimCustomerInvite({
      actorUserId: 'customer-user',
      token: 'd'.repeat(48),
    });
    expect(client.functionName).toBe('app_claim_customer_invite');
    expect(client.args?.p_token).toBe('d'.repeat(48));
    expect(result).toEqual({
      businessId: 'business-1',
      businessName: 'باحكم للعسل',
      businessCustomerId: 'relationship-1',
      customerIdentityId: 'customer-1',
    });
  });

  it('maps statement v2 rows including server-computed reversal eligibility', async () => {
    const client = new RecordingRpcClient({
      data: [{ transaction_id: 'tx-2', transaction_type: 'receipt', transaction_status: 'posted', occurred_at: '2026-08-22T10:00:00+00:00', description: 'قبض', effect_minor: '-400', balance_after_minor: '600', currency_code: 'YER', can_reverse: true }],
      error: null,
    });
    const repository = new SupabaseApplicationRepository(client);
    const rows = await repository.getStatement({ actorUserId: 'user-1', accountId: 'account-1', limit: 50 });
    expect(client.functionName).toBe('app_get_statement_v2');
    expect(rows).toEqual([{ transactionId: 'tx-2', transactionType: 'receipt', transactionStatus: 'posted', occurredAt: '2026-08-22T10:00:00+00:00', description: 'قبض', effectMinor: -400n, balanceAfterMinor: 600n, currencyCode: 'YER', canReverse: true }]);
  });

  it('maps claimed customer accounts losslessly', async () => {
    const client = new RecordingRpcClient({
      data: [{ business_id: 'business-1', business_name: 'باحكم للعسل', business_customer_id: 'relationship-1', customer_identity_id: 'customer-1', account_id: 'account-1', currency_code: 'YER', account_status: 'open', balance_minor: '900719925474099312345' }],
      error: null,
    });
    const repository = new SupabaseApplicationRepository(client);
    const rows = await repository.listMyCustomerAccounts({ actorUserId: 'user-1' });
    expect(client.functionName).toBe('app_list_my_customer_accounts');
    expect(rows[0]?.businessName).toBe('باحكم للعسل');
    expect(rows[0]?.balanceMinor).toBe(900719925474099312345n);
  });

  it('preserves structured RPC failures as InfrastructureError', async () => {
    const client = new RecordingRpcClient({ data: null, error: { message: 'Business mutation is not permitted', code: '42501' } });
    const repository = new SupabaseApplicationRepository(client);
    await expect(repository.createCustomer({ actorUserId: 'user-1', businessId: 'business-1', displayName: 'عميل' })).rejects.toMatchObject({ name: 'InfrastructureError', code: '42501' });
  });

  it('rejects malformed RPC payloads instead of silently coercing them', async () => {
    const client = new RecordingRpcClient({ data: { transactionId: 'tx-1', accountId: 'account-1', balanceMinor: 'bad', currencyCode: 'YER' }, error: null });
    const repository = new SupabaseApplicationRepository(client);
    await expect(repository.reverseTransaction({ actorUserId: 'user-1', transactionId: 'tx-1', idempotencyKey: 'reverse-command-001' })).rejects.toBeInstanceOf(InfrastructureError);
  });
});
