import { describe, expect, it } from 'vitest';

import type { RpcResponse } from '../../infrastructure/src/supabase-application-repository.js';
import type { AuthGetUserResponse, SupabaseSessionClient } from './session-application.js';
import {
  AuthenticationRequiredError,
  IbexSessionApplication,
} from './session-application.js';

class RecordingSessionClient implements SupabaseSessionClient {
  readonly calls: Array<{ functionName: string; args?: Record<string, unknown> }> = [];
  readonly auth: SupabaseSessionClient['auth'];

  constructor(
    authResponse: AuthGetUserResponse,
    private readonly rpcResponse: RpcResponse,
  ) {
    this.auth = { getUser: () => Promise.resolve(authResponse) };
  }

  rpc(functionName: string, args?: Record<string, unknown>): Promise<RpcResponse> {
    this.calls.push(args ? { functionName, args } : { functionName });
    return Promise.resolve(this.rpcResponse);
  }
}

describe('IbexSessionApplication', () => {
  it('derives actorUserId from the authenticated Supabase user instead of caller input', async () => {
    const client = new RecordingSessionClient(
      { data: { user: { id: 'auth-user-123' } }, error: null },
      {
        data: {
          transactionId: 'tx-1',
          accountId: 'account-1',
          balanceMinor: '1000',
          currencyCode: 'YER',
        },
        error: null,
      },
    );
    const application = new IbexSessionApplication(client);

    const result = await application.postSale(
      {
        businessId: 'business-1',
        customerIdentityId: 'customer-1',
        accountId: 'account-1',
        amountMinor: '1000',
        currencyCode: 'YER',
        idempotencyKey: 'sale-command-0001',
      },
      'request-1',
    );

    expect(client.calls).toHaveLength(1);
    expect(client.calls[0]?.functionName).toBe('app_post_movement');
    expect(client.calls[0]?.args?.p_actor_user_id).toBe('auth-user-123');
    expect(client.calls[0]?.args?.p_request_id).toBe('request-1');
    expect(result.balanceMinor).toBe(1000n);
  });

  it('forwards invite creation through the authenticated session boundary', async () => {
    const client = new RecordingSessionClient(
      { data: { user: { id: 'merchant-user' } }, error: null },
      {
        data: {
          inviteId: 'invite-1',
          token: 'a'.repeat(48),
          expiresAt: '2026-08-29T10:00:00+00:00',
          businessCustomerId: 'relationship-1',
          customerIdentityId: 'customer-1',
          displayName: 'محمد علي',
        },
        error: null,
      },
    );
    const application = new IbexSessionApplication(client);

    const result = await application.createCustomerInvite(
      { businessCustomerId: 'relationship-1', ttlHours: 72 },
      'invite-request-1',
    );

    expect(client.calls[0]?.functionName).toBe('app_create_customer_invite');
    expect(client.calls[0]?.args).toMatchObject({
      p_actor_user_id: 'merchant-user',
      p_business_customer_id: 'relationship-1',
      p_ttl_hours: 72,
      p_request_id: 'invite-request-1',
    });
    expect(result.token).toBe('a'.repeat(48));
  });

  it('forwards invite claim through the authenticated session boundary', async () => {
    const token = 'b'.repeat(48);
    const client = new RecordingSessionClient(
      { data: { user: { id: 'customer-user' } }, error: null },
      {
        data: {
          businessId: 'business-1',
          businessName: 'باحكم للعسل',
          businessCustomerId: 'relationship-1',
          customerIdentityId: 'customer-1',
        },
        error: null,
      },
    );
    const application = new IbexSessionApplication(client);

    const result = await application.claimCustomerInvite({ token }, 'claim-request-1');

    expect(client.calls[0]?.functionName).toBe('app_claim_customer_invite');
    expect(client.calls[0]?.args).toMatchObject({
      p_actor_user_id: 'customer-user',
      p_token: token,
      p_request_id: 'claim-request-1',
    });
    expect(result.businessName).toBe('باحكم للعسل');
  });

  it('derives the merchant actor for private document preparation', async () => {
    const client = new RecordingSessionClient(
      { data: { user: { id: 'merchant-user' } }, error: null },
      {
        data: {
          documentId: 'document-1',
          transactionId: 'tx-1',
          storageBucket: 'transaction-documents',
          storagePath: 'businesses/business-1/transactions/tx-1/document-1.pdf',
          fileName: 'فاتورة.pdf',
          mimeType: 'application/pdf',
          sizeBytes: 4096,
        },
        error: null,
      },
    );
    const application = new IbexSessionApplication(client);

    await application.prepareTransactionDocument(
      { transactionId: 'tx-1', fileName: 'فاتورة.pdf', mimeType: 'application/pdf', sizeBytes: 4096 },
      'document-request-1',
    );

    expect(client.calls[0]?.functionName).toBe('app_prepare_transaction_document');
    expect(client.calls[0]?.args).toMatchObject({
      p_actor_user_id: 'merchant-user',
      p_transaction_id: 'tx-1',
      p_request_id: 'document-request-1',
    });
  });

  it('rejects execution when no authenticated user exists', async () => {
    const client = new RecordingSessionClient(
      { data: { user: null }, error: null },
      { data: null, error: null },
    );
    const application = new IbexSessionApplication(client);

    await expect(application.getStatement({ accountId: 'account-1' })).rejects.toBeInstanceOf(
      AuthenticationRequiredError,
    );
    expect(client.calls).toHaveLength(0);
  });

  it('stops before RPC when auth.getUser fails', async () => {
    const client = new RecordingSessionClient(
      {
        data: { user: null },
        error: { message: 'JWT expired', code: 'auth_session_missing' },
      },
      { data: null, error: null },
    );
    const application = new IbexSessionApplication(client);

    await expect(
      application.createBusiness({ name: 'باحكم للعسل', defaultCurrencyCode: 'YER' }),
    ).rejects.toMatchObject({
      name: 'InfrastructureError',
      code: 'auth_session_missing',
    });
    expect(client.calls).toHaveLength(0);
  });
});
