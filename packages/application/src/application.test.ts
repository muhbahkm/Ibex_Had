import { describe, expect, it } from 'vitest';

import { IbexApplication } from './application.js';
import type {
  AccountRecord,
  ApplicationRepository,
  BusinessCustomerSummaryRecord,
  BusinessRecord,
  BusinessSummaryRecord,
  ClaimedCustomerInviteRecord,
  ClaimCustomerInvitePortInput,
  CreateBusinessPortInput,
  CreateCustomerInvitePortInput,
  CreateCustomerPortInput,
  CustomerAccountSummaryRecord,
  CustomerInviteRecord,
  CustomerRecord,
  GetStatementPortInput,
  ListBusinessCustomersPortInput,
  ListBusinessesPortInput,
  ListCustomerAccountsPortInput,
  ListMyCustomerAccountsPortInput,
  MyCustomerAccountRecord,
  OpenAccountPortInput,
  PostMovementPortInput,
  PostedMovementRecord,
  ReverseTransactionPortInput,
  StatementEntryRecord,
} from './ports.js';

class RecordingRepository implements ApplicationRepository {
  businessInput?: CreateBusinessPortInput;
  customerInput?: CreateCustomerPortInput;
  accountInput?: OpenAccountPortInput;
  createInviteInput?: CreateCustomerInvitePortInput;
  claimInviteInput?: ClaimCustomerInvitePortInput;
  movementInput?: PostMovementPortInput;
  reversalInput?: ReverseTransactionPortInput;
  listBusinessesInput?: ListBusinessesPortInput;
  listCustomersInput?: ListBusinessCustomersPortInput;
  listAccountsInput?: ListCustomerAccountsPortInput;
  listMyAccountsInput?: ListMyCustomerAccountsPortInput;
  statementInput?: GetStatementPortInput;

  createBusiness(input: CreateBusinessPortInput): Promise<BusinessRecord> {
    this.businessInput = input;
    return Promise.resolve({ id: 'business-1', name: input.name, ...(input.defaultCurrencyCode ? { defaultCurrencyCode: input.defaultCurrencyCode } : {}) });
  }

  createCustomer(input: CreateCustomerPortInput): Promise<CustomerRecord> {
    this.customerInput = input;
    return Promise.resolve({ customerIdentityId: 'customer-1', businessCustomerId: 'relationship-1', displayName: input.displayName });
  }

  openCustomerAccount(input: OpenAccountPortInput): Promise<AccountRecord> {
    this.accountInput = input;
    return Promise.resolve({ id: 'account-1', businessCustomerId: input.businessCustomerId, currencyCode: input.currencyCode });
  }

  createCustomerInvite(input: CreateCustomerInvitePortInput): Promise<CustomerInviteRecord> {
    this.createInviteInput = input;
    return Promise.resolve({
      inviteId: 'invite-1',
      token: 'a'.repeat(48),
      expiresAt: '2026-08-29T10:00:00+00:00',
      businessCustomerId: input.businessCustomerId,
      customerIdentityId: 'customer-1',
      displayName: 'محمد علي',
    });
  }

  claimCustomerInvite(input: ClaimCustomerInvitePortInput): Promise<ClaimedCustomerInviteRecord> {
    this.claimInviteInput = input;
    return Promise.resolve({
      businessId: 'business-1',
      businessName: 'باحكم للعسل',
      businessCustomerId: 'relationship-1',
      customerIdentityId: 'customer-1',
    });
  }

  postMovement(input: PostMovementPortInput): Promise<PostedMovementRecord> {
    this.movementInput = input;
    const effect = input.direction === 'debit' ? input.amountMinor : -input.amountMinor;
    return Promise.resolve({ transactionId: 'tx-1', accountId: input.accountId, balanceMinor: effect, currencyCode: input.currencyCode });
  }

