create table if not exists private.collection_followup_events (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  business_customer_id uuid not null references public.business_customers(id) on delete cascade,
  account_id uuid references public.customer_accounts(id) on delete set null,
  actor_user_id uuid not null references auth.users(id) on delete restrict,
  event_kind text not null check (event_kind in ('contact_attempt','contact_reached','promise_to_pay','note','escalation')),
  channel text check (channel is null or channel in ('call','whatsapp','sms','in_person','email','other')),
  outcome text check (outcome is null or outcome in ('no_answer','reached','promised','callback_requested','refused','wrong_number','other')),
  note text,
  promised_amount_minor bigint check (promised_amount_minor is null or promised_amount_minor > 0),
  currency_code text,
  promised_for date,
  next_action_at timestamptz,
  created_at timestamptz not null default now(),
  check (note is null or char_length(note) <= 2000),
  check ((promised_amount_minor is null and currency_code is null) or (promised_amount_minor is not null and currency_code is not null)),
  check (event_kind = 'promise_to_pay' or promised_for is null),
  check (event_kind = 'promise_to_pay' or promised_amount_minor is null)
);

create index if not exists collection_followup_events_business_created_idx on private.collection_followup_events(business_id, created_at desc);
create index if not exists collection_followup_events_customer_created_idx on private.collection_followup_events(business_customer_id, created_at desc);
create index if not exists collection_followup_events_account_created_idx on private.collection_followup_events(account_id, created_at desc) where account_id is not null;
create index if not exists collection_followup_events_next_action_idx on private.collection_followup_events(business_id, next_action_at) where next_action_at is not null;
create index if not exists collection_followup_events_actor_idx on private.collection_followup_events(actor_user_id);

revoke all on private.collection_followup_events from public, anon, authenticated;

create or replace function private.command_record_collection_followup_event(
  p_actor_user_id uuid,
  p_business_customer_id uuid,
  p_account_id uuid,
  p_event_kind text,
  p_channel text default null,
  p_outcome text default null,
  p_note text default null,
  p_promised_amount_minor bigint default null,
  p_currency_code text default null,
  p_promised_for date default null,
  p_next_action_at timestamptz default null,
  p_request_id text default null
) returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_business_id uuid;
  v_account_currency text;
  v_event private.collection_followup_events;
begin
  v_user_id := private.require_actor(p_actor_user_id);

  select bc.business_id into v_business_id
  from public.business_customers bc
  where bc.id = p_business_customer_id and bc.status = 'active';

  if v_business_id is null or not private.can_manage_business(v_business_id, array['owner','manager','cashier']::text[]) then
    raise exception 'Collection follow-up recording is not permitted' using errcode = '42501';
  end if;

  if p_event_kind not in ('contact_attempt','contact_reached','promise_to_pay','note','escalation') then
    raise exception 'Unsupported collection follow-up event kind' using errcode = '22023';
  end if;
  if p_channel is not null and p_channel not in ('call','whatsapp','sms','in_person','email','other') then
    raise exception 'Unsupported collection follow-up channel' using errcode = '22023';
  end if;
  if p_outcome is not null and p_outcome not in ('no_answer','reached','promised','callback_requested','refused','wrong_number','other') then
    raise exception 'Unsupported collection follow-up outcome' using errcode = '22023';
  end if;
  if p_note is not null and char_length(btrim(p_note)) > 2000 then
    raise exception 'Collection follow-up note is too long' using errcode = '22023';
  end if;

  if p_account_id is not null then
    select ca.currency_code into v_account_currency
    from public.customer_accounts ca
    where ca.id = p_account_id
      and ca.business_customer_id = p_business_customer_id
      and ca.status <> 'closed';
    if v_account_currency is null then
      raise exception 'Follow-up account is outside customer scope' using errcode = '22023';
    end if;
  end if;

  if p_event_kind = 'promise_to_pay' then
    if p_promised_for is null then
      raise exception 'Promise date is required' using errcode = '22023';
    end if;
    if p_account_id is null then
      raise exception 'Promise must be linked to an account' using errcode = '22023';
    end if;
    if p_promised_amount_minor is not null and p_promised_amount_minor <= 0 then
      raise exception 'Promised amount must be positive' using errcode = '22023';
    end if;
    if p_promised_amount_minor is not null and coalesce(nullif(btrim(p_currency_code), ''), '') <> v_account_currency then
      raise exception 'Promise currency must match account currency' using errcode = '22023';
    end if;
  elsif p_promised_for is not null or p_promised_amount_minor is not null or p_currency_code is not null then
    raise exception 'Promise fields require promise_to_pay event' using errcode = '22023';
  end if;

  insert into private.collection_followup_events(
    business_id, business_customer_id, account_id, actor_user_id, event_kind, channel, outcome,
    note, promised_amount_minor, currency_code, promised_for, next_action_at
  ) values (
    v_business_id, p_business_customer_id, p_account_id, v_user_id, p_event_kind, p_channel, p_outcome,
    nullif(btrim(p_note), ''), p_promised_amount_minor,
    case when p_promised_amount_minor is not null then v_account_currency else null end,
    p_promised_for, p_next_action_at
  ) returning * into v_event;

  insert into public.audit_events(business_id, actor_user_id, action, entity_type, entity_id, request_id, after_data)
  values (
    v_business_id, v_user_id, 'collection_followup.recorded', 'collection_followup_event', v_event.id, p_request_id,
    jsonb_build_object(
      'business_customer_id', p_business_customer_id,
      'account_id', p_account_id,
      'event_kind', p_event_kind,
      'channel', p_channel,
      'outcome', p_outcome,
      'promised_for', p_promised_for,
      'next_action_at', p_next_action_at
    )
  );

  return jsonb_build_object(
    'eventId', v_event.id,
    'businessId', v_event.business_id,
    'businessCustomerId', v_event.business_customer_id,
    'accountId', v_event.account_id,
    'eventKind', v_event.event_kind,
    'channel', v_event.channel,
    'outcome', v_event.outcome,
    'note', v_event.note,
    'promisedAmountMinor', case when v_event.promised_amount_minor is null then null else v_event.promised_amount_minor::text end,
    'currencyCode', v_event.currency_code,
    'promisedFor', v_event.promised_for,
    'nextActionAt', v_event.next_action_at,
    'createdAt', v_event.created_at
  );
