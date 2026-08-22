import type {
  CollectionChannel,
  CollectionEngagementRepository,
  CollectionEventKind,
  CollectionFollowUpEventRecord,
  CollectionOutcome,
  CollectionPriorityBucket,
  CollectionRecommendedAction,
  CollectionTodayPlanRecord,
} from '../../application/src/collection-engagement.js';
import { InfrastructureError, type SupabaseRpcClient } from './supabase-application-repository.js';

type JsonObject = Record<string, unknown>;
function object(value: unknown, operation: string): JsonObject { if (value === null || typeof value !== 'object' || Array.isArray(value)) throw new InfrastructureError(operation, { message: 'RPC returned invalid object payload' }); return value as JsonObject; }
function array(value: unknown, operation: string): readonly unknown[] { if (!Array.isArray(value)) throw new InfrastructureError(operation, { message: 'RPC returned invalid array payload' }); return value; }
function string(value: unknown, field: string, operation: string): string { if (typeof value !== 'string' || !value) throw new InfrastructureError(operation, { message: `Invalid ${field}` }); return value; }
function integer(value: unknown, field: string, operation: string): number { if (typeof value !== 'number' || !Number.isInteger(value)) throw new InfrastructureError(operation, { message: `Invalid ${field}` }); return value; }
function bigint(value: unknown, field: string, operation: string): bigint { try { if (typeof value !== 'string' && typeof value !== 'number' && typeof value !== 'bigint') throw new Error(); return BigInt(value); } catch { throw new InfrastructureError(operation, { message: `Invalid ${field}` }); } }
function optionalString(value: unknown): string | undefined { return typeof value === 'string' && value ? value : undefined; }
function oneOf<T extends string>(value: unknown, field: string, allowed: readonly T[], operation: string): T { const parsed = string(value, field, operation); if (!allowed.includes(parsed as T)) throw new InfrastructureError(operation, { message: `Invalid ${field}` }); return parsed as T; }

const eventKinds = ['contact_attempt','contact_reached','promise_to_pay','note','escalation'] as const;
const channels = ['call','whatsapp','sms','in_person','email','other'] as const;
const outcomes = ['no_answer','reached','promised','callback_requested','refused','wrong_number','other'] as const;
const priorities = ['urgent','high','medium','normal'] as const;
const actions = ['follow_up_broken_promise','confirm_payment_promise','execute_scheduled_follow_up','contact_customer','review_recent_contact','send_due_today_reminder','prepare_due_soon_reminder'] as const;
const followStates = ['overdue','due_today','due_soon'] as const;

export class SupabaseCollectionEngagementRepository implements CollectionEngagementRepository {
  constructor(private readonly client: SupabaseRpcClient) {}

  async recordEvent(input: Parameters<CollectionEngagementRepository['recordEvent']>[0]): Promise<CollectionFollowUpEventRecord> {
    const operation = 'app_record_collection_followup_event';
    const row = object(await this.call(operation, {
      p_actor_user_id: input.actorUserId,
      p_business_customer_id: input.businessCustomerId,
      p_account_id: input.accountId ?? null,
      p_event_kind: input.eventKind,
      p_channel: input.channel ?? null,
      p_outcome: input.outcome ?? null,
      p_note: input.note ?? null,
      p_promised_amount_minor: input.promisedAmountMinor?.toString() ?? null,
      p_currency_code: input.currencyCode ?? null,
      p_promised_for: input.promisedFor ?? null,
      p_next_action_at: input.nextActionAt ?? null,
      p_request_id: input.requestId ?? null,
    }), operation);
    const accountId = optionalString(row.accountId);
    const channel = optionalString(row.channel);
    const outcome = optionalString(row.outcome);
    const note = optionalString(row.note);
    const currencyCode = optionalString(row.currencyCode);
    const promisedFor = optionalString(row.promisedFor);
    const nextActionAt = optionalString(row.nextActionAt);
    return {
      eventId: string(row.eventId, 'eventId', operation),
      businessId: string(row.businessId, 'businessId', operation),
      businessCustomerId: string(row.businessCustomerId, 'businessCustomerId', operation),
      ...(accountId ? { accountId } : {}),
      eventKind: oneOf<CollectionEventKind>(row.eventKind, 'eventKind', eventKinds, operation),
      ...(channel ? { channel: oneOf<CollectionChannel>(channel, 'channel', channels, operation) } : {}),
      ...(outcome ? { outcome: oneOf<CollectionOutcome>(outcome, 'outcome', outcomes, operation) } : {}),
      ...(note ? { note } : {}),
      ...(row.promisedAmountMinor !== null && row.promisedAmountMinor !== undefined ? { promisedAmountMinor: bigint(row.promisedAmountMinor, 'promisedAmountMinor', operation) } : {}),
      ...(currencyCode ? { currencyCode } : {}),
      ...(promisedFor ? { promisedFor } : {}),
      ...(nextActionAt ? { nextActionAt } : {}),
      createdAt: string(row.createdAt, 'createdAt', operation),
    };
  }

  async listHistory(input: Parameters<CollectionEngagementRepository['listHistory']>[0]): Promise<readonly CollectionFollowUpEventRecord[]> {
    const operation = 'app_list_collection_followup_history';
    const rows = array(await this.call(operation, { p_actor_user_id: input.actorUserId, p_business_customer_id: input.businessCustomerId, p_limit: input.limit }), operation);
    return rows.map((value, index) => this.parseHistoryRow(object(value, operation), index, operation));
  }

