-- IBEX HAD — narrow identity/onboarding commands.
-- End-user clients still receive no broad INSERT/UPDATE privileges on profile/customer tables.

begin;

create or replace function private.complete_profile_impl(p_full_name text)
returns public.profiles
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_phone text;
  v_phone_verified_at timestamptz;
  v_full_name text;
  v_profile public.profiles;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  v_full_name := regexp_replace(btrim(p_full_name), '[[:space:]]+', ' ', 'g');
  if length(v_full_name) < 2 or length(v_full_name) > 120 then
    raise exception 'Full name must contain between 2 and 120 characters' using errcode = '22023';
  end if;

  select u.phone, u.phone_confirmed_at
    into v_phone, v_phone_verified_at
  from auth.users u
  where u.id = v_user_id;

  if v_phone is null or v_phone_verified_at is null then
    raise exception 'A verified phone number is required' using errcode = '42501';
  end if;

  if v_phone !~ '^\+[1-9][0-9]{7,14}$' then
    raise exception 'Verified Auth phone is not valid E.164' using errcode = '22023';
  end if;

  insert into public.profiles (
    id,
    full_name,
    phone_e164,
    phone_verified_at
  ) values (
    v_user_id,
    v_full_name,
    v_phone,
    v_phone_verified_at
  )
  on conflict (id) do update
  set full_name = excluded.full_name,
      phone_e164 = excluded.phone_e164,
      phone_verified_at = excluded.phone_verified_at
  returning * into v_profile;

  insert into public.audit_events (
    actor_user_id,
    action,
    entity_type,
    entity_id,
    after_data
  ) values (
    v_user_id,
    'profile.completed',
    'profile',
    v_user_id,
    jsonb_build_object(
      'phone_e164', v_profile.phone_e164,
      'phone_verified_at', v_profile.phone_verified_at
    )
  );

  return v_profile;
end;
$$;

create or replace function private.claim_customer_identity_impl(p_customer_identity_id uuid)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_user_phone text;
  v_phone_verified_at timestamptz;
  v_identity_phone text;
  v_claimed_user_id uuid;
begin
  if v_user_id is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select u.phone, u.phone_confirmed_at
    into v_user_phone, v_phone_verified_at
  from auth.users u
  where u.id = v_user_id;

  if v_user_phone is null or v_phone_verified_at is null then
    raise exception 'A verified phone number is required' using errcode = '42501';
  end if;

  select ci.phone_e164, ci.claimed_user_id
    into v_identity_phone, v_claimed_user_id
  from public.customer_identities ci
  where ci.id = p_customer_identity_id
  for update;

  if not found then
    raise exception 'Customer identity not found' using errcode = 'P0002';
  end if;

  if v_claimed_user_id = v_user_id then
    return p_customer_identity_id;
  end if;

  if v_claimed_user_id is not null then
    raise exception 'Customer identity is already claimed' using errcode = '23505';
  end if;

  if v_identity_phone is null or v_identity_phone <> v_user_phone then
    raise exception 'Verified phone does not match customer identity' using errcode = '42501';
  end if;

  update public.customer_identities
  set claimed_user_id = v_user_id
  where id = p_customer_identity_id;

  insert into public.audit_events (
    actor_user_id,
    action,
    entity_type,
    entity_id,
    after_data
  ) values (
    v_user_id,
    'customer_identity.claimed',
    'customer_identity',
    p_customer_identity_id,
    jsonb_build_object('claimed_user_id', v_user_id)
  );

  return p_customer_identity_id;
end;
$$;

-- Public Data API wrappers remain SECURITY INVOKER. Privilege elevation is isolated
-- in private implementations that re-check auth.uid() and verified Auth phone state.
create or replace function public.complete_profile(p_full_name text)
returns public.profiles
language plpgsql
security invoker
set search_path = ''
as $$
begin
  return private.complete_profile_impl(p_full_name);
end;
$$;

create or replace function public.claim_customer_identity(p_customer_identity_id uuid)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
begin
  return private.claim_customer_identity_impl(p_customer_identity_id);
end;
$$;

revoke all on function private.complete_profile_impl(text) from public, anon, authenticated;
revoke all on function private.claim_customer_identity_impl(uuid) from public, anon, authenticated;
grant execute on function private.complete_profile_impl(text) to authenticated, service_role;
grant execute on function private.claim_customer_identity_impl(uuid) to authenticated, service_role;

revoke all on function public.complete_profile(text) from public, anon;
revoke all on function public.claim_customer_identity(uuid) from public, anon;
grant execute on function public.complete_profile(text) to authenticated, service_role;
grant execute on function public.claim_customer_identity(uuid) to authenticated, service_role;

comment on function public.complete_profile(text) is
  'Authenticated onboarding command: derives verified phone from auth.users and safely upserts the caller profile.';
comment on function public.claim_customer_identity(uuid) is
  'Authenticated claim command: claims one explicit unclaimed customer identity only when its E.164 phone matches the caller verified Auth phone.';

commit;
