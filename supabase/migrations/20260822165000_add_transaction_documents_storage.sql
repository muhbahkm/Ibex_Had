-- IBEX HAD — Transaction documents v1.
-- Private Storage bucket + narrow prepare/list RPCs. No public document URLs.

begin;

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'transaction-documents',
  'transaction-documents',
  false,
  10485760,
  array['application/pdf','image/jpeg','image/png','image/webp']::text[]
)
on conflict (id) do update
set public = excluded.public,
    file_size_limit = excluded.file_size_limit,
    allowed_mime_types = excluded.allowed_mime_types;

create or replace function private.command_prepare_transaction_document(
  p_actor_user_id uuid,
  p_transaction_id uuid,
  p_file_name text,
  p_mime_type text,
  p_size_bytes bigint,
  p_request_id text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_transaction public.ledger_transactions;
  v_document public.documents;
  v_extension text;
  v_storage_path text;
begin
  v_user_id := private.require_actor(p_actor_user_id);

  select * into v_transaction
  from public.ledger_transactions lt
  where lt.id = p_transaction_id;

  if v_transaction.id is null then
    raise exception 'Transaction not found' using errcode = 'P0002';
  end if;
  if v_transaction.status not in ('posted','reversed') then
    raise exception 'Documents can only be attached to posted transaction history' using errcode = '22023';
  end if;
  if not private.can_manage_business(v_transaction.business_id, array['owner','manager','cashier']::text[]) then
    raise exception 'Document upload is not permitted' using errcode = '42501';
  end if;
  if length(btrim(p_file_name)) < 1 or length(btrim(p_file_name)) > 240 then
    raise exception 'Invalid file name' using errcode = '22023';
  end if;
  if p_size_bytes is null or p_size_bytes < 1 or p_size_bytes > 10485760 then
    raise exception 'Document size must be between 1 byte and 10 MiB' using errcode = '22023';
  end if;

  v_extension := case p_mime_type
    when 'application/pdf' then 'pdf'
    when 'image/jpeg' then 'jpg'
    when 'image/png' then 'png'
    when 'image/webp' then 'webp'
    else null
  end;
  if v_extension is null then
    raise exception 'Unsupported document MIME type' using errcode = '22023';
  end if;

  v_storage_path := format(
    'businesses/%s/transactions/%s/%s.%s',
    v_transaction.business_id,
    v_transaction.id,
    gen_random_uuid(),
    v_extension
  );

  insert into public.documents (
    business_id,
    uploaded_by_user_id,
    storage_bucket,
    storage_path,
    file_name,
    mime_type,
    size_bytes
  ) values (
    v_transaction.business_id,
    v_user_id,
    'transaction-documents',
    v_storage_path,
    btrim(p_file_name),
    p_mime_type,
    p_size_bytes
  )
  returning * into v_document;

  insert into public.transaction_documents (transaction_id, document_id)
  values (v_transaction.id, v_document.id);

  insert into public.audit_events (
    business_id, actor_user_id, action, entity_type, entity_id, request_id, after_data
  ) values (
    v_transaction.business_id,
    v_user_id,
    'transaction_document.prepared',
    'document',
    v_document.id,
    p_request_id,
    jsonb_build_object(
      'transaction_id', v_transaction.id,
      'file_name', v_document.file_name,
      'mime_type', v_document.mime_type,
      'size_bytes', v_document.size_bytes
    )
  );

  return jsonb_build_object(
    'documentId', v_document.id,
    'transactionId', v_transaction.id,
    'storageBucket', v_document.storage_bucket,
    'storagePath', v_document.storage_path,
    'fileName', v_document.file_name,
    'mimeType', v_document.mime_type,
    'sizeBytes', v_document.size_bytes
  );
end;
$$;

create or replace function private.command_list_transaction_documents(
  p_actor_user_id uuid,
  p_transaction_id uuid
)
returns table (
  document_id uuid,
  transaction_id uuid,
  storage_bucket text,
  storage_path text,
  file_name text,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  perform private.require_actor(p_actor_user_id);

  if not private.can_access_transaction(p_transaction_id) then
    raise exception 'Transaction access is not permitted' using errcode = '42501';
  end if;

  return query
  select
    d.id,
    td.transaction_id,
    d.storage_bucket,
    d.storage_path,
    d.file_name,
    d.mime_type,
    d.size_bytes,
    d.created_at
  from public.transaction_documents td
  join public.documents d on d.id = td.document_id
  join storage.objects o
    on o.bucket_id = d.storage_bucket
   and o.name = d.storage_path
  where td.transaction_id = p_transaction_id
  order by d.created_at desc, d.id desc;
end;
$$;

create or replace function public.app_prepare_transaction_document(
  p_actor_user_id uuid,
  p_transaction_id uuid,
  p_file_name text,
  p_mime_type text,
  p_size_bytes bigint,
  p_request_id text default null
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.command_prepare_transaction_document(
    p_actor_user_id,
    p_transaction_id,
    p_file_name,
    p_mime_type,
    p_size_bytes,
    p_request_id
  );
$$;

create or replace function public.app_list_transaction_documents(
  p_actor_user_id uuid,
  p_transaction_id uuid
)
returns table (
  document_id uuid,
  transaction_id uuid,
  storage_bucket text,
  storage_path text,
  file_name text,
  mime_type text,
  size_bytes bigint,
  created_at timestamptz
)
language sql
stable
security invoker
set search_path = ''
as $$
  select * from private.command_list_transaction_documents(p_actor_user_id, p_transaction_id);
$$;

revoke all on function private.command_prepare_transaction_document(uuid,uuid,text,text,bigint,text) from public, anon;
revoke all on function private.command_list_transaction_documents(uuid,uuid) from public, anon;
grant execute on function private.command_prepare_transaction_document(uuid,uuid,text,text,bigint,text) to authenticated, service_role;
grant execute on function private.command_list_transaction_documents(uuid,uuid) to authenticated, service_role;

revoke all on function public.app_prepare_transaction_document(uuid,uuid,text,text,bigint,text) from public, anon;
revoke all on function public.app_list_transaction_documents(uuid,uuid) from public, anon;
grant execute on function public.app_prepare_transaction_document(uuid,uuid,text,text,bigint,text) to authenticated, service_role;
grant execute on function public.app_list_transaction_documents(uuid,uuid) to authenticated, service_role;

-- Upload is permitted only for a server-prepared document row owned by the caller.
drop policy if exists ibex_transaction_documents_insert on storage.objects;
create policy ibex_transaction_documents_insert
on storage.objects
for insert
to authenticated
with check (
  bucket_id = 'transaction-documents'
  and exists (
    select 1
    from public.documents d
    join public.transaction_documents td on td.document_id = d.id
    join public.ledger_transactions lt on lt.id = td.transaction_id
    where d.storage_bucket = storage.objects.bucket_id
      and d.storage_path = storage.objects.name
      and d.uploaded_by_user_id = (select auth.uid())
      and lt.business_id = d.business_id
      and private.can_manage_business(d.business_id, array['owner','manager','cashier']::text[])
  )
);

-- Private downloads/signing are limited to registered documents the caller can access.
drop policy if exists ibex_transaction_documents_select on storage.objects;
create policy ibex_transaction_documents_select
on storage.objects
for select
to authenticated
using (
  bucket_id = 'transaction-documents'
  and exists (
    select 1
    from public.documents d
    where d.storage_bucket = storage.objects.bucket_id
      and d.storage_path = storage.objects.name
      and private.can_access_document(d.id)
  )
);

comment on function public.app_prepare_transaction_document(uuid,uuid,text,text,bigint,text) is
  'Prepares an immutable transaction-document record and server-generated private Storage path before upload.';
comment on function public.app_list_transaction_documents(uuid,uuid) is
  'Lists only uploaded private documents for one transaction when the caller can access that transaction.';

commit;
