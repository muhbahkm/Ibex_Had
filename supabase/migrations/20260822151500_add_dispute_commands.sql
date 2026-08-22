-- IBEX HAD — customer review/dispute workflow.
-- A dispute never edits or deletes a financial transaction. It is an auditable review record only.

begin;

create unique index if not exists disputes_one_active_per_transaction_customer_uidx
  on public.disputes (transaction_id, customer_identity_id)
  where status in ('open', 'under_review');

create or replace function private.command_open_dispute(
  p_actor_user_id uuid,
  p_transaction_id uuid,
  p_reason text,
  p_request_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_business_id uuid;
  v_customer_identity_id uuid;
  v_transaction_status text;
  v_reason text;
  v_dispute_id uuid;
  v_created_at timestamptz;
begin
  v_user_id := private.require_actor(p_actor_user_id);
  v_reason := regexp_replace(btrim(p_reason), '[[:space:]]+', ' ', 'g');
  if length(v_reason) < 3 or length(v_reason) > 2000 then
    raise exception 'Dispute reason must contain between 3 and 2000 characters' using errcode = '22023';
  end if;

  select lt.business_id, lt.customer_identity_id, lt.status
    into v_business_id, v_customer_identity_id, v_transaction_status
  from public.ledger_transactions lt
  where lt.id = p_transaction_id;

  if v_business_id is null then
    raise exception 'Transaction not found' using errcode = 'P0002';
  end if;
  if v_transaction_status not in ('posted', 'reversed') then
    raise exception 'Only posted financial history can be reviewed' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.customer_identities ci
    where ci.id = v_customer_identity_id and ci.claimed_user_id = v_user_id
  ) then
    raise exception 'Dispute creation is not permitted' using errcode = '42501';
  end if;

  insert into public.disputes (
    transaction_id, business_id, customer_identity_id, opened_by_user_id, status, reason
  ) values (
    p_transaction_id, v_business_id, v_customer_identity_id, v_user_id, 'open', v_reason
  )
  returning id, created_at into v_dispute_id, v_created_at;

  insert into public.audit_events (business_id, actor_user_id, action, entity_type, entity_id, request_id, after_data)
  values (
    v_business_id, v_user_id, 'dispute.opened', 'dispute', v_dispute_id, p_request_id,
    jsonb_build_object('transaction_id', p_transaction_id, 'reason', v_reason)
  );

  return jsonb_build_object(
    'disputeId', v_dispute_id,
    'transactionId', p_transaction_id,
    'businessId', v_business_id,
    'status', 'open',
    'reason', v_reason,
    'createdAt', v_created_at
  );
exception
  when unique_violation then
    raise exception 'An active review already exists for this transaction' using errcode = '23505';
end;
$$;

