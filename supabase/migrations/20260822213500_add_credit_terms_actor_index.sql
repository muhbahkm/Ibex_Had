create index customer_credit_terms_updated_by_user_idx
  on private.customer_credit_terms (updated_by_user_id)
  where updated_by_user_id is not null;
