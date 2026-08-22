import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../../../../src/features/auth/auth-context';
import { ibex } from '../../../../src/lib/ibex';
import { Button, ErrorState, InlineFeedback, Surface, TextField } from '../../../../src/ui/primitives';
import { SectionHeading, StatusBadge } from '../../../../src/ui/operational-primitives';
import { SecondaryShell } from '../../../../src/ui/secondary-shell';
import { theme } from '../../../../src/ui/theme';

function param(value: string | string[] | undefined): string { return Array.isArray(value) ? (value[0] ?? '') : (value ?? ''); }
function message(error: unknown): string { return error instanceof Error && error.message ? error.message : 'تعذر تحديث طلب المراجعة.'; }

type ReviewStatus = 'open' | 'under_review' | 'resolved' | 'rejected' | 'withdrawn';

function statusCopy(status: string): { label: string; tone: 'info' | 'warning' | 'success' | 'danger' | 'neutral' } {
  if (status === 'open') return { label: 'جديد', tone: 'warning' };
  if (status === 'under_review') return { label: 'قيد المراجعة', tone: 'info' };
  if (status === 'resolved') return { label: 'تمت المعالجة', tone: 'success' };
  if (status === 'rejected') return { label: 'مرفوض', tone: 'danger' };
  return { label: 'مسحوب', tone: 'neutral' };
}

export default function DisputeDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ businessId?: string; disputeId?: string; customerName?: string; status?: string; reason?: string; resolutionNote?: string }>();
  const businessId = param(params.businessId);
  const disputeId = param(params.disputeId);
  const customerName = param(params.customerName) || 'العميل';
  const initialStatus = (param(params.status) || 'open') as ReviewStatus;
  const reason = param(params.reason);
  const { session } = useAuth();
  const [resolutionNote, setResolutionNote] = useState(param(params.resolutionNote));
  const [status, setStatus] = useState<ReviewStatus>(initialStatus);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const statusMeta = useMemo(() => statusCopy(status), [status]);
  const terminal = status === 'resolved' || status === 'rejected' || status === 'withdrawn';

  if (!session) return <Redirect href="/sign-in" />;
  if (!businessId || !disputeId) return <Redirect href="/home" />;

  const update = (nextStatus: 'under_review' | 'resolved' | 'rejected') => {
    if (loading || ((nextStatus === 'resolved' || nextStatus === 'rejected') && resolutionNote.trim().length < 3)) return;
    setLoading(true);
    setError(null);
    void ibex.updateDispute({ disputeId, status: nextStatus, ...(resolutionNote.trim() ? { resolutionNote: resolutionNote.trim() } : {}) }, `mobile-dispute-update-${Date.now().toString(36)}`)
      .then(() => {
        setStatus(nextStatus);
        setDone(true);
      })
      .catch((updateError: unknown) => setError(message(updateError)))
      .finally(() => setLoading(false));
  };

  return (
    <SecondaryShell title={customerName} subtitle="طلب مراجعة" onBack={() => router.back()}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <View style={styles.statusRow}>
          <SectionHeading title="حالة الطلب" caption="المراجعة لا تعدّل الحركة المالية تلقائيًا." />
          <StatusBadge tone={statusMeta.tone}>{statusMeta.label}</StatusBadge>
        </View>

        <Surface variant="tinted">
          <Text style={styles.reasonLabel}>سبب الطلب</Text>
          <Text style={styles.reason}>{reason || 'لم يكتب العميل سببًا إضافيًا.'}</Text>
        </Surface>

        {done ? <InlineFeedback tone="success">تم حفظ حالة الطلب. ستبقى الحركة الأصلية كما هي ما لم يُنفذ إجراء مالي مستقل ومصرح به.</InlineFeedback> : null}
        {error ? <ErrorState message={error} /> : null}

        {!terminal ? (
          <>
            <TextField
              label="ملاحظة المعالجة"
              multiline
              numberOfLines={5}
              onChangeText={setResolutionNote}
              placeholder="اكتب نتيجة المراجعة أو سبب القرار..."
              style={styles.noteInput}
              textAlignVertical="top"
              value={resolutionNote}
            />

            <View style={styles.actions}>
              {status === 'open' ? (
                <Button loading={loading} onPress={() => update('under_review')}>بدء المراجعة</Button>
              ) : null}
              <Button disabled={loading || resolutionNote.trim().length < 3} onPress={() => update('resolved')} variant={status === 'under_review' ? 'primary' : 'secondary'}>
                اعتماد المعالجة
              </Button>
              <Button disabled={loading || resolutionNote.trim().length < 3} onPress={() => update('rejected')} variant="ghost">
                رفض الطلب
              </Button>
            </View>
          </>
        ) : (
          <Surface variant="outlined">
            <Text style={styles.finalTitle}>الطلب مغلق</Text>
            <Text style={styles.finalBody}>{resolutionNote || 'لا توجد ملاحظة معالجة مسجلة.'}</Text>
          </Surface>
        )}

        <InlineFeedback tone="warning">أي تصحيح مالي يجب أن يمر عبر حركة مستقلة مثل reversal أو adjustment؛ قرار المراجعة وحده لا يغير الرصيد.</InlineFeedback>
      </ScrollView>
    </SecondaryShell>
  );
}

const styles = StyleSheet.create({
  content: { gap: theme.spacing.lg, paddingTop: theme.spacing.lg, paddingBottom: theme.spacing.xl },
  statusRow: { flexDirection: 'row-reverse', alignItems: 'flex-start', justifyContent: 'space-between', gap: theme.spacing.md },
  reasonLabel: { color: theme.colors.textMuted, fontSize: theme.typography.styles.caption.fontSize, lineHeight: theme.typography.styles.caption.lineHeight, textAlign: 'right', writingDirection: 'rtl' },
  reason: { color: theme.colors.text, fontSize: theme.typography.styles.body.fontSize, lineHeight: theme.typography.styles.body.lineHeight, marginTop: theme.spacing.sm, textAlign: 'right', writingDirection: 'rtl' },
  noteInput: { minHeight: 132, paddingTop: theme.spacing.md },
  actions: { gap: theme.spacing.sm },
  finalTitle: { color: theme.colors.text, fontSize: theme.typography.styles.bodyStrong.fontSize, lineHeight: theme.typography.styles.bodyStrong.lineHeight, fontWeight: theme.typography.styles.bodyStrong.fontWeight, textAlign: 'right', writingDirection: 'rtl' },
  finalBody: { color: theme.colors.textMuted, fontSize: theme.typography.styles.body.fontSize, lineHeight: theme.typography.styles.body.lineHeight, marginTop: theme.spacing.sm, textAlign: 'right', writingDirection: 'rtl' },
});