  async listTodayPlan(input: Parameters<CollectionEngagementRepository['listTodayPlan']>[0]): Promise<readonly CollectionTodayPlanRecord[]> {
    const operation = 'app_list_collection_today_plan';
    const rows = array(await this.call(operation, { p_actor_user_id: input.actorUserId, p_business_id: input.businessId, p_limit: input.limit, p_as_of: input.asOf ?? null, p_due_soon_days: input.dueSoonDays }), operation);
    return rows.map((value, index) => {
      const row = object(value, operation);
      const prefix = `rows[${index}]`;
      const phoneE164 = optionalString(row.phone_e164);
      const lastFollowUpAt = optionalString(row.last_followup_at);
      const lastEventKind = optionalString(row.last_event_kind);
      const lastOutcome = optionalString(row.last_outcome);
      const promisedFor = optionalString(row.promised_for);
      const nextActionAt = optionalString(row.next_action_at);
      return {
        businessCustomerId: string(row.business_customer_id, `${prefix}.business_customer_id`, operation),
        customerIdentityId: string(row.customer_identity_id, `${prefix}.customer_identity_id`, operation),
        displayName: string(row.display_name, `${prefix}.display_name`, operation),
        ...(phoneE164 ? { phoneE164 } : {}),
        accountId: string(row.account_id, `${prefix}.account_id`, operation),
        currencyCode: string(row.currency_code, `${prefix}.currency_code`, operation),
        balanceMinor: bigint(row.balance_minor, `${prefix}.balance_minor`, operation),
        oldestDueAt: string(row.oldest_due_at, `${prefix}.oldest_due_at`, operation),
        effectiveOverdueAt: string(row.effective_overdue_at, `${prefix}.effective_overdue_at`, operation),
        followUpState: oneOf(row.follow_up_state, `${prefix}.follow_up_state`, followStates, operation),
        daysOverdue: integer(row.days_overdue, `${prefix}.days_overdue`, operation),
        priorityBucket: oneOf<CollectionPriorityBucket>(row.priority_bucket, `${prefix}.priority_bucket`, priorities, operation),
        priorityScore: integer(row.priority_score, `${prefix}.priority_score`, operation),
        recommendedAction: oneOf<CollectionRecommendedAction>(row.recommended_action, `${prefix}.recommended_action`, actions, operation),
        reasonCode: string(row.reason_code, `${prefix}.reason_code`, operation),
        ...(lastFollowUpAt ? { lastFollowUpAt } : {}),
        ...(lastEventKind ? { lastEventKind: oneOf<CollectionEventKind>(lastEventKind, `${prefix}.last_event_kind`, eventKinds, operation) } : {}),
        ...(lastOutcome ? { lastOutcome: oneOf<CollectionOutcome>(lastOutcome, `${prefix}.last_outcome`, outcomes, operation) } : {}),
        ...(promisedFor ? { promisedFor } : {}),
        ...(row.promised_amount_minor !== null && row.promised_amount_minor !== undefined ? { promisedAmountMinor: bigint(row.promised_amount_minor, `${prefix}.promised_amount_minor`, operation) } : {}),
        ...(nextActionAt ? { nextActionAt } : {}),
      } satisfies CollectionTodayPlanRecord;
    });
  }

  private parseHistoryRow(row: JsonObject, index: number, operation: string): CollectionFollowUpEventRecord {
    const prefix = `rows[${index}]`;
    const accountId = optionalString(row.account_id);
    const channel = optionalString(row.channel);
    const outcome = optionalString(row.outcome);
    const note = optionalString(row.note);
    const currencyCode = optionalString(row.currency_code);
    const promisedFor = optionalString(row.promised_for);
    const nextActionAt = optionalString(row.next_action_at);
    return {
      eventId: string(row.event_id, `${prefix}.event_id`, operation),
      businessId: string(row.business_id, `${prefix}.business_id`, operation),
      businessCustomerId: string(row.business_customer_id, `${prefix}.business_customer_id`, operation),
      ...(accountId ? { accountId } : {}),
      eventKind: oneOf<CollectionEventKind>(row.event_kind, `${prefix}.event_kind`, eventKinds, operation),
      ...(channel ? { channel: oneOf<CollectionChannel>(channel, `${prefix}.channel`, channels, operation) } : {}),
      ...(outcome ? { outcome: oneOf<CollectionOutcome>(outcome, `${prefix}.outcome`, outcomes, operation) } : {}),
      ...(note ? { note } : {}),
      ...(row.promised_amount_minor !== null && row.promised_amount_minor !== undefined ? { promisedAmountMinor: bigint(row.promised_amount_minor, `${prefix}.promised_amount_minor`, operation) } : {}),
      ...(currencyCode ? { currencyCode } : {}),
      ...(promisedFor ? { promisedFor } : {}),
      ...(nextActionAt ? { nextActionAt } : {}),
      createdAt: string(row.created_at, `${prefix}.created_at`, operation),
    };
  }

  private async call(operation: string, args: Record<string, unknown>): Promise<unknown> {
    const response = await this.client.rpc(operation, args);
    if (response.error !== null) throw new InfrastructureError(operation, response.error);
    return response.data;
  }
}
