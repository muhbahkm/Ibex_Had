import type { TransactionDocumentRecord } from '../../../../../packages/application/src/ports';
import { Redirect, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../../../src/features/auth/auth-context';
import {
  openTransactionDocument,
  pickAndUploadTransactionDocument,
} from '../../../src/features/documents/document-service';
import { ibex } from '../../../src/lib/ibex';
import { AppScreen, ErrorMessage, Heading, PrimaryButton } from '../../../src/ui/primitives';
import { theme } from '../../../src/ui/theme';

function param(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}
function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : 'تعذر تنفيذ عملية المستند.';
}
function formatFileSize(sizeBytes: number): string {
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}
function typeLabel(mimeType: string): string {
  if (mimeType === 'application/pdf') return 'PDF';
  if (mimeType === 'image/jpeg') return 'JPG';
  if (mimeType === 'image/png') return 'PNG';
  if (mimeType === 'image/webp') return 'WEBP';
  return 'ملف';
}

export default function TransactionDocumentsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    accountId?: string;
    transactionId?: string;
    mode?: string;
    movementLabel?: string;
  }>();
  const accountId = param(params.accountId);
  const transactionId = param(params.transactionId);
  const customerMode = param(params.mode) === 'customer';
  const movementLabel = param(params.movementLabel) || 'الحركة';
  const { session, isPreviewMode } = useAuth();
  const [documents, setDocuments] = useState<readonly TransactionDocumentRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useFocusEffect(useCallback(() => {
    if (!transactionId || isPreviewMode) {
      setLoading(false);
      return undefined;
    }
    let active = true;
    setLoading(true);
    setError(null);
    void ibex.listTransactionDocuments({ transactionId })
      .then((rows) => { if (active) setDocuments(rows); })
      .catch((loadError: unknown) => { if (active) setError(errorMessage(loadError)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [transactionId, isPreviewMode, refreshKey]));

  if (!session) return <Redirect href="/sign-in" />;
  if (!accountId || !transactionId) return <Redirect href="/home" />;
  if (isPreviewMode) return <Redirect href="/home" />;

  const upload = () => {
    if (uploading) return;
    setError(null);
    setUploading(true);
    void pickAndUploadTransactionDocument(transactionId)
      .then(() => setRefreshKey((value) => value + 1))
      .catch((uploadError: unknown) => setError(errorMessage(uploadError)))
      .finally(() => setUploading(false));
  };

  const open = (document: TransactionDocumentRecord) => {
    if (openingId) return;
    setError(null);
    setOpeningId(document.documentId);
    void openTransactionDocument(document)
      .catch((openError: unknown) => setError(errorMessage(openError)))
      .finally(() => setOpeningId(null));
  };

  return (
    <AppScreen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>رجوع</Text>
        </Pressable>
        <Heading
          title="المستندات"
          subtitle={`${movementLabel} · الملفات المرتبطة بهذه الحركة فقط.`}
        />

        {!customerMode ? (
          <View style={styles.uploadSection}>
            <PrimaryButton loading={uploading} onPress={upload}>إرفاق مستند</PrimaryButton>
            <Text style={styles.uploadHint}>PDF أو JPG أو PNG أو WEBP، بحد أقصى 10 MB.</Text>
          </View>
        ) : null}

        <ErrorMessage message={error} />
        {loading ? <ActivityIndicator color={theme.colors.primary} style={styles.loader} /> : null}

        <View style={styles.list}>
          {documents.map((document) => (
            <View key={document.documentId} style={styles.documentCard}>
              <View style={styles.documentInfo}>
                <Text style={styles.fileName} numberOfLines={2}>{document.fileName}</Text>
                <Text style={styles.metadata}>
                  {typeLabel(document.mimeType)} · {formatFileSize(document.sizeBytes)} · {new Date(document.createdAt).toLocaleDateString('en-GB')}
                </Text>
              </View>
              <Pressable
                disabled={openingId !== null}
                onPress={() => open(document)}
                style={({ pressed }) => [styles.openButton, pressed ? styles.pressed : null]}
              >
                {openingId === document.documentId
                  ? <ActivityIndicator color={theme.colors.primary} />
                  : <Text style={styles.openText}>فتح</Text>}
              </Pressable>
            </View>
          ))}
        </View>

        {!loading && documents.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>لا توجد مستندات</Text>
            <Text style={styles.emptyText}>
              {customerMode
                ? 'لم يرفق النشاط مستندًا بهذه الحركة حتى الآن.'
                : 'يمكنك إرفاق فاتورة أو صورة إثبات لتظهر للمستخدمين المصرح لهم بالحركة.'}
            </Text>
          </View>
        ) : null}

        <Text style={styles.securityNote}>
          المستندات خاصة. يتم فتحها عبر رابط مؤقت ولا تُنشر برابط عام.
        </Text>
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: theme.spacing.xl },
  backButton: { alignSelf: 'flex-start', paddingVertical: theme.spacing.sm, marginBottom: theme.spacing.md },
  backText: { color: theme.colors.textMuted, fontWeight: '700', writingDirection: 'rtl' },
  uploadSection: { marginBottom: theme.spacing.lg },
  uploadHint: { color: theme.colors.textMuted, fontSize: theme.typography.caption, marginTop: theme.spacing.sm, textAlign: 'right', writingDirection: 'rtl' },
  loader: { marginVertical: theme.spacing.lg },
  list: { gap: theme.spacing.sm },
  documentCard: { minHeight: 86, padding: theme.spacing.lg, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.lg, backgroundColor: theme.colors.surface, flexDirection: 'row-reverse', alignItems: 'center', gap: theme.spacing.md },
  documentInfo: { flex: 1, gap: theme.spacing.xs },
  fileName: { color: theme.colors.text, fontWeight: '700', textAlign: 'right', writingDirection: 'rtl' },
  metadata: { color: theme.colors.textMuted, fontSize: theme.typography.caption, textAlign: 'right', writingDirection: 'ltr' },
  openButton: { minWidth: 68, minHeight: 42, paddingHorizontal: theme.spacing.md, borderRadius: theme.radius.md, backgroundColor: theme.colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  openText: { color: theme.colors.primary, fontWeight: '800', writingDirection: 'rtl' },
  pressed: { opacity: 0.68 },
  emptyCard: { padding: theme.spacing.lg, borderRadius: theme.radius.lg, backgroundColor: theme.colors.surfaceMuted },
  emptyTitle: { color: theme.colors.text, fontWeight: '700', textAlign: 'right', writingDirection: 'rtl' },
  emptyText: { color: theme.colors.textMuted, marginTop: theme.spacing.sm, textAlign: 'right', writingDirection: 'rtl' },
  securityNote: { color: theme.colors.textMuted, fontSize: theme.typography.caption, marginTop: theme.spacing.xl, textAlign: 'right', writingDirection: 'rtl' },
});