  reverseTransaction(input: ReverseTransactionPortInput): Promise<PostedMovementRecord> {
    this.reversalInput = input;
    return Promise.resolve({ transactionId: 'reversal-1', accountId: 'account-1', balanceMinor: 0n, currencyCode: 'YER' });
  }

  listBusinesses(input: ListBusinessesPortInput): Promise<readonly BusinessSummaryRecord[]> {
    this.listBusinessesInput = input;
    return Promise.resolve([]);
  }

  listBusinessCustomers(input: ListBusinessCustomersPortInput): Promise<readonly BusinessCustomerSummaryRecord[]> {
    this.listCustomersInput = input;
    return Promise.resolve([]);
  }

  listCustomerAccounts(input: ListCustomerAccountsPortInput): Promise<readonly CustomerAccountSummaryRecord[]> {
    this.listAccountsInput = input;
    return Promise.resolve([]);
  }

  listMyCustomerAccounts(input: ListMyCustomerAccountsPortInput): Promise<readonly MyCustomerAccountRecord[]> {
    this.listMyAccountsInput = input;
    return Promise.resolve([]);
  }

  getStatement(input: GetStatementPortInput): Promise<readonly StatementEntryRecord[]> {
    this.statementInput = input;
    return Promise.resolve([]);
  }
}

