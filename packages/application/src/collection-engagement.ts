export type CollectionEventKind = 'contact_attempt' | 'contact_reached' | 'promise_to_pay' | 'note' | 'escalation';
export type CollectionChannel = 'call' | 'whatsapp' | 'sms' | 'in_person' | 'email' | 'other';
export type CollectionOutcome = 'no_answer' | 'reached' | 'promised' | 'callback_requested' | 'refused' | 'wrong_number' | 'other';
export type CollectionPriorityBucket = 'urgent' | 'high' | 'medium' | 'normal';
export type CollectionRecommendedAction = 'follow_up_broken_promise' | 'confirm_payment_promise' | 'execute_scheduled_follow_up' | 'contact_customer' | 'review_recent_contact' | 'send_due_today_reminder' | 'prepare_due_soon_reminder';

export interface CollectionFollowUpEventRecord {
  readonly eventId: string;
  readonly businessId: string;
  readonly businessCustomerId: string;
  readonly accountId?: string;
  readonly eventKind: CollectionEventKind;
  readonly channel?: CollectionChannel;
  readonly outcome?: CollectionOutcome;
  readonly note?: string;
  readonly promisedAmountMinor?: bigint;
  readonly currencyCode?: string;
  readonly promisedFor?: string;
  readonly nextActionAt?: string;
  readonly createdAt: string;
}

export interface CollectionTodayPlanRecord {
  readonly businessCustomerId: string;
  readonly customerIdentityId: string;
  readonly displayName: string;
  readonly phoneE164?: string;
  readonly accountId: string;
  readonly currencyCode: string;
  readonly balanceMinor: bigint;
  readonly oldestDueAt: string;
  readonly effectiveOverdueAt: string;
  readonly followUpState: 'overdue' | 'due_today' | 'due_soon';
  readonly daysOverdue: number;
  readonly priorityBucket: CollectionPriorityBucket;
  readonly priorityScore: number;
  readonly recommendedAction: CollectionRecommendedAction;
  readonly reasonCode: string;
  readonly lastFollowUpAt?: string;
  readonly lastEventKind?: CollectionEventKind;
  readonly lastOutcome?: CollectionOutcome;
  readonly promisedFor?: string;
  readonly promisedAmountMinor?: bigint;
  readonly nextActionAt?: string;
}

export interface CollectionEngagementRepository {
  recordEvent(input: {
    readonly actorUserId: string;
    readonly businessCustomerId: string;
    readonly accountId?: string;
    readonly eventKind: CollectionEventKind;
    readonly channel?: CollectionChannel;
    readonly outcome?: CollectionOutcome;
    readonly note?: string;
    readonly promisedAmountMinor?: bigint;
    readonly currencyCode?: string;
    readonly promisedFor?: string;
    readonly nextActionAt?: string;
    readonly requestId?: string;
  }): Promise<CollectionFollowUpEventRecord>;
  listHistory(input: { readonly actorUserId: string; readonly businessCustomerId: string; readonly limit: number }): Promise<readonly CollectionFollowUpEventRecord[]>;
  listTodayPlan(input: { readonly actorUserId: string; readonly businessId: string; readonly limit: number; readonly asOf?: string; readonly dueSoonDays: number }): Promise<readonly CollectionTodayPlanRecord[]>;
}

function id(value: string, field: string): string { const normalized = value.trim(); if (!normalized) throw new Error(`${field} is required`); return normalized; }
function int(value: number, field: string, min: number, max: number): number { if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${field} must be an integer between ${min} and ${max}`); return value; }
function date(value: string | undefined, field: string): string | undefined { const normalized = value?.trim(); if (!normalized) return undefined; if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) throw new Error(`${field} must use YYYY-MM-DD`); return normalized; }
function dateTime(value: string | undefined, field: string): string | undefined { const normalized = value?.trim(); if (!normalized) return undefined; if (Number.isNaN(Date.parse(normalized))) throw new Error(`${field} must be a valid ISO date-time`); return normalized; }
function note(value: string | undefined): string | undefined { const normalized = value?.trim().replace(/\s+/g, ' '); if (!normalized) return undefined; if (normalized.length > 2000) throw new Error('note must not exceed 2000 characters'); return normalized; }
function amount(value: string | undefined): bigint | undefined { if (value === undefined || value.trim() === '') return undefined; if (!/^\d+$/.test(value.trim())) throw new Error('promisedAmountMinor must contain positive minor units'); const parsed = BigInt(value.trim()); if (parsed <= 0n) throw new Error('promisedAmountMinor must be positive'); return parsed; }

export class CollectionEngagementService {
  constructor(private readonly repository: CollectionEngagementRepository) {}

  recordEvent(context: { readonly actorUserId: string; readonly requestId?: string }, input: {
    readonly businessCustomerId: string;
    readonly accountId?: string;
    readonly eventKind: CollectionEventKind;
    readonly channel?: CollectionChannel;
    readonly outcome?: CollectionOutcome;
    readonly note?: string;
    readonly promisedAmountMinor?: string;
    readonly currencyCode?: string;
    readonly promisedFor?: string;
    readonly nextActionAt?: string;
  }) {
    const promisedFor = date(input.promisedFor, 'promisedFor');
    const promisedAmountMinor = amount(input.promisedAmountMinor);
    if (input.eventKind === 'promise_to_pay' && !promisedFor) throw new Error('promisedFor is required for promise_to_pay');
    if (input.eventKind !== 'promise_to_pay' && (promisedFor || promisedAmountMinor !== undefined || input.currencyCode)) throw new Error('Promise fields require promise_to_pay');
    return this.repository.recordEvent({
      actorUserId: id(context.actorUserId, 'actorUserId'),
      businessCustomerId: id(input.businessCustomerId, 'businessCustomerId'),
      ...(input.accountId ? { accountId: id(input.accountId, 'accountId') } : {}),
      eventKind: input.eventKind,
      ...(input.channel ? { channel: input.channel } : {}),
      ...(input.outcome ? { outcome: input.outcome } : {}),
      ...(note(input.note) ? { note: note(input.note) } : {}),
      ...(promisedAmountMinor !== undefined ? { promisedAmountMinor } : {}),
      ...(input.currencyCode ? { currencyCode: input.currencyCode.trim().toUpperCase() } : {}),
      ...(promisedFor ? { promisedFor } : {}),
      ...(dateTime(input.nextActionAt, 'nextActionAt') ? { nextActionAt: dateTime(input.nextActionAt, 'nextActionAt') } : {}),
      ...(context.requestId ? { requestId: context.requestId } : {}),
    });
  }

  listHistory(context: { readonly actorUserId: string }, input: { readonly businessCustomerId: string; readonly limit?: number }) {
    return this.repository.listHistory({ actorUserId: id(context.actorUserId, 'actorUserId'), businessCustomerId: id(input.businessCustomerId, 'businessCustomerId'), limit: int(input.limit ?? 50, 'limit', 1, 200) });
  }

  listTodayPlan(context: { readonly actorUserId: string }, input: { readonly businessId: string; readonly limit?: number; readonly asOf?: string; readonly dueSoonDays?: number }) {
    const asOf = date(input.asOf, 'asOf');
    return this.repository.listTodayPlan({ actorUserId: id(context.actorUserId, 'actorUserId'), businessId: id(input.businessId, 'businessId'), limit: int(input.limit ?? 100, 'limit', 1, 200), dueSoonDays: int(input.dueSoonDays ?? 7, 'dueSoonDays', 0, 90), ...(asOf ? { asOf } : {}) });
  }
}
