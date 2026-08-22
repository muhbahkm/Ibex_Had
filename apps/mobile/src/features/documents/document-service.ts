import type { TransactionDocumentRecord } from '../../../../../packages/application/src/ports';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import * as Linking from 'expo-linking';

import { ibex } from '../../lib/ibex';
import { supabase } from '../../lib/supabase';

const ALLOWED_TYPES = ['application/pdf', 'image/jpeg', 'image/png', 'image/webp'] as const;
type AllowedType = (typeof ALLOWED_TYPES)[number];

function isAllowedType(value: string): value is AllowedType {
  return ALLOWED_TYPES.includes(value as AllowedType);
}

export async function pickAndUploadTransactionDocument(transactionId: string): Promise<void> {
  const result = await DocumentPicker.getDocumentAsync({
    type: [...ALLOWED_TYPES],
    copyToCacheDirectory: true,
    multiple: false,
  });

  if (result.canceled) return;
  const asset = result.assets[0];
  if (!asset) throw new Error('لم يتم العثور على الملف المختار.');

  const file = new File(asset.uri);
  const mimeType = asset.mimeType?.toLowerCase() ?? file.type.toLowerCase();
  const sizeBytes = asset.size ?? file.size;

  if (!isAllowedType(mimeType)) {
    throw new Error('نوع الملف غير مدعوم. استخدم PDF أو JPG أو PNG أو WEBP.');
  }
  if (!Number.isSafeInteger(sizeBytes) || sizeBytes < 1 || sizeBytes > 10 * 1024 * 1024) {
    throw new Error('حجم المستند يجب ألا يتجاوز 10 MB.');
  }

  const prepared = await ibex.prepareTransactionDocument({
    transactionId,
    fileName: asset.name,
    mimeType,
    sizeBytes,
  });

  const bytes = await file.arrayBuffer();
  const { error } = await supabase.storage
    .from(prepared.storageBucket)
    .upload(prepared.storagePath, bytes, {
      contentType: prepared.mimeType,
      upsert: false,
    });

  if (error) throw error;
}

export async function openTransactionDocument(document: TransactionDocumentRecord): Promise<void> {
  const { data, error } = await supabase.storage
    .from(document.storageBucket)
    .createSignedUrl(document.storagePath, 60);

  if (error) throw error;
  if (!data.signedUrl) throw new Error('تعذر إنشاء رابط آمن للمستند.');

  const supported = await Linking.canOpenURL(data.signedUrl);
  if (!supported) throw new Error('لا يوجد تطبيق متاح لفتح هذا المستند.');
  await Linking.openURL(data.signedUrl);
}
