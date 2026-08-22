import {
  normalizeCurrencyCode,
  normalizeFullName,
  normalizePhoneE164,
  parsePositiveMinorUnits,
} from '../../core/src/index.js';
import type { ApplicationRepository, DisputeStatus, RequestContext } from './ports.js';

function requireId(value: string, field: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) throw new Error(`${field} is required`);
  return normalized;
}
function normalizeIdempotencyKey(value: string): string {
  const normalized = value.trim();
  if (normalized.length < 8 || normalized.length > 200) throw new Error('Idempotency key must contain between 8 and 200 characters');
  return normalized;
}
function normalizeCountryCode(value: string): string {
  const normalized = value.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) throw new Error('Country code must be a 2-letter code');
  return normalized;
}
function normalizeLimit(value: number | undefined, fallback: number, maximum: number): number {
  const limit = value ?? fallback;
  if (!Number.isInteger(limit) || limit < 1 || limit > maximum) throw new Error(`Limit must be an integer between 1 and ${maximum}`);
  return limit;
}
function normalizeInviteTtl(value: number | undefined): number {
  const ttl = value ?? 168;
  if (!Number.isInteger(ttl) || ttl < 1 || ttl > 720) throw new Error('Invite TTL must be an integer between 1 and 720 hours');
  return ttl;
}
function normalizeInviteToken(value: string): string {
  const token = value.trim().toLowerCase();
  if (!/^[0-9a-f]{48}$/.test(token)) throw new Error('Invitation token is invalid');
  return token;
}
function normalizeReviewText(value: string, field: string, required: boolean): string | undefined {
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (!normalized) {
    if (required) throw new Error(`${field} is required`);
    return undefined;
  }
  if (normalized.length < 3 || normalized.length > 2000) throw new Error(`${field} must contain between 3 and 2000 characters`);
  return normalized;
}
function normalizeDisputeStatus(value: DisputeStatus | undefined): DisputeStatus | undefined {
  if (value === undefined) return undefined;
  if (!['open', 'under_review', 'resolved', 'rejected', 'withdrawn'].includes(value)) throw new Error('Invalid dispute status');
  return value;
}

export class IbexApplication {
  constructor(private readonly repository: ApplicationRepository) {}

