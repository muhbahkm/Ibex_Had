-- IBEX HAD — Opaque customer invitations.
-- Raw invite tokens are returned once and never stored; only SHA-256 digests persist.

begin;

create table private.customer_invites (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  business_customer_id uuid not null references public.business_customers(id) on delete cascade,
  customer_identity_id uuid not null references public.customer_identities(id) on delete cascade,
  token_hash bytea not null unique,
  expires_at timestamptz not null,
  used_at timestamptz,
  revoked_at timestamptz,
  created_by_user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint customer_invites_expiry check (expires_at > created_at),
  constraint customer_invites_terminal_state check (not (used_at is not null and revoked_at is not null))
);
create index customer_invites_relationship_idx on private.customer_invites (business_customer_id, created_at desc);
create index customer_invites_expiry_idx on private.customer_invites (expires_at) where used_at is null and revoked_at is null;

revoke all on table private.customer_invites from public, anon, authenticated;
grant select, insert, update on table private.customer_invites to service_role;

create or replace function private.command_create_customer_invite(
  p_actor_user_id uuid,
  p_business_customer_id uuid,
  p_ttl_hours integer default 168,
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
  v_display_name text;
  v_phone text;
  v_token text;
  v_hash bytea;
  v_invite_id uuid;
  v_expires_at timestamptz;
begin
  v_user_id := private.require_actor(p_actor_user_id);
  if p_ttl_hours < 1 or p_ttl_hours > 720 then
    raise exception 'Invite TTL must be between 1 and 720 hours' using errcode = '22023';
  end if;

  select bc.business_id, bc.customer_identity_id, ci.display_name, ci.phone_e164
    into v_business_id, v_customer_identity_id, v_display_name, v_phone
  from public.business_customers bc
  join public.customer_identities ci on ci.id = bc.customer_identity_id
  where bc.id = p_business_customer_id and bc.status = 'active';

  if v_business_id is null or not private.can_manage_business(v_business_id, array['owner','manager','cashier']::text[]) then
    raise exception 'Customer invitation is not permitted' using errcode = '42501';
  end if;
  if v_phone is null then
    raise exception 'Customer must have a phone number before invitation' using errcode = '22023';
  end if;

  update private.customer_invites
  set revoked_at = now()
  where business_customer_id = p_business_customer_id
    and used_at is null
    and revoked_at is null
    and expires_at > now();

  v_token := encode(extensions.gen_random_bytes(24), 'hex');
  v_hash := extensions.digest(convert_to(v_token, 'UTF8'), 'sha256');
  v_expires_at := now() + make_interval(hours => p_ttl_hours);

  insert into private.customer_invites (
    business_id, business_customer_id, customer_identity_id,
    token_hash, expires_at, created_by_user_id
  ) values (
    v_business_id, p_business_customer_id, v_customer_identity_id,
    v_hash, v_expires_at, v_user_id
  ) returning id into v_invite_id;

  insert into public.audit_events (business_id, actor_user_id, action, entity_type, entity_id, request_id, after_data)
  values (
    v_business_id, v_user_id, 'customer_invite.created', 'customer_invite', v_invite_id, p_request_id,
    jsonb_build_object('business_customer_id', p_business_customer_id, 'expires_at', v_expires_at)
  );

  return jsonb_build_object(
    'inviteId', v_invite_id,
    'token', v_token,
    'expiresAt', v_expires_at,
    'businessCustomerId', p_business_customer_id,
    'customerIdentityId', v_customer_identity_id,
    'displayName', v_display_name
  );
end;
$$;

create or replace function private.command_claim_customer_invite(
  p_actor_user_id uuid,
  p_token text,
  p_request_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_hash bytea;
  v_invite private.customer_invites;
  v_business_name text;
begin
  v_user_id := private.require_actor(p_actor_user_id);
  if p_token is null or p_token !~ '^[0-9a-f]{48}$' then
    raise exception 'Invalid invitation token' using errcode = '22023';
  end if;

  v_hash := extensions.digest(convert_to(p_token, 'UTF8'), 'sha256');
  select * into v_invite
  from private.customer_invites i
  where i.token_hash = v_hash
  for update;

  if not found or v_invite.revoked_at is not null or v_invite.expires_at <= now() then
    raise exception 'Invitation is invalid or expired' using errcode = 'P0002';
  end if;

  if v_invite.used_at is not null then
    if exists (
      select 1 from public.customer_identities ci
      where ci.id = v_invite.customer_identity_id and ci.claimed_user_id = v_user_id
    ) then
      select b.name into v_business_name from public.businesses b where b.id = v_invite.business_id;
      return jsonb_build_object(
        'businessId', v_invite.business_id,
        'businessName', v_business_name,
        'businessCustomerId', v_invite.business_customer_id,
        'customerIdentityId', v_invite.customer_identity_id
      );
    end if;
    raise exception 'Invitation has already been used' using errcode = '23505';
  end if;

  perform private.claim_customer_identity_impl(v_invite.customer_identity_id);

  update private.customer_invites
  set used_at = now()
  where id = v_invite.id;

  select b.name into v_business_name from public.businesses b where b.id = v_invite.business_id;

  insert into public.audit_events (business_id, actor_user_id, action, entity_type, entity_id, request_id, after_data)
  values (
    v_invite.business_id, v_user_id, 'customer_invite.claimed', 'customer_invite', v_invite.id, p_request_id,
    jsonb_build_object('customer_identity_id', v_invite.customer_identity_id, 'business_customer_id', v_invite.business_customer_id)
  );

  return jsonb_build_object(
    'businessId', v_invite.business_id,
    'businessName', v_business_name,
    'businessCustomerId', v_invite.business_customer_id,
    'customerIdentityId', v_invite.customer_identity_id
  );
end;
$$;

create or replace function public.app_create_customer_invite(
  p_actor_user_id uuid,
  p_business_customer_id uuid,
  p_ttl_hours integer default 168,
  p_request_id text default null
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.command_create_customer_invite(p_actor_user_id, p_business_customer_id, p_ttl_hours, p_request_id);
$$;

create or replace function public.app_claim_customer_invite(
  p_actor_user_id uuid,
  p_token text,
  p_request_id text default null
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.command_claim_customer_invite(p_actor_user_id, p_token, p_request_id);
$$;

revoke all on function private.command_create_customer_invite(uuid,uuid,integer,text) from public, anon;
revoke all on function private.command_claim_customer_invite(uuid,text,text) from public, anon;
grant execute on function private.command_create_customer_invite(uuid,uuid,integer,text) to authenticated, service_role;
grant execute on function private.command_claim_customer_invite(uuid,text,text) to authenticated, service_role;

revoke all on function public.app_create_customer_invite(uuid,uuid,integer,text) from public, anon;
revoke all on function public.app_claim_customer_invite(uuid,text,text) from public, anon;
grant execute on function public.app_create_customer_invite(uuid,uuid,integer,text) to authenticated, service_role;
grant execute on function public.app_claim_customer_invite(uuid,text,text) to authenticated, service_role;

comment on table private.customer_invites is 'Opaque, expiring invitation records. Raw tokens are never stored.';
comment on function public.app_claim_customer_invite(uuid,text,text) is 'Claims the invited customer identity only after verified Auth phone matches the identity phone.';

commit;