end;
$$;

create or replace function private.query_collection_followup_history(
  p_actor_user_id uuid,
  p_business_customer_id uuid,
  p_limit integer default 50
) returns table(
  event_id uuid,
  business_id uuid,
  business_customer_id uuid,
  account_id uuid,
  event_kind text,
  channel text,
  outcome text,
  note text,
  promised_amount_minor bigint,
  currency_code text,
  promised_for date,
  next_action_at timestamptz,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_business_id uuid;
begin
  perform private.require_actor(p_actor_user_id);
  if p_limit < 1 or p_limit > 200 then
    raise exception 'Follow-up history limit must be between 1 and 200' using errcode = '22023';
  end if;
  select bc.business_id into v_business_id
  from public.business_customers bc
  where bc.id = p_business_customer_id and bc.status = 'active';
  if v_business_id is null or not private.can_manage_business(v_business_id, array['owner','manager','cashier','viewer']::text[]) then
    raise exception 'Collection follow-up history access is not permitted' using errcode = '42501';
  end if;

  return query
  select e.id, e.business_id, e.business_customer_id, e.account_id, e.event_kind, e.channel, e.outcome,
         e.note, e.promised_amount_minor, e.currency_code, e.promised_for, e.next_action_at, e.created_at
  from private.collection_followup_events e
  where e.business_customer_id = p_business_customer_id
  order by e.created_at desc, e.id desc
  limit p_limit;
end;
$$;

create or replace function private.query_collection_today_plan(
  p_actor_user_id uuid,
  p_business_id uuid,
  p_limit integer default 100,
  p_as_of date default current_date,
  p_due_soon_days integer default 7
) returns table(
  business_customer_id uuid,
  customer_identity_id uuid,
  display_name text,
  phone_e164 text,
  account_id uuid,
  currency_code text,
  balance_minor bigint,
  oldest_due_at timestamptz,
  effective_overdue_at timestamptz,
  follow_up_state text,
  days_overdue integer,
  priority_bucket text,
  priority_score integer,
  recommended_action text,
  reason_code text,
  last_followup_at timestamptz,
  last_event_kind text,
  last_outcome text,
  promised_for date,
  promised_amount_minor bigint,
  next_action_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_actor(p_actor_user_id);
  if not private.can_manage_business(p_business_id, array['owner','manager','cashier','viewer']::text[]) then
    raise exception 'Collection today plan access is not permitted' using errcode = '42501';
  end if;
  if p_limit < 1 or p_limit > 200 then
    raise exception 'Today plan limit must be between 1 and 200' using errcode = '22023';
  end if;
  if p_due_soon_days < 0 or p_due_soon_days > 90 then
    raise exception 'Due-soon days must be between 0 and 90' using errcode = '22023';
  end if;

  return query
  with due_rows as (
    select * from private.query_today_followups(p_actor_user_id, p_business_id, 200, p_as_of, p_due_soon_days)
  ), enriched as (
    select d.*,
           le.created_at as last_followup_at,
           le.event_kind as last_event_kind,
           le.outcome as last_outcome,
           le.promised_for,
           le.promised_amount_minor,
           le.next_action_at,
           case
             when le.event_kind = 'promise_to_pay' and le.promised_for < p_as_of then 'broken_promise'
             when le.event_kind = 'promise_to_pay' and le.promised_for = p_as_of then 'promise_due_today'
             when le.next_action_at is not null and le.next_action_at::date <= p_as_of then 'scheduled_action_due'
             when d.follow_up_state = 'overdue' and (le.created_at is null or le.created_at::date <= p_as_of - 3) then 'overdue_uncontacted'
             when d.follow_up_state = 'overdue' then 'overdue_recently_contacted'
             when d.follow_up_state = 'due_today' then 'due_today'
             else 'due_soon'
           end as reason_code
    from due_rows d
    left join lateral (
      select e.* from private.collection_followup_events e
      where e.business_customer_id = d.business_customer_id
        and (e.account_id is null or e.account_id = d.account_id)
      order by e.created_at desc, e.id desc
      limit 1
    ) le on true
  ), scored as (
    select e.*,
      case e.reason_code
        when 'broken_promise' then 'urgent'
        when 'promise_due_today' then 'urgent'
        when 'scheduled_action_due' then 'high'
        when 'overdue_uncontacted' then 'high'
        when 'overdue_recently_contacted' then 'medium'
        when 'due_today' then 'medium'
        else 'normal'
      end as priority_bucket,
      case e.reason_code
        when 'broken_promise' then 100
        when 'promise_due_today' then 95
        when 'scheduled_action_due' then 90
        when 'overdue_uncontacted' then 85
        when 'overdue_recently_contacted' then 75
        when 'due_today' then 60
        else 40
      end as priority_score,
      case e.reason_code
        when 'broken_promise' then 'follow_up_broken_promise'
        when 'promise_due_today' then 'confirm_payment_promise'
        when 'scheduled_action_due' then 'execute_scheduled_follow_up'
        when 'overdue_uncontacted' then 'contact_customer'
        when 'overdue_recently_contacted' then 'review_recent_contact'
        when 'due_today' then 'send_due_today_reminder'
        else 'prepare_due_soon_reminder'
      end as recommended_action
    from enriched e
  )
  select s.business_customer_id, s.customer_identity_id, s.display_name, s.phone_e164, s.account_id,
         s.currency_code, s.balance_minor, s.oldest_due_at, s.effective_overdue_at, s.follow_up_state,
         s.days_overdue, s.priority_bucket, s.priority_score, s.recommended_action, s.reason_code,
         s.last_followup_at, s.last_event_kind, s.last_outcome, s.promised_for, s.promised_amount_minor,
         s.next_action_at
  from scored s
  order by s.priority_score desc, s.days_overdue desc, s.oldest_due_at asc, s.display_name asc, s.account_id
  limit p_limit;
end;
$$;

create or replace function public.app_record_collection_followup_event(
  p_actor_user_id uuid,
  p_business_customer_id uuid,
  p_account_id uuid default null,
  p_event_kind text default 'note',
  p_channel text default null,
  p_outcome text default null,
  p_note text default null,
  p_promised_amount_minor bigint default null,
  p_currency_code text default null,
  p_promised_for date default null,
  p_next_action_at timestamptz default null,
  p_request_id text default null
) returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.command_record_collection_followup_event(
    p_actor_user_id, p_business_customer_id, p_account_id, p_event_kind, p_channel, p_outcome,
    p_note, p_promised_amount_minor, p_currency_code, p_promised_for, p_next_action_at, p_request_id
  );
$$;

create or replace function public.app_list_collection_followup_history(
  p_actor_user_id uuid,
  p_business_customer_id uuid,
  p_limit integer default 50
) returns setof private.collection_followup_events
language sql
security invoker
set search_path = ''
as $$
  select e.*
  from private.collection_followup_events e
  join private.query_collection_followup_history(p_actor_user_id, p_business_customer_id, p_limit) q on q.event_id = e.id
  order by e.created_at desc, e.id desc;
$$;

create or replace function public.app_list_collection_today_plan(
  p_actor_user_id uuid,
  p_business_id uuid,
  p_limit integer default 100,
  p_as_of date default current_date,
  p_due_soon_days integer default 7
) returns table(
  business_customer_id uuid,
  customer_identity_id uuid,
  display_name text,
  phone_e164 text,
  account_id uuid,
  currency_code text,
  balance_minor bigint,
  oldest_due_at timestamptz,
  effective_overdue_at timestamptz,
  follow_up_state text,
  days_overdue integer,
  priority_bucket text,
  priority_score integer,
  recommended_action text,
  reason_code text,
  last_followup_at timestamptz,
  last_event_kind text,
  last_outcome text,
  promised_for date,
  promised_amount_minor bigint,
  next_action_at timestamptz
)
language sql
security invoker
set search_path = ''
as $$
  select * from private.query_collection_today_plan(p_actor_user_id, p_business_id, p_limit, p_as_of, p_due_soon_days);
$$;

revoke all on function public.app_record_collection_followup_event(uuid,uuid,uuid,text,text,text,text,bigint,text,date,timestamptz,text) from public, anon;
revoke all on function public.app_list_collection_followup_history(uuid,uuid,integer) from public, anon;
revoke all on function public.app_list_collection_today_plan(uuid,uuid,integer,date,integer) from public, anon;
grant execute on function public.app_record_collection_followup_event(uuid,uuid,uuid,text,text,text,text,bigint,text,date,timestamptz,text) to authenticated;
grant execute on function public.app_list_collection_followup_history(uuid,uuid,integer) to authenticated;
grant execute on function public.app_list_collection_today_plan(uuid,uuid,integer,date,integer) to authenticated;