  async createBusiness(context: RequestContext, input: { readonly name: string; readonly countryCode?: string; readonly defaultCurrencyCode?: string }) {
    return this.repository.createBusiness({ actorUserId: requireId(context.actorUserId, 'actorUserId'), name: normalizeFullName(input.name), countryCode: normalizeCountryCode(input.countryCode ?? 'YE'), ...(input.defaultCurrencyCode ? { defaultCurrencyCode: normalizeCurrencyCode(input.defaultCurrencyCode) } : {}), ...(context.requestId ? { requestId: context.requestId } : {}) });
  }
  async createCustomer(context: RequestContext, input: { readonly businessId: string; readonly displayName: string; readonly phone?: string }) {
    return this.repository.createCustomer({ actorUserId: requireId(context.actorUserId, 'actorUserId'), businessId: requireId(input.businessId, 'businessId'), displayName: normalizeFullName(input.displayName), ...(input.phone ? { phoneE164: normalizePhoneE164(input.phone) } : {}), ...(context.requestId ? { requestId: context.requestId } : {}) });
  }
  async openCustomerAccount(context: RequestContext, input: { readonly businessCustomerId: string; readonly currencyCode: string }) {
    return this.repository.openCustomerAccount({ actorUserId: requireId(context.actorUserId, 'actorUserId'), businessCustomerId: requireId(input.businessCustomerId, 'businessCustomerId'), currencyCode: normalizeCurrencyCode(input.currencyCode), ...(context.requestId ? { requestId: context.requestId } : {}) });
  }
  async createCustomerInvite(context: RequestContext, input: { readonly businessCustomerId: string; readonly ttlHours?: number }) {
    return this.repository.createCustomerInvite({ actorUserId: requireId(context.actorUserId, 'actorUserId'), businessCustomerId: requireId(input.businessCustomerId, 'businessCustomerId'), ttlHours: normalizeInviteTtl(input.ttlHours), ...(context.requestId ? { requestId: context.requestId } : {}) });
  }
  async claimCustomerInvite(context: RequestContext, input: { readonly token: string }) {
    return this.repository.claimCustomerInvite({ actorUserId: requireId(context.actorUserId, 'actorUserId'), token: normalizeInviteToken(input.token), ...(context.requestId ? { requestId: context.requestId } : {}) });
  }
  async openDispute(context: RequestContext, input: { readonly transactionId: string; readonly reason: string }) {
    const reason = normalizeReviewText(input.reason, 'Dispute reason', true)!;
    return this.repository.openDispute({ actorUserId: requireId(context.actorUserId, 'actorUserId'), transactionId: requireId(input.transactionId, 'transactionId'), reason, ...(context.requestId ? { requestId: context.requestId } : {}) });
  }
  async updateDispute(context: RequestContext, input: { readonly disputeId: string; readonly status: 'under_review' | 'resolved' | 'rejected'; readonly resolutionNote?: string }) {
    const resolutionNote = input.resolutionNote ? normalizeReviewText(input.resolutionNote, 'Resolution note', input.status !== 'under_review') : undefined;
    if (input.status !== 'under_review' && !resolutionNote) throw new Error('Resolution note is required');
    return this.repository.updateDispute({ actorUserId: requireId(context.actorUserId, 'actorUserId'), disputeId: requireId(input.disputeId, 'disputeId'), status: input.status, ...(resolutionNote ? { resolutionNote } : {}), ...(context.requestId ? { requestId: context.requestId } : {}) });
  }
  async postSale(context: RequestContext, input: { readonly businessId: string; readonly customerIdentityId: string; readonly accountId: string; readonly amountMinor: string; readonly currencyCode: string; readonly idempotencyKey: string; readonly occurredAt?: string; readonly description?: string }) {
    return this.repository.postMovement({ actorUserId: requireId(context.actorUserId, 'actorUserId'), businessId: requireId(input.businessId, 'businessId'), customerIdentityId: requireId(input.customerIdentityId, 'customerIdentityId'), accountId: requireId(input.accountId, 'accountId'), transactionType: 'sale_on_account', direction: 'debit', amountMinor: parsePositiveMinorUnits(input.amountMinor), currencyCode: normalizeCurrencyCode(input.currencyCode), idempotencyKey: normalizeIdempotencyKey(input.idempotencyKey), ...(input.occurredAt ? { occurredAt: input.occurredAt } : {}), ...(input.description ? { description: input.description.trim() } : {}), ...(context.requestId ? { requestId: context.requestId } : {}) });
  }
  async postReceipt(context: RequestContext, input: { readonly businessId: string; readonly customerIdentityId: string; readonly accountId: string; readonly amountMinor: string; readonly currencyCode: string; readonly idempotencyKey: string; readonly occurredAt?: string; readonly description?: string }) {
    return this.repository.postMovement({ actorUserId: requireId(context.actorUserId, 'actorUserId'), businessId: requireId(input.businessId, 'businessId'), customerIdentityId: requireId(input.customerIdentityId, 'customerIdentityId'), accountId: requireId(input.accountId, 'accountId'), transactionType: 'receipt', direction: 'credit', amountMinor: parsePositiveMinorUnits(input.amountMinor), currencyCode: normalizeCurrencyCode(input.currencyCode), idempotencyKey: normalizeIdempotencyKey(input.idempotencyKey), ...(input.occurredAt ? { occurredAt: input.occurredAt } : {}), ...(input.description ? { description: input.description.trim() } : {}), ...(context.requestId ? { requestId: context.requestId } : {}) });
  }
  async reverseTransaction(context: RequestContext, input: { readonly transactionId: string; readonly idempotencyKey: string; readonly occurredAt?: string; readonly reason?: string }) {
    return this.repository.reverseTransaction({ actorUserId: requireId(context.actorUserId, 'actorUserId'), transactionId: requireId(input.transactionId, 'transactionId'), idempotencyKey: normalizeIdempotencyKey(input.idempotencyKey), ...(input.occurredAt ? { occurredAt: input.occurredAt } : {}), ...(input.reason ? { reason: input.reason.trim() } : {}), ...(context.requestId ? { requestId: context.requestId } : {}) });
  }
  async listBusinesses(context: RequestContext) { return this.repository.listBusinesses({ actorUserId: requireId(context.actorUserId, 'actorUserId') }); }
  async listBusinessCustomers(context: RequestContext, input: { readonly businessId: string; readonly limit?: number; readonly search?: string }) {
    const search = input.search?.trim();
    return this.repository.listBusinessCustomers({ actorUserId: requireId(context.actorUserId, 'actorUserId'), businessId: requireId(input.businessId, 'businessId'), limit: normalizeLimit(input.limit, 100, 200), ...(search ? { search } : {}) });
  }
  async listCustomerAccounts(context: RequestContext, input: { readonly businessCustomerId: string }) {
    return this.repository.listCustomerAccounts({ actorUserId: requireId(context.actorUserId, 'actorUserId'), businessCustomerId: requireId(input.businessCustomerId, 'businessCustomerId') });
  }
  async listMyCustomerAccounts(context: RequestContext) { return this.repository.listMyCustomerAccounts({ actorUserId: requireId(context.actorUserId, 'actorUserId') }); }
  async listMyDisputes(context: RequestContext) { return this.repository.listMyDisputes({ actorUserId: requireId(context.actorUserId, 'actorUserId') }); }
  async listBusinessDisputes(context: RequestContext, input: { readonly businessId: string; readonly status?: DisputeStatus; readonly limit?: number }) {
    return this.repository.listBusinessDisputes({ actorUserId: requireId(context.actorUserId, 'actorUserId'), businessId: requireId(input.businessId, 'businessId'), limit: normalizeLimit(input.limit, 100, 200), ...(normalizeDisputeStatus(input.status) ? { status: input.status } : {}) });
  }
  async getStatement(context: RequestContext, input: { readonly accountId: string; readonly limit?: number; readonly beforeOccurredAt?: string }) {
    return this.repository.getStatement({ actorUserId: requireId(context.actorUserId, 'actorUserId'), accountId: requireId(input.accountId, 'accountId'), limit: normalizeLimit(input.limit, 50, 200), ...(input.beforeOccurredAt ? { beforeOccurredAt: input.beforeOccurredAt } : {}) });
  }
}
