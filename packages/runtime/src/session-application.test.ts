import { describe, expect, it } from 'vitest';

import type { AuthGetUserResponse, SupabaseSessionClient } from './session-application.js';
import {
  AuthenticationRequiredError,
  IbexSessionApplication,
} from './session-application.js';
import type { RpcResponse } from '../../infrastructure/src/supabase-application-repository.js';

class RecordingSessionClient implements SupabaseSessionClient {
  readonly calls: Array<{ functionName: string; args?: Record<string, unknown> }> = [];

  readonly auth: SupabaseSessionClient['auth'];

  constructor(
    authResponse: AuthGetUserResponse,
    private readonly rpcResponse: RpcResponse,
  ) {
    this.auth = {
      getUser: () => Promise.resolve(authResponse),
    };
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

  it('rejects execution when no authenticated user exists', async () => {
    const client = new RecordingSessionClient(
      { data: { user: null }, error: null },
      { data: null, error: null },
    );
    const application = new IbexSessionApplication(client);

    await expect(
      application.getStatement({ accountId: 'account-1' }),
    ).rejects.toBeInstanceOf(AuthenticationRequiredError);

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
