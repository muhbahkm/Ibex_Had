import { describe, expect, it } from 'vitest';

import type { RpcResponse, SupabaseRpcClient } from './supabase-application-repository.js';
import { InfrastructureError, SupabaseApplicationRepository } from './supabase-application-repository.js';

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

describe('notification inbox infrastructure', () => {
  it('maps notification rows without losing optional dispute/read fields', async () => {
    const client = new RecordingRpcClient({
      data: [{
        notification_id: 'notification-1',
        kind: 'dispute_closed',
        business_id: 'business-1',
        business_name: 'باحكم للعسل',
        transaction_id: 'tx-1',
        transaction_type: 'sale_on_account',
        dispute_id: 'dispute-1',
        dispute_status: 'resolved',
        read_at: null,
        created_at: '2026-08-22T13:00:00+00:00',
      }],
      error: null,
    });
    const repository = new SupabaseApplicationRepository(client);
    const rows = await repository.listNotifications({ actorUserId: 'user-1', unreadOnly: true, limit: 50 });
    expect(client.functionName).toBe('app_list_notifications');
    expect(client.args).toEqual({ p_actor_user_id: 'user-1', p_unread_only: true, p_limit: 50 });
    expect(rows).toEqual([{
      notificationId: 'notification-1',
      kind: 'dispute_closed',
      businessId: 'business-1',
      businessName: 'باحكم للعسل',
      transactionId: 'tx-1',
      transactionType: 'sale_on_account',
      disputeId: 'dispute-1',
      disputeStatus: 'resolved',
      createdAt: '2026-08-22T13:00:00+00:00',
    }]);
  });

  it('maps ownership-scoped mark-as-read response', async () => {
    const client = new RecordingRpcClient({
      data: { notificationId: 'notification-1', readAt: '2026-08-22T13:05:00+00:00' },
      error: null,
    });
    const repository = new SupabaseApplicationRepository(client);
    const marked = await repository.markNotificationRead({ actorUserId: 'user-1', notificationId: 'notification-1' });
    expect(client.functionName).toBe('app_mark_notification_read');
    expect(client.args).toEqual({ p_actor_user_id: 'user-1', p_notification_id: 'notification-1' });
    expect(marked).toEqual({ notificationId: 'notification-1', readAt: '2026-08-22T13:05:00+00:00' });
  });

  it('rejects malformed notification kinds', async () => {
    const client = new RecordingRpcClient({
      data: [{
        notification_id: 'notification-1',
        kind: 'unsafe_kind',
        business_id: 'business-1',
        business_name: 'باحكم للعسل',
        transaction_id: 'tx-1',
        transaction_type: 'receipt',
        created_at: '2026-08-22T13:00:00+00:00',
      }],
      error: null,
    });
    const repository = new SupabaseApplicationRepository(client);
    await expect(repository.listNotifications({ actorUserId: 'user-1', unreadOnly: false, limit: 50 })).rejects.toBeInstanceOf(InfrastructureError);
  });
});
