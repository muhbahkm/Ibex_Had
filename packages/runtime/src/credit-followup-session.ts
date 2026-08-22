import { CreditFollowUpService } from '../../application/src/credit-followup.js';
import { SupabaseCreditFollowUpRepository } from '../../infrastructure/src/supabase-credit-followup-repository.js';
import { InfrastructureError, type RpcErrorLike } from '../../infrastructure/src/supabase-application-repository.js';
import type { SupabaseSessionClient } from './session-application.js';

export class CreditFollowUpSessionService {
  private readonly service: CreditFollowUpService;
  constructor(private readonly client: SupabaseSessionClient) {
    this.service = new CreditFollowUpService(new SupabaseCreditFollowUpRepository(client));
  }

  async currentUserId(): Promise<string> {
    const { data, error } = await this.client.auth.getUser();
    if (error !== null) throw new InfrastructureError('auth.getUser', error as RpcErrorLike);
    const userId = data.user?.id.trim();
    if (!userId) throw new Error('An authenticated Supabase session is required');
    return userId;
  }

  async setCreditTerms(input: Parameters<CreditFollowUpService['setCreditTerms']>[1], requestId?: string) {
    const actorUserId = await this.currentUserId();
    return this.service.setCreditTerms(requestId ? { actorUserId, requestId } : { actorUserId }, input);
  }

  async listTodayFollowUps(input: Parameters<CreditFollowUpService['listTodayFollowUps']>[1]) {
    const actorUserId = await this.currentUserId();
    return this.service.listTodayFollowUps({ actorUserId }, input);
  }
}

export function createCreditFollowUpSessionService(client: SupabaseSessionClient) {
  return new CreditFollowUpSessionService(client);
}
