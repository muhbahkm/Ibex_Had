import { IbexApplication } from '../../application/src/application.js';
import type { RequestContext } from '../../application/src/ports.js';
import {
  InfrastructureError,
  SupabaseApplicationRepository,
  type RpcErrorLike,
  type SupabaseRpcClient,
} from '../../infrastructure/src/supabase-application-repository.js';

export interface AuthUserLike {
  readonly id: string;
}

export interface AuthGetUserResponse {
  readonly data: { readonly user: AuthUserLike | null };
  readonly error: RpcErrorLike | null;
}

export interface SupabaseSessionClient extends SupabaseRpcClient {
  readonly auth: {
    getUser(): Promise<AuthGetUserResponse>;
  };
}

export class AuthenticationRequiredError extends Error {
  constructor(message = 'An authenticated Supabase session is required') {
    super(message);
    this.name = 'AuthenticationRequiredError';
  }
}

export class IbexSessionApplication {
  private readonly application: IbexApplication;

  constructor(private readonly client: SupabaseSessionClient) {
    this.application = new IbexApplication(new SupabaseApplicationRepository(client));
  }

  async currentUserId(): Promise<string> {
    const { data, error } = await this.client.auth.getUser();
    if (error !== null) {
      throw new InfrastructureError('auth.getUser', error);
    }
    const userId = data.user?.id.trim();
    if (!userId) {
      throw new AuthenticationRequiredError();
    }
    return userId;
  }

  async createBusiness(
    input: Parameters<IbexApplication['createBusiness']>[1],
    requestId?: string,
  ) {
    return this.application.createBusiness(await this.context(requestId), input);
  }

  async createCustomer(
    input: Parameters<IbexApplication['createCustomer']>[1],
    requestId?: string,
  ) {
    return this.application.createCustomer(await this.context(requestId), input);
  }

  async openCustomerAccount(
    input: Parameters<IbexApplication['openCustomerAccount']>[1],
    requestId?: string,
  ) {
    return this.application.openCustomerAccount(await this.context(requestId), input);
  }

  async postSale(input: Parameters<IbexApplication['postSale']>[1], requestId?: string) {
    return this.application.postSale(await this.context(requestId), input);
  }

  async postReceipt(input: Parameters<IbexApplication['postReceipt']>[1], requestId?: string) {
    return this.application.postReceipt(await this.context(requestId), input);
  }

  async reverseTransaction(
    input: Parameters<IbexApplication['reverseTransaction']>[1],
    requestId?: string,
  ) {
    return this.application.reverseTransaction(await this.context(requestId), input);
  }

  async getStatement(
    input: Parameters<IbexApplication['getStatement']>[1],
    requestId?: string,
  ) {
    return this.application.getStatement(await this.context(requestId), input);
  }

  private async context(requestId?: string): Promise<RequestContext> {
    const actorUserId = await this.currentUserId();
    return requestId ? { actorUserId, requestId } : { actorUserId };
  }
}

export function createIbexSessionApplication(client: SupabaseSessionClient): IbexSessionApplication {
  return new IbexSessionApplication(client);
}
