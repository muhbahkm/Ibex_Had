import { describe, expect, it } from 'vitest';

import { adaptSupabaseJsClient, type SupabaseJsClientLike } from './supabase-client-adapter.js';

class Thenable<T> implements PromiseLike<T> {
  constructor(private readonly value: T) {}

  then<TResult1 = T, TResult2 = never>(
    onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ): PromiseLike<TResult1 | TResult2> {
    return Promise.resolve(this.value).then(onfulfilled ?? undefined, onrejected ?? undefined);
  }
}

describe('adaptSupabaseJsClient', () => {
  it('adapts PromiseLike rpc builders into the runtime Promise contract', async () => {
    const client: SupabaseJsClientLike = {
      auth: {
        getUser: () => new Thenable({ data: { user: { id: 'user-1' } }, error: null }),
      },
      rpc: (functionName, args) =>
        new Thenable({
          data: { functionName, args },
          error: null,
        }),
    };

    const adapted = adaptSupabaseJsClient(client);

    await expect(adapted.auth.getUser()).resolves.toEqual({
      data: { user: { id: 'user-1' } },
      error: null,
    });
    await expect(adapted.rpc('app_test', { p_value: 1 })).resolves.toEqual({
      data: { functionName: 'app_test', args: { p_value: 1 } },
      error: null,
    });
  });
});
