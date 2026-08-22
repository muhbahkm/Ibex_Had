-- IBEX HAD — covering indexes for customer invite foreign keys.

begin;

create index customer_invites_business_idx
  on private.customer_invites (business_id);

create index customer_invites_customer_identity_idx
  on private.customer_invites (customer_identity_id);

create index customer_invites_created_by_user_idx
  on private.customer_invites (created_by_user_id)
  where created_by_user_id is not null;

commit;
