import { assembleBusinessCollectionOverview, type BusinessCollectionOverview } from '../../../../packages/application/src/collection-read-model';

import { ibex, isPreviewRuntime } from './ibex';

interface BackendCollectionClient {
  getBusinessCollectionOverview(input: { readonly businessId: string; readonly limit?: number; readonly staleAfterDays?: number }): Promise<BusinessCollectionOverview>;
}

export function getBusinessCollectionOverview(input: { readonly businessId: string; readonly limit?: number; readonly staleAfterDays?: number }) {
  if (!isPreviewRuntime) {
    return (ibex as BackendCollectionClient).getBusinessCollectionOverview(input);
  }

  return assembleBusinessCollectionOverview(
    {
      listBusinessCustomers: (query) => ibex.listBusinessCustomers(query),
      listCustomerAccounts: (query) => ibex.listCustomerAccounts(query),
      getStatement: (query) => ibex.getStatement(query),
    },
    {
      businessId: input.businessId,
      limit: input.limit ?? 100,
      ...(input.staleAfterDays !== undefined ? { staleAfterDays: input.staleAfterDays } : {}),
    },
  );
}