describe('IbexApplication', () => {
  it('normalizes business/customer/account inputs before reaching infrastructure', async () => {
    const repository = new RecordingRepository();
    const application = new IbexApplication(repository);
    await application.createBusiness({ actorUserId: ' user-1 ', requestId: 'req-1' }, { name: '  باحكم   للعسل ', defaultCurrencyCode: 'yer' });
    await application.createCustomer({ actorUserId: 'user-1' }, { businessId: 'business-1', displayName: ' محمد   علي ', phone: '0777 123 456' });
    await application.openCustomerAccount({ actorUserId: 'user-1' }, { businessCustomerId: 'relationship-1', currencyCode: 'sar' });
    expect(repository.businessInput).toEqual({ actorUserId: 'user-1', name: 'باحكم للعسل', countryCode: 'YE', defaultCurrencyCode: 'YER', requestId: 'req-1' });
    expect(repository.customerInput?.phoneE164).toBe('+967777123456');
    expect(repository.customerInput?.displayName).toBe('محمد علي');
    expect(repository.accountInput?.currencyCode).toBe('SAR');
  });

  it('normalizes invite TTL and validates opaque invite tokens', async () => {
    const repository = new RecordingRepository();
    const application = new IbexApplication(repository);
    const token = 'A'.repeat(48);

    await application.createCustomerInvite(
      { actorUserId: ' user-1 ', requestId: 'request-invite' },
      { businessCustomerId: ' relationship-1 ' },
    );
    await application.claimCustomerInvite(
      { actorUserId: ' user-2 ' },
      { token },
    );

    expect(repository.createInviteInput).toEqual({
      actorUserId: 'user-1',
      businessCustomerId: 'relationship-1',
      ttlHours: 168,
      requestId: 'request-invite',
    });
    expect(repository.claimInviteInput).toEqual({
      actorUserId: 'user-2',
      token: 'a'.repeat(48),
    });
    await expect(
      application.claimCustomerInvite({ actorUserId: 'user-2' }, { token: 'not-a-token' }),
    ).rejects.toThrow('Invitation token is invalid');
  });

  it('rejects invite TTL outside the bounded lifetime', async () => {
    const repository = new RecordingRepository();
    const application = new IbexApplication(repository);
    await expect(
      application.createCustomerInvite(
        { actorUserId: 'user-1' },
        { businessCustomerId: 'relationship-1', ttlHours: 721 },
      ),
    ).rejects.toThrow('Invite TTL');
    expect(repository.createInviteInput).toBeUndefined();
  });

  it('maps a sale to a debit using lossless bigint money', async () => {
    const repository = new RecordingRepository();
    const application = new IbexApplication(repository);
    await application.postSale({ actorUserId: 'user-1' }, { businessId: 'business-1', customerIdentityId: 'customer-1', accountId: 'account-1', amountMinor: '900719925474099312345', currencyCode: 'yer', idempotencyKey: 'sale-command-0001' });
    expect(repository.movementInput?.transactionType).toBe('sale_on_account');
    expect(repository.movementInput?.direction).toBe('debit');
    expect(repository.movementInput?.amountMinor).toBe(900719925474099312345n);
    expect(repository.movementInput?.currencyCode).toBe('YER');
  });

  it('maps a receipt to a credit', async () => {
    const repository = new RecordingRepository();
    const application = new IbexApplication(repository);
    await application.postReceipt({ actorUserId: 'user-1' }, { businessId: 'business-1', customerIdentityId: 'customer-1', accountId: 'account-1', amountMinor: '50000', currencyCode: 'YER', idempotencyKey: 'receipt-command-0001' });
    expect(repository.movementInput?.transactionType).toBe('receipt');
    expect(repository.movementInput?.direction).toBe('credit');
    expect(repository.movementInput?.amountMinor).toBe(50000n);
  });

  it('rejects invalid monetary and idempotency inputs before infrastructure', async () => {
    const repository = new RecordingRepository();
    const application = new IbexApplication(repository);
    await expect(application.postSale({ actorUserId: 'user-1' }, { businessId: 'business-1', customerIdentityId: 'customer-1', accountId: 'account-1', amountMinor: '1.5', currencyCode: 'YER', idempotencyKey: 'sale-command-0002' })).rejects.toThrow();
    await expect(application.postReceipt({ actorUserId: 'user-1' }, { businessId: 'business-1', customerIdentityId: 'customer-1', accountId: 'account-1', amountMinor: '100', currencyCode: 'YER', idempotencyKey: 'short' })).rejects.toThrow();
    expect(repository.movementInput).toBeUndefined();
  });

  it('delegates reversal as an explicit command', async () => {
    const repository = new RecordingRepository();
    const application = new IbexApplication(repository);
    await application.reverseTransaction({ actorUserId: 'user-1', requestId: 'request-9' }, { transactionId: 'tx-original', idempotencyKey: 'reversal-command-0001', reason: 'تصحيح' });
    expect(repository.reversalInput).toEqual({ actorUserId: 'user-1', transactionId: 'tx-original', idempotencyKey: 'reversal-command-0001', reason: 'تصحيح', requestId: 'request-9' });
  });

  it('normalizes operational and self-service read queries before infrastructure', async () => {
    const repository = new RecordingRepository();
    const application = new IbexApplication(repository);
    await application.listBusinesses({ actorUserId: ' user-1 ' });
    await application.listBusinessCustomers({ actorUserId: 'user-1' }, { businessId: ' business-1 ', search: '  محمد  ' });
    await application.listCustomerAccounts({ actorUserId: 'user-1' }, { businessCustomerId: ' relationship-1 ' });
    await application.listMyCustomerAccounts({ actorUserId: ' user-1 ' });
    expect(repository.listBusinessesInput).toEqual({ actorUserId: 'user-1' });
    expect(repository.listCustomersInput).toEqual({ actorUserId: 'user-1', businessId: 'business-1', limit: 100, search: 'محمد' });
    expect(repository.listAccountsInput).toEqual({ actorUserId: 'user-1', businessCustomerId: 'relationship-1' });
    expect(repository.listMyAccountsInput).toEqual({ actorUserId: 'user-1' });
  });

  it('bounds statement pagination', async () => {
    const repository = new RecordingRepository();
    const application = new IbexApplication(repository);
    await application.getStatement({ actorUserId: 'user-1' }, { accountId: 'account-1' });
    expect(repository.statementInput?.limit).toBe(50);
    await expect(application.getStatement({ actorUserId: 'user-1' }, { accountId: 'account-1', limit: 201 })).rejects.toThrow();
  });
});
