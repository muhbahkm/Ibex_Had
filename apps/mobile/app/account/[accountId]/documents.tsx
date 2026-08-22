import type { TransactionDocumentRecord } from '../../../../../packages/application/src/ports';
import { Redirect, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../../../src/features/auth/auth-context';
import {
  openTransactionDocument,
  pickAndUploadTransactionDocument,
} from '../../../src/features/documents/document-service';
import { ibex } from '../../../src/lib/ibex';
import { EmptyState, ErrorState, InlineFeedback, LoadingState, Surface, Button } from '../../../src/ui/primitives';
import { SectionHeading, StatusBadge } from '../../../src/ui/operational-primitives';
import { SecondaryShell } from '../../../src/ui/secondary-shell';
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
  return 'FILE';
}

export default function TransactionDocumentsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ accountId?: string; transactionId?: string; mode?: string; movementLabel?: string }>();
  const accountId = param(params.accountId);
  const transactionId = param(params.transactionId);
  const customerMode = param(params.mode) === 'customer';
  const movementLabel = param(params.movementLabel) || 'الحركة';
  const { session, isPreviewMode } = useAuth();
  const [documents, setDocuments] = useState<readonly TransactionDocumentRecord[]>([]);
  const [loading, setLoading] = useState(!isPreviewMode);
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

  const upload = () => {
    if (uploading || isPreviewMode) return;
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
    <SecondaryShell title="المستندات" subtitle={movementLabel} onBack={() => router.back()}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <SectionHeading title="ملفات الحركة" caption="إثباتات وفواتير مرتبطة بهذه الحركة فقط، دون روابط عامة دائمة." />

        {isPreviewMode ? (
          <InlineFeedback tone="info">
            المستندات الحقيقية معطلة في وضع العرض لأن فتحها ورفعها يعتمد على Storage وروابط موقعة. يمكنك متابعة بقية المسار دون مغادرة الشاشة.
          </InlineFeedback>
        ) : null}

        {!customerMode && !isPreviewMode ? (
          <Surface variant="tinted">
            <Text style={styles.uploadTitle}>إضافة إثبات</Text>
            <Text style={styles.uploadHint}>PDF أو JPG أو PNG أو WEBP، بحد أقصى 10 MB.</Text>
            <View style={styles.uploadAction}>
              <Button loading={uploading} onPress={upload}>إرفاق مستند</Button>
            </View>
          </Surface>
        ) : null}

        {error ? <ErrorState message={error} onRetry={() => setRefreshKey((value) => value + 1)} retryLabel="إعادة المحاولة" /> : null}
        {loading ? <LoadingState label="جارٍ تحميل المستندات" /> : null}

        {!loading && !error && documents.length > 0 ? (
          <View style={styles.list}>
            {documents.map((document) => (
              <Surface key={document.documentId} variant="outlined">
                <View style={styles.documentRow}>
                  <View style={styles.documentInfo}>
                    <View style={styles.fileHeader}>
                      <Text style={styles.fileName} numberOfLines={2}>{document.fileName}</Text>
                      <StatusBadge tone="info">{typeLabel(document.mimeType)}</StatusBadge>
                    </View>
                    <Text style={styles.metadata}>
                      {formatFileSize(document.sizeBytes)} · {new Date(document.createdAt).toLocaleDateString('en-GB')}
                    </Text>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    disabled={openingId !== null}
                    onPress={() => open(document)}
                    style={({ pressed }) => [styles.openButton, pressed ? styles.pressed : null]}
                  >
                    <Text style={styles.openText}>{openingId === document.documentId ? '...' : 'فتح'}</Text>
                  </Pressable>
                </View>
              </Surface>
            ))}
          </View>
        ) : null}

        {!loading && !error && documents.length === 0 ? (
          <EmptyState
            title={isPreviewMode ? 'المستندات غير متاحة في العرض' : 'لا توجد مستندات'}
            message={customerMode ? 'لم يرفق النشاط مستندًا بهذه الحركة حتى الآن.' : 'يمكن إضافة فاتورة أو صورة إثبات عند العمل في البيئة المتصلة.'}
          />
        ) : null}

        <InlineFeedback tone="success">المستندات الخاصة تُفتح عبر روابط مؤقتة موقعة، ولا تتحول إلى ملفات عامة.</InlineFeedback>
      </ScrollView>
    </SecondaryShell>
  );
}

const styles = StyleSheet.create({
  content: { gap: theme.spacing.lg, paddingTop: theme.spacing.lg, paddingBottom: theme.spacing.xl },
  uploadTitle: { color: theme.colors.text, fontSize: theme.typography.styles.bodyStrong.fontSize, lineHeight: theme.typography.styles.bodyStrong.lineHeight, fontWeight: theme.typography.styles.bodyStrong.fontWeight, textAlign: 'right', writingDirection: 'rtl' },
  uploadHint: { color: theme.colors.textMuted, fontSize: theme.typography.styles.caption.fontSize, lineHeight: theme.typography.styles.caption.lineHeight, marginTop: theme.spacing.xs, textAlign: 'right', writingDirection: 'rtl' },
  uploadAction: { marginTop: theme.spacing.md },
  list: { gap: theme.spacing.sm },
  documentRow: { minHeight: 76, flexDirection: 'row-reverse', alignItems: 'center', gap: theme.spacing.md },
  documentInfo: { flex: 1, gap: theme.spacing.xs },
  fileHeader: { flexDirection: 'row-reverse', alignItems: 'center', gap: theme.spacing.sm },
  fileName: { flex: 1, color: theme.colors.text, fontSize: theme.typography.styles.bodyStrong.fontSize, lineHeight: theme.typography.styles.bodyStrong.lineHeight, fontWeight: theme.typography.styles.bodyStrong.fontWeight, textAlign: 'right', writingDirection: 'rtl' },
  metadata: { color: theme.colors.textMuted, fontSize: theme.typography.styles.caption.fontSize, lineHeight: theme.typography.styles.caption.lineHeight, textAlign: 'right', writingDirection: 'ltr' },
  openButton: { minWidth: theme.layout.minTouchTarget, minHeight: theme.layout.minTouchTarget, paddingHorizontal: theme.spacing.md, borderRadius: theme.radius.md, backgroundColor: theme.colors.surfaceMuted, alignItems: 'center', justifyContent: 'center' },
  openText: { color: theme.colors.accent, fontWeight: '800', writingDirection: 'rtl' },
  pressed: { opacity: 0.68 },
});