create or replace function public.app_open_dispute(
  p_actor_user_id uuid,
  p_transaction_id uuid,
  p_reason text,
  p_request_id text default null
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.command_open_dispute(p_actor_user_id, p_transaction_id, p_reason, p_request_id);
$$;

create or replace function public.app_list_my_disputes(p_actor_user_id uuid)
returns table (
  dispute_id uuid,
  transaction_id uuid,
  business_id uuid,
  business_name text,
  status text,
  reason text,
  resolution_note text,
  created_at timestamptz,
  resolved_at timestamptz
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  v_user_id := private.require_actor(p_actor_user_id);
  return query
  select d.id, d.transaction_id, d.business_id, b.name, d.status, d.reason,
         d.resolution_note, d.created_at, d.resolved_at
  from public.disputes d
  join public.businesses b on b.id = d.business_id
  join public.customer_identities ci on ci.id = d.customer_identity_id
  where ci.claimed_user_id = v_user_id
  order by d.created_at desc;
end;
$$;

create or replace function public.app_list_business_disputes(
  p_actor_user_id uuid,
  p_business_id uuid,
  p_status text default null,
  p_limit integer default 100
)
returns table (
  dispute_id uuid,
  transaction_id uuid,
  customer_identity_id uuid,
  customer_name text,
  status text,
  reason text,
  resolution_note text,
  created_at timestamptz,
  resolved_at timestamptz
)
language plpgsql
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  v_user_id := private.require_actor(p_actor_user_id);
  if not private.can_manage_business(p_business_id, array['owner','manager','cashier','viewer']::text[]) then
    raise exception 'Business dispute read is not permitted' using errcode = '42501';
  end if;
  if p_limit < 1 or p_limit > 200 then
    raise exception 'Limit must be between 1 and 200' using errcode = '22023';
  end if;
  if p_status is not null and p_status not in ('open','under_review','resolved','rejected','withdrawn') then
    raise exception 'Invalid dispute status' using errcode = '22023';
  end if;

  return query
  select d.id, d.transaction_id, d.customer_identity_id, ci.display_name, d.status,
         d.reason, d.resolution_note, d.created_at, d.resolved_at
  from public.disputes d
  join public.customer_identities ci on ci.id = d.customer_identity_id
  where d.business_id = p_business_id
    and (p_status is null or d.status = p_status)
  order by d.created_at desc
  limit p_limit;
end;
$$;

create or replace function private.command_update_dispute(
  p_actor_user_id uuid,
  p_dispute_id uuid,
  p_status text,
  p_resolution_note text default null,
  p_request_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_dispute public.disputes;
  v_note text;
begin
  v_user_id := private.require_actor(p_actor_user_id);
  if p_status not in ('under_review','resolved','rejected') then
    raise exception 'Invalid dispute transition target' using errcode = '22023';
  end if;

  select * into v_dispute from public.disputes d where d.id = p_dispute_id for update;
  if not found then raise exception 'Dispute not found' using errcode = 'P0002'; end if;
  if not private.can_manage_business(v_dispute.business_id, array['owner','manager']::text[]) then
    raise exception 'Dispute update is not permitted' using errcode = '42501';
  end if;
  if v_dispute.status in ('resolved','rejected','withdrawn') then
    raise exception 'Closed dispute cannot be changed' using errcode = '22023';
  end if;

  v_note := nullif(regexp_replace(btrim(coalesce(p_resolution_note,'')), '[[:space:]]+', ' ', 'g'), '');
  if p_status in ('resolved','rejected') and (v_note is null or length(v_note) < 3 or length(v_note) > 2000) then
    raise exception 'A resolution note between 3 and 2000 characters is required' using errcode = '22023';
  end if;

  update public.disputes
  set status = p_status,
      resolution_note = case when p_status in ('resolved','rejected') then v_note else resolution_note end,
      resolved_by_user_id = case when p_status in ('resolved','rejected') then v_user_id else null end,
      resolved_at = case when p_status in ('resolved','rejected') then now() else null end
  where id = p_dispute_id
  returning * into v_dispute;

  insert into public.audit_events (business_id, actor_user_id, action, entity_type, entity_id, request_id, after_data)
  values (
    v_dispute.business_id, v_user_id, 'dispute.status_changed', 'dispute', v_dispute.id, p_request_id,
    jsonb_build_object('status', v_dispute.status, 'resolution_note', v_dispute.resolution_note)
  );

  return jsonb_build_object(
    'disputeId', v_dispute.id,
    'transactionId', v_dispute.transaction_id,
    'businessId', v_dispute.business_id,
    'status', v_dispute.status,
    'reason', v_dispute.reason,
    'resolutionNote', v_dispute.resolution_note,
    'createdAt', v_dispute.created_at,
    'resolvedAt', v_dispute.resolved_at
  );
end;
$$;

create or replace function public.app_update_dispute(
  p_actor_user_id uuid,
  p_dispute_id uuid,
  p_status text,
  p_resolution_note text default null,
  p_request_id text default null
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.command_update_dispute(p_actor_user_id, p_dispute_id, p_status, p_resolution_note, p_request_id);
$$;

revoke all on function private.command_open_dispute(uuid,uuid,text,text) from public, anon;
revoke all on function private.command_update_dispute(uuid,uuid,text,text,text) from public, anon;
grant execute on function private.command_open_dispute(uuid,uuid,text,text) to authenticated, service_role;
grant execute on function private.command_update_dispute(uuid,uuid,text,text,text) to authenticated, service_role;

revoke all on function public.app_open_dispute(uuid,uuid,text,text) from public, anon;
revoke all on function public.app_list_my_disputes(uuid) from public, anon;
revoke all on function public.app_list_business_disputes(uuid,uuid,text,integer) from public, anon;
revoke all on function public.app_update_dispute(uuid,uuid,text,text,text) from public, anon;
grant execute on function public.app_open_dispute(uuid,uuid,text,text) to authenticated, service_role;
grant execute on function public.app_list_my_disputes(uuid) to authenticated, service_role;
grant execute on function public.app_list_business_disputes(uuid,uuid,text,integer) to authenticated, service_role;
grant execute on function public.app_update_dispute(uuid,uuid,text,text,text) to authenticated, service_role;

comment on function public.app_open_dispute(uuid,uuid,text,text) is 'Opens an auditable customer review request without mutating financial history.';
comment on function public.app_update_dispute(uuid,uuid,text,text,text) is 'Owner/manager review-state command; never changes the referenced Ledger transaction.';

commit;
