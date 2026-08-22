export type FollowUpState = 'overdue' | 'due_today' | 'due_soon';

export interface CreditTermsRecord {
  readonly accountId: string;
  readonly termsDays: number;
  readonly graceDays: number;
  readonly enabled: boolean;
  readonly currencyCode: string;
}

export interface TodayFollowUpRecord {
  readonly businessCustomerId: string;
  readonly customerIdentityId: string;
  readonly displayName: string;
  readonly phoneE164?: string;
  readonly accountId: string;
  readonly currencyCode: string;
  readonly balanceMinor: bigint;
  readonly oldestDueAt: string;
  readonly effectiveOverdueAt: string;
  readonly followUpState: FollowUpState;
  readonly daysOverdue: number;
  readonly lastMovementAt?: string;
  readonly termsDays: number;
  readonly graceDays: number;
}

export interface CreditFollowUpRepository {
  setCreditTerms(input: {
    readonly actorUserId: string;
    readonly accountId: string;
    readonly termsDays: number;
    readonly graceDays: number;
    readonly enabled: boolean;
    readonly requestId?: string;
  }): Promise<CreditTermsRecord>;
  listTodayFollowUps(input: {
    readonly actorUserId: string;
    readonly businessId: string;
    readonly limit: number;
    readonly asOf?: string;
    readonly dueSoonDays: number;
  }): Promise<readonly TodayFollowUpRecord[]>;
}

function requireId(value: string, field: string): string {
  const normalized = value.trim();
  if (!normalized) throw new Error(`${field} is required`);
  return normalized;
}

function integerInRange(value: number, field: string, min: number, max: number): number {
  if (!Number.isInteger(value) || value < min || value > max) throw new Error(`${field} must be an integer between ${min} and ${max}`);
  return value;
}

export class CreditFollowUpService {
  constructor(private readonly repository: CreditFollowUpRepository) {}

  setCreditTerms(context: { readonly actorUserId: string; readonly requestId?: string }, input: { readonly accountId: string; readonly termsDays: number; readonly graceDays?: number; readonly enabled?: boolean }) {
    return this.repository.setCreditTerms({
      actorUserId: requireId(context.actorUserId, 'actorUserId'),
      accountId: requireId(input.accountId, 'accountId'),
      termsDays: integerInRange(input.termsDays, 'termsDays', 0, 3650),
      graceDays: integerInRange(input.graceDays ?? 0, 'graceDays', 0, 365),
      enabled: input.enabled ?? true,
      ...(context.requestId ? { requestId: context.requestId } : {}),
    });
  }

  listTodayFollowUps(context: { readonly actorUserId: string }, input: { readonly businessId: string; readonly limit?: number; readonly asOf?: string; readonly dueSoonDays?: number }) {
    const limit = integerInRange(input.limit ?? 100, 'limit', 1, 200);
    const dueSoonDays = integerInRange(input.dueSoonDays ?? 7, 'dueSoonDays', 0, 90);
    const asOf = input.asOf?.trim();
    if (asOf && !/^\d{4}-\d{2}-\d{2}$/.test(asOf)) throw new Error('asOf must use YYYY-MM-DD');
    return this.repository.listTodayFollowUps({
      actorUserId: requireId(context.actorUserId, 'actorUserId'),
      businessId: requireId(input.businessId, 'businessId'),
      limit,
      dueSoonDays,
      ...(asOf ? { asOf } : {}),
    });
  }
}
