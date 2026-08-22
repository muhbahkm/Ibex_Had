import type {
  AuthGetUserResponse,
  SupabaseSessionClient,
} from './session-application.js';
import type { RpcResponse } from '../../infrastructure/src/supabase-application-repository.js';

/**
 * Minimal structural contract implemented by @supabase/supabase-js SupabaseClient.
 * Keeping this package free of a direct SDK dependency lets Mobile and Web own
 * their platform-specific Supabase client configuration while sharing the same
 * IBEX application runtime.
 */
export interface SupabaseJsClientLike {
  readonly auth: {
    getUser(): PromiseLike<AuthGetUserResponse>;
  };
  rpc(functionName: string, args?: Record<string, unknown>): PromiseLike<RpcResponse>;
}

export function adaptSupabaseJsClient(client: SupabaseJsClientLike): SupabaseSessionClient {
  return {
    auth: {
      async getUser(): Promise<AuthGetUserResponse> {
        return await client.auth.getUser();
      },
    },
    async rpc(functionName: string, args?: Record<string, unknown>): Promise<RpcResponse> {
      return await client.rpc(functionName, args);
    },
  };
}
