import {
  normalizeCurrencyCode,
  normalizeFullName,
  normalizePhoneE164,
  parsePositiveMinorUnits,
} from '../../core/src/index.js';
import type { ApplicationRepository, RequestContext } from './ports.js';

function requireId(value: string, field: string): string {
  const normalized = value.trim();
  if (normalized.length === 0) {
    throw new Error(`${field} is required`);
  }
  return normalized;
}

function normalizeIdempotencyKey(value: string): string {
  const normalized = value.trim();
  if (normalized.length < 8 || normalized.length > 200) {
    throw new Error('Idempotency key must contain between 8 and 200 characters');
  }
  return normalized;
}

function normalizeCountryCode(value: string): string {
  const normalized = value.trim().toUpperCase();
  if (!/^[A-Z]{2}$/.test(normalized)) {
    throw new Error('Country code must be a 2-letter code');
  }
  return normalized;
}

export class IbexApplication {
  constructor(private readonly repository: ApplicationRepository) {}

  async createBusiness(
    context: RequestContext,
    input: {
      readonly name: string;
      readonly countryCode?: string;
      readonly defaultCurrencyCode?: string;
    },
  ) {
    return this.repository.createBusiness({
      actorUserId: requireId(context.actorUserId, 'actorUserId'),
      name: normalizeFullName(input.name),
      countryCode: normalizeCountryCode(input.countryCode ?? 'YE'),
      ...(input.defaultCurrencyCode
        ? { defaultCurrencyCode: normalizeCurrencyCode(input.defaultCurrencyCode) }
        : {}),
      ...(context.requestId ? { requestId: context.requestId } : {}),
    });
  }

  async createCustomer(
    context: RequestContext,
    input: {
      readonly businessId: string;
      readonly displayName: string;
      readonly phone?: string;
    },
  ) {
    return this.repository.createCustomer({
      actorUserId: requireId(context.actorUserId, 'actorUserId'),
      businessId: requireId(input.businessId, 'businessId'),
      displayName: normalizeFullName(input.displayName),
      ...(input.phone ? { phoneE164: normalizePhoneE164(input.phone) } : {}),
      ...(context.requestId ? { requestId: context.requestId } : {}),
    });
  }

  async openCustomerAccount(
    context: RequestContext,
    input: {
      readonly businessCustomerId: string;
      readonly currencyCode: string;
    },
  ) {
    return this.repository.openCustomerAccount({
      actorUserId: requireId(context.actorUserId, 'actorUserId'),
      businessCustomerId: requireId(input.businessCustomerId, 'businessCustomerId'),
      currencyCode: normalizeCurrencyCode(input.currencyCode),
      ...(context.requestId ? { requestId: context.requestId } : {}),
    });
  }

  async postSale(
    context: RequestContext,
    input: {
      readonly businessId: string;
      readonly customerIdentityId: string;
      readonly accountId: string;
      readonly amountMinor: string;
      readonly currencyCode: string;
      readonly idempotencyKey: string;
      readonly occurredAt?: string;
      readonly description?: string;
    },
  ) {
    return this.repository.postMovement({
      actorUserId: requireId(context.actorUserId, 'actorUserId'),
      businessId: requireId(input.businessId, 'businessId'),
      customerIdentityId: requireId(input.customerIdentityId, 'customerIdentityId'),
      accountId: requireId(input.accountId, 'accountId'),
      transactionType: 'sale_on_account',
      direction: 'debit',
      amountMinor: parsePositiveMinorUnits(input.amountMinor),
      currencyCode: normalizeCurrencyCode(input.currencyCode),
      idempotencyKey: normalizeIdempotencyKey(input.idempotencyKey),
      ...(input.occurredAt ? { occurredAt: input.occurredAt } : {}),
      ...(input.description ? { description: input.description.trim() } : {}),
      ...(context.requestId ? { requestId: context.requestId } : {}),
    });
  }

  async postReceipt(
    context: RequestContext,
    input: {
      readonly businessId: string;
      readonly customerIdentityId: string;
      readonly accountId: string;
      readonly amountMinor: string;
      readonly currencyCode: string;
      readonly idempotencyKey: string;
      readonly occurredAt?: string;
      readonly description?: string;
    },
  ) {
    return this.repository.postMovement({
      actorUserId: requireId(context.actorUserId, 'actorUserId'),
      businessId: requireId(input.businessId, 'businessId'),
      customerIdentityId: requireId(input.customerIdentityId, 'customerIdentityId'),
      accountId: requireId(input.accountId, 'accountId'),
      transactionType: 'receipt',
      direction: 'credit',
      amountMinor: parsePositiveMinorUnits(input.amountMinor),
      currencyCode: normalizeCurrencyCode(input.currencyCode),
      idempotencyKey: normalizeIdempotencyKey(input.idempotencyKey),
      ...(input.occurredAt ? { occurredAt: input.occurredAt } : {}),
      ...(input.description ? { description: input.description.trim() } : {}),
      ...(context.requestId ? { requestId: context.requestId } : {}),
    });
  }

  async reverseTransaction(
    context: RequestContext,
    input: {
      readonly transactionId: string;
      readonly idempotencyKey: string;
      readonly occurredAt?: string;
      readonly reason?: string;
    },
  ) {
    return this.repository.reverseTransaction({
      actorUserId: requireId(context.actorUserId, 'actorUserId'),
      transactionId: requireId(input.transactionId, 'transactionId'),
      idempotencyKey: normalizeIdempotencyKey(input.idempotencyKey),
      ...(input.occurredAt ? { occurredAt: input.occurredAt } : {}),
      ...(input.reason ? { reason: input.reason.trim() } : {}),
      ...(context.requestId ? { requestId: context.requestId } : {}),
    });
  }

  async getStatement(
    context: RequestContext,
    input: {
      readonly accountId: string;
      readonly limit?: number;
      readonly beforeOccurredAt?: string;
    },
  ) {
    const limit = input.limit ?? 50;
    if (!Number.isInteger(limit) || limit < 1 || limit > 200) {
      throw new Error('Statement limit must be an integer between 1 and 200');
    }

    return this.repository.getStatement({
      actorUserId: requireId(context.actorUserId, 'actorUserId'),
      accountId: requireId(input.accountId, 'accountId'),
      limit,
      ...(input.beforeOccurredAt ? { beforeOccurredAt: input.beforeOccurredAt } : {}),
    });
  }
}
