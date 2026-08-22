import { IbexApplication } from '../../application/src/application.js';
import { getBusinessCollectionOverviewFromBackend } from '../../application/src/collection-read-model.js';
import type { RequestContext } from '../../application/src/ports.js';
import { SupabaseCollectionReadRepository } from '../../infrastructure/src/supabase-collection-read-repository.js';
import {
  InfrastructureError,
  SupabaseApplicationRepository,
  type RpcErrorLike,
  type SupabaseRpcClient,
} from '../../infrastructure/src/supabase-application-repository.js';

export interface AuthUserLike { readonly id: string; }
export interface AuthGetUserResponse { readonly data: { readonly user: AuthUserLike | null }; readonly error: RpcErrorLike | null; }
export interface SupabaseSessionClient extends SupabaseRpcClient { readonly auth: { getUser(): Promise<AuthGetUserResponse>; }; }

export class AuthenticationRequiredError extends Error {
  constructor(message = 'An authenticated Supabase session is required') {
    super(message);
    this.name = 'AuthenticationRequiredError';
  }
}

export class IbexSessionApplication {
  private readonly application: IbexApplication;
  private readonly collectionReads: SupabaseCollectionReadRepository;

  constructor(private readonly client: SupabaseSessionClient) {
    this.application = new IbexApplication(new SupabaseApplicationRepository(client));
    this.collectionReads = new SupabaseCollectionReadRepository(client, () => this.currentUserId());
  }

  async currentUserId(): Promise<string> {
    const { data, error } = await this.client.auth.getUser();
    if (error !== null) throw new InfrastructureError('auth.getUser', error);
    const userId = data.user?.id.trim();
    if (!userId) throw new AuthenticationRequiredError();
    return userId;
  }

  async createBusiness(input: Parameters<IbexApplication['createBusiness']>[1], requestId?: string) { return this.application.createBusiness(await this.context(requestId), input); }
  async createCustomer(input: Parameters<IbexApplication['createCustomer']>[1], requestId?: string) { return this.application.createCustomer(await this.context(requestId), input); }
  async openCustomerAccount(input: Parameters<IbexApplication['openCustomerAccount']>[1], requestId?: string) { return this.application.openCustomerAccount(await this.context(requestId), input); }
  async createCustomerInvite(input: Parameters<IbexApplication['createCustomerInvite']>[1], requestId?: string) { return this.application.createCustomerInvite(await this.context(requestId), input); }
  async claimCustomerInvite(input: Parameters<IbexApplication['claimCustomerInvite']>[1], requestId?: string) { return this.application.claimCustomerInvite(await this.context(requestId), input); }
  async openDispute(input: Parameters<IbexApplication['openDispute']>[1], requestId?: string) { return this.application.openDispute(await this.context(requestId), input); }
  async updateDispute(input: Parameters<IbexApplication['updateDispute']>[1], requestId?: string) { return this.application.updateDispute(await this.context(requestId), input); }
  async prepareTransactionDocument(input: Parameters<IbexApplication['prepareTransactionDocument']>[1], requestId?: string) { return this.application.prepareTransactionDocument(await this.context(requestId), input); }
  async listTransactionDocuments(input: Parameters<IbexApplication['listTransactionDocuments']>[1], requestId?: string) { return this.application.listTransactionDocuments(await this.context(requestId), input); }
  async listNotifications(input: Parameters<IbexApplication['listNotifications']>[1] = {}, requestId?: string) { return this.application.listNotifications(await this.context(requestId), input); }
  async markNotificationRead(input: Parameters<IbexApplication['markNotificationRead']>[1], requestId?: string) { return this.application.markNotificationRead(await this.context(requestId), input); }
  async postSale(input: Parameters<IbexApplication['postSale']>[1], requestId?: string) { return this.application.postSale(await this.context(requestId), input); }
  async postReceipt(input: Parameters<IbexApplication['postReceipt']>[1], requestId?: string) { return this.application.postReceipt(await this.context(requestId), input); }
  async reverseTransaction(input: Parameters<IbexApplication['reverseTransaction']>[1], requestId?: string) { return this.application.reverseTransaction(await this.context(requestId), input); }
  async listBusinesses(requestId?: string) { return this.application.listBusinesses(await this.context(requestId)); }
  async listBusinessCustomers(input: Parameters<IbexApplication['listBusinessCustomers']>[1], requestId?: string) { return this.application.listBusinessCustomers(await this.context(requestId), input); }
  async listCustomerAccounts(input: Parameters<IbexApplication['listCustomerAccounts']>[1], requestId?: string) { return this.application.listCustomerAccounts(await this.context(requestId), input); }
  async listMyCustomerAccounts(requestId?: string) { return this.application.listMyCustomerAccounts(await this.context(requestId)); }
  async listMyDisputes(requestId?: string) { return this.application.listMyDisputes(await this.context(requestId)); }
  async listBusinessDisputes(input: Parameters<IbexApplication['listBusinessDisputes']>[1], requestId?: string) { return this.application.listBusinessDisputes(await this.context(requestId), input); }
  async getStatement(input: Parameters<IbexApplication['getStatement']>[1], requestId?: string) { return this.application.getStatement(await this.context(requestId), input); }
  async getBusinessCollectionOverview(input: { readonly businessId: string; readonly limit?: number; readonly staleAfterDays?: number }) {
    return getBusinessCollectionOverviewFromBackend(this.collectionReads, {
      businessId: input.businessId,
      limit: input.limit ?? 100,
      ...(input.staleAfterDays !== undefined ? { staleAfterDays: input.staleAfterDays } : {}),
    });
  }

  private async context(requestId?: string): Promise<RequestContext> {
    const actorUserId = await this.currentUserId();
    return requestId ? { actorUserId, requestId } : { actorUserId };
  }
}

export function createIbexSessionApplication(client: SupabaseSessionClient): IbexSessionApplication { return new IbexSessionApplication(client); }
