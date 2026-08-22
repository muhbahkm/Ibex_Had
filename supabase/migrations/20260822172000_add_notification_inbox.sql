-- IBEX HAD — Notification Inbox v1.
-- Durable in-app notifications are the domain delivery record. Push/SMS are optional channels later.

begin;

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_user_id uuid not null references auth.users(id) on delete cascade,
  business_id uuid not null references public.businesses(id) on delete cascade,
  kind text not null check (kind in ('transaction_posted','dispute_opened','dispute_closed')),
  transaction_id uuid references public.ledger_transactions(id) on delete cascade,
  dispute_id uuid references public.disputes(id) on delete cascade,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notifications_entity_shape_check check (
    (kind = 'transaction_posted' and transaction_id is not null and dispute_id is null)
    or (kind in ('dispute_opened','dispute_closed') and transaction_id is not null and dispute_id is not null)
  )
);

create index notifications_recipient_created_idx
  on public.notifications (recipient_user_id, created_at desc);
create index notifications_business_idx on public.notifications (business_id);
create index notifications_transaction_idx on public.notifications (transaction_id);
create index notifications_dispute_idx on public.notifications (dispute_id);

alter table public.notifications enable row level security;

create policy notifications_read_own
on public.notifications
for select
to authenticated
using (recipient_user_id = (select auth.uid()));

grant select on public.notifications to authenticated;
revoke insert, update, delete on public.notifications from authenticated, anon;

create or replace function private.notify_customer_on_posted_transaction()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recipient uuid;
begin
  if old.status = 'draft' and new.status = 'posted' then
    select ci.claimed_user_id into v_recipient
    from public.customer_identities ci
    where ci.id = new.customer_identity_id;

    if v_recipient is not null and v_recipient <> new.posted_by_user_id then
      insert into public.notifications (
        recipient_user_id, business_id, kind, transaction_id
      ) values (
        v_recipient, new.business_id, 'transaction_posted', new.id
      );
    end if;
  end if;
  return new;
end;
$$;

create trigger ledger_transactions_notify_customer_after_post
  after update of status on public.ledger_transactions
  for each row
  execute function private.notify_customer_on_posted_transaction();

create or replace function private.notify_business_on_dispute_opened()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.notifications (
    recipient_user_id, business_id, kind, transaction_id, dispute_id
  )
  select recipients.user_id, new.business_id, 'dispute_opened', new.transaction_id, new.id
  from (
    select b.owner_user_id as user_id
    from public.businesses b
    where b.id = new.business_id
    union
    select bm.user_id
    from public.business_members bm
    where bm.business_id = new.business_id
      and bm.status = 'active'
      and bm.role in ('owner','manager')
  ) recipients
  where recipients.user_id is not null
    and recipients.user_id <> new.opened_by_user_id;

  return new;
end;
$$;

create trigger disputes_notify_business_after_insert
  after insert on public.disputes
  for each row
  execute function private.notify_business_on_dispute_opened();

create or replace function private.notify_customer_on_dispute_closed()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_recipient uuid;
begin
  if old.status is distinct from new.status and new.status in ('resolved','rejected') then
    select ci.claimed_user_id into v_recipient
    from public.customer_identities ci
    where ci.id = new.customer_identity_id;

    if v_recipient is not null and v_recipient <> new.resolved_by_user_id then
      insert into public.notifications (
        recipient_user_id, business_id, kind, transaction_id, dispute_id
      ) values (
        v_recipient, new.business_id, 'dispute_closed', new.transaction_id, new.id
      );
    end if;
  end if;
  return new;
end;
$$;

create trigger disputes_notify_customer_after_close
  after update of status on public.disputes
  for each row
  execute function private.notify_customer_on_dispute_closed();

create or replace function public.app_list_notifications(
  p_actor_user_id uuid,
  p_unread_only boolean default false,
  p_limit integer default 50
)
returns table (
  notification_id uuid,
  kind text,
  business_id uuid,
  business_name text,
  transaction_id uuid,
  transaction_type text,
  dispute_id uuid,
  dispute_status text,
  read_at timestamptz,
  created_at timestamptz
)
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  v_user_id := private.require_actor(p_actor_user_id);
  if p_limit < 1 or p_limit > 200 then
    raise exception 'Notification limit must be between 1 and 200' using errcode = '22023';
  end if;

  return query
  select
    n.id,
    n.kind,
    n.business_id,
    b.name,
    n.transaction_id,
    lt.transaction_type,
    n.dispute_id,
    d.status,
    n.read_at,
    n.created_at
  from public.notifications n
  join public.businesses b on b.id = n.business_id
  left join public.ledger_transactions lt on lt.id = n.transaction_id
  left join public.disputes d on d.id = n.dispute_id
  where n.recipient_user_id = v_user_id
    and (not p_unread_only or n.read_at is null)
  order by n.created_at desc, n.id desc
  limit p_limit;
end;
$$;

create or replace function private.command_mark_notification_read(
  p_actor_user_id uuid,
  p_notification_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_notification public.notifications;
begin
  v_user_id := private.require_actor(p_actor_user_id);

  update public.notifications n
  set read_at = coalesce(n.read_at, now())
  where n.id = p_notification_id
    and n.recipient_user_id = v_user_id
  returning * into v_notification;

  if not found then
    raise exception 'Notification not found' using errcode = 'P0002';
  end if;

  return jsonb_build_object(
    'notificationId', v_notification.id,
    'readAt', v_notification.read_at
  );
end;
$$;

create or replace function public.app_mark_notification_read(
  p_actor_user_id uuid,
  p_notification_id uuid
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.command_mark_notification_read(p_actor_user_id, p_notification_id);
$$;

revoke all on function private.notify_customer_on_posted_transaction() from public, anon, authenticated;
revoke all on function private.notify_business_on_dispute_opened() from public, anon, authenticated;
revoke all on function private.notify_customer_on_dispute_closed() from public, anon, authenticated;
revoke all on function private.command_mark_notification_read(uuid,uuid) from public, anon;
grant execute on function private.command_mark_notification_read(uuid,uuid) to authenticated, service_role;

revoke all on function public.app_list_notifications(uuid,boolean,integer) from public, anon;
revoke all on function public.app_mark_notification_read(uuid,uuid) from public, anon;
grant execute on function public.app_list_notifications(uuid,boolean,integer) to authenticated, service_role;
grant execute on function public.app_mark_notification_read(uuid,uuid) to authenticated, service_role;

comment on table public.notifications is
  'Durable provider-independent in-app notification inbox. Push/SMS are delivery channels, not the source of truth.';
comment on function public.app_list_notifications(uuid,boolean,integer) is
  'Lists only the authenticated user notification inbox, newest first.';
comment on function public.app_mark_notification_read(uuid,uuid) is
  'Marks one owned notification as read; retries preserve the original read timestamp.';

commit;
