import type { CreditFollowUpRepository, CreditTermsRecord, FollowUpState, TodayFollowUpRecord } from '../../application/src/credit-followup.js';
import { InfrastructureError, type SupabaseRpcClient } from './supabase-application-repository.js';

type JsonObject = Record<string, unknown>;
function object(value: unknown, operation: string): JsonObject { if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new InfrastructureError(operation, { message: 'RPC returned invalid object payload' }); return value as JsonObject; }
function array(value: unknown, operation: string): readonly unknown[] { if (!Array.isArray(value)) throw new InfrastructureError(operation, { message: 'RPC returned invalid array payload' }); return value; }
function string(value: unknown, field: string, operation: string): string { if (typeof value !== 'string' || !value) throw new InfrastructureError(operation, { message: `Invalid ${field}` }); return value; }
function integer(value: unknown, field: string, operation: string): number { if (typeof value !== 'number' || !Number.isInteger(value)) throw new InfrastructureError(operation, { message: `Invalid ${field}` }); return value; }
function boolean(value: unknown, field: string, operation: string): boolean { if (typeof value !== 'boolean') throw new InfrastructureError(operation, { message: `Invalid ${field}` }); return value; }
function bigint(value: unknown, field: string, operation: string): bigint { try { if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'bigint') throw new Error(); return BigInt(value); } catch { throw new InfrastructureError(operation, { message: `Invalid ${field}` }); } }
function state(value: unknown, field: string, operation: string): FollowUpState { const parsed = string(value, field, operation); if (!['overdue','due_today','due_soon'].includes(parsed)) throw new InfrastructureError(operation, { message: `Invalid ${field}` }); return parsed as FollowUpState; }

export class SupabaseCreditFollowUpRepository implements CreditFollowUpRepository {
  constructor(private readonly client: SupabaseRpcClient) {}

  async setCreditTerms(input: Parameters<CreditFollowUpRepository['setCreditTerms']>[0]): Promise<CreditTermsRecord> {
    const operation = 'app_set_customer_credit_terms';
    const row = object(await this.call(operation, {
      p_actor_user_id: input.actorUserId,
      p_account_id: input.accountId,
      p_terms_days: input.termsDays,
      p_grace_days: input.graceDays,
      p_enabled: input.enabled,
      p_request_id: input.requestId ?? null,
    }), operation);
    return {
      accountId: string(row.accountId, 'accountId', operation),
      termsDays: integer(row.termsDays, 'termsDays', operation),
      graceDays: integer(row.graceDays, 'graceDays', operation),
      enabled: boolean(row.enabled, 'enabled', operation),
      currencyCode: string(row.currencyCode, 'currencyCode', operation),
    };
  }

  async listTodayFollowUps(input: Parameters<CreditFollowUpRepository['listTodayFollowUps']>[0]): Promise<readonly TodayFollowUpRecord[]> {
    const operation = 'app_list_today_followups';
    const rows = array(await this.call(operation, {
      p_actor_user_id: input.actorUserId,
      p_business_id: input.businessId,
      p_limit: input.limit,
      p_as_of: input.asOf ?? null,
      p_due_soon_days: input.dueSoonDays,
    }), operation);
    return rows.map((value, index) => {
      const row = object(value, operation);
      return {
        businessCustomerId: string(row.business_customer_id, `rows[${index}].business_customer_id`, operation),
        customerIdentityId: string(row.customer_identity_id, `rows[${index}].customer_identity_id`, operation),
        displayName: string(row.display_name, `rows[${index}].display_name`, operation),
        ...(typeof row.phone_e164 === 'string' ? { phoneE164: row.phone_e164 } : {}),
        accountId: string(row.account_id, `rows[${index}].account_id`, operation),
        currencyCode: string(row.currency_code, `rows[${index}].currency_code`, operation),
        balanceMinor: bigint(row.balance_minor, `rows[${index}].balance_minor`, operation),
        oldestDueAt: string(row.oldest_due_at, `rows[${index}].oldest_due_at`, operation),
        effectiveOverdueAt: string(row.effective_overdue_at, `rows[${index}].effective_overdue_at`, operation),
        followUpState: state(row.follow_up_state, `rows[${index}].follow_up_state`, operation),
        daysOverdue: integer(row.days_overdue, `rows[${index}].days_overdue`, operation),
        ...(typeof row.last_movement_at === 'string' ? { lastMovementAt: row.last_movement_at } : {}),
        termsDays: integer(row.terms_days, `rows[${index}].terms_days`, operation),
        graceDays: integer(row.grace_days, `rows[${index}].grace_days`, operation),
      } satisfies TodayFollowUpRecord;
    });
  }

  private async call(operation: string, args: Record<string, unknown>): Promise<unknown> {
    const response = await this.client.rpc(operation, args);
    if (response.error !== null) throw new InfrastructureError(operation, response.error);
    return response.data;
  }
}
