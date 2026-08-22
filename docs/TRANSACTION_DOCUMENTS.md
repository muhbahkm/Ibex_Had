# Transaction Documents v1

IBEX HAD treats transaction attachments as private evidence linked to immutable financial history. A document does not change a ledger transaction, its amount, or its balance effect.

## Access model

- Bucket: `transaction-documents`.
- Bucket is private. There are no persistent public URLs.
- Allowed MIME types: PDF, JPEG, PNG, WEBP.
- Maximum object size: 10 MiB.
- Merchants may prepare/upload documents only when they are active owner, manager, or cashier for the transaction business.
- Customers can read a document only when it is linked to a transaction they can already access through their claimed customer identity.
- `anon` cannot call document RPCs or read/upload private objects.

## Prepare → Upload → Visible

1. The authenticated client calls `app_prepare_transaction_document` with transaction id and bounded file metadata.
2. PostgreSQL verifies actor, business role, transaction status, MIME type, and size.
3. PostgreSQL generates the canonical object path; the client does not choose a business/transaction path.
4. A document row and transaction link are created and audited.
5. Storage RLS permits upload only to that exact prepared path by the same authenticated uploader.
6. `app_list_transaction_documents` joins `storage.objects`; a prepared row is not visible in the application until the object actually exists.
7. Reads use authenticated Storage access or a short-lived signed URL. Mobile currently creates a 60-second signed URL only when the user taps Open.

Canonical object path:

`businesses/{business_id}/transactions/{transaction_id}/{random_uuid}.{server_selected_extension}`

## Integrity boundaries

- Attachments are explanatory evidence, never financial truth.
- Posted/reversed ledger history remains immutable.
- No client receives direct INSERT/UPDATE/DELETE privileges on `public.documents` or `public.transaction_documents`.
- Storage object names must match a prepared database record.
- A customer cannot enumerate or read another customer's transaction documents through the application RPC or Storage policy.
- Failed uploads may leave prepared metadata for later cleanup, but they remain invisible because listing requires a matching Storage object.

## Mobile flow

Merchant statement → transaction → **المستندات** → **إرفاق مستند** → system picker → prepare RPC → private upload.

Customer statement → transaction → **المستندات** → read-only list → **فتح** → 60-second signed URL.

Preview auth mode intentionally cannot access this flow because it does not create a real authenticated Supabase session.
