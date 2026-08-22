import { assembleBusinessCollectionOverview } from '../../../../packages/application/src/collection-read-model';

import { ibex } from './ibex';

export function getBusinessCollectionOverview(input: { readonly businessId: string; readonly limit?: number; readonly staleAfterDays?: number }) {
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
