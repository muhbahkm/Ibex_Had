import type { TransactionDocumentRecord } from '../../../packages/application/src/ports';

import { ibex } from './ibex';
import { createClient } from './supabase/client';

const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'] as const;
type AllowedType = (typeof ALLOWED_TYPES)[number];

function isAllowedType(value: string): value is AllowedType {
  return ALLOWED_TYPES.includes(value as AllowedType);
}

export async function uploadTransactionDocument(transactionId: string, file: File): Promise<void> {
  const mimeType = file.type.toLowerCase();
  if (!isAllowedType(mimeType)) {
    throw new Error('نوع الملف غير مدعوم. استخدم PDF أو JPG أو PNG أو WEBP.');
  }
  if (!Number.isSafeInteger(file.size) || file.size < 1 || file.size > 10 * 1024 * 1024) {
    throw new Error('حجم المستند يجب ألا يتجاوز 10 MB.');
  }

  const prepared = await ibex.prepareTransactionDocument({
    transactionId,
    fileName: file.name,
    mimeType,
    sizeBytes: file.size,
  });

  const supabase = createClient();
  const { error } = await supabase.storage
    .from(prepared.storageBucket)
    .upload(prepared.storagePath, file, {
      contentType: prepared.mimeType,
      upsert: false,
    });

  if (error) throw error;
}

export async function createTransactionDocumentUrl(document: TransactionDocumentRecord): Promise<string> {
  const supabase = createClient();
  const { data, error } = await supabase.storage
    .from(document.storageBucket)
    .createSignedUrl(document.storagePath, 60);

  if (error) throw error;
  if (!data.signedUrl) throw new Error('تعذر إنشاء رابط آمن للمستند.');
  return data.signedUrl;
}
