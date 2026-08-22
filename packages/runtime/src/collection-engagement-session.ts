import { CollectionEngagementService } from '../../application/src/collection-engagement.js';
import { SupabaseCollectionEngagementRepository } from '../../infrastructure/src/supabase-collection-engagement-repository.js';
import { InfrastructureError, type RpcErrorLike } from '../../infrastructure/src/supabase-application-repository.js';
import type { SupabaseSessionClient } from './session-application.js';

export class CollectionEngagementSessionService {
  private readonly service: CollectionEngagementService;

  constructor(private readonly client: SupabaseSessionClient) {
    this.service = new CollectionEngagementService(new SupabaseCollectionEngagementRepository(client));
  }

  private async currentUserId(): Promise<string> {
    const { data, error } = await this.client.auth.getUser();
    if (error !== null) throw new InfrastructureError('auth.getUser', error as RpcErrorLike);
    const userId = data.user?.id.trim();
    if (!userId) throw new Error('An authenticated Supabase session is required');
    return userId;
  }

  async recordEvent(input: Parameters<CollectionEngagementService['recordEvent']>[1], requestId?: string) {
    const actorUserId = await this.currentUserId();
    return this.service.recordEvent(requestId ? { actorUserId, requestId } : { actorUserId }, input);
  }

  async listHistory(input: Parameters<CollectionEngagementService['listHistory']>[1]) {
    const actorUserId = await this.currentUserId();
    return this.service.listHistory({ actorUserId }, input);
  }

  async listTodayPlan(input: Parameters<CollectionEngagementService['listTodayPlan']>[1]) {
    const actorUserId = await this.currentUserId();
    return this.service.listTodayPlan({ actorUserId }, input);
  }
}

export function createCollectionEngagementSessionService(client: SupabaseSessionClient) {
  return new CollectionEngagementSessionService(client);
}
