import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../../../../src/features/auth/auth-context';
import { ibex } from '../../../../src/lib/ibex';
import { AppScreen, ErrorMessage, Field, Heading, PrimaryButton } from '../../../../src/ui/primitives';
import { theme } from '../../../../src/ui/theme';

function param(value: string | string[] | undefined): string { return Array.isArray(value) ? (value[0] ?? '') : (value ?? ''); }
function message(error: unknown): string { return error instanceof Error && error.message ? error.message : 'تعذر تحديث طلب المراجعة.'; }

export default function DisputeDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ businessId?: string; disputeId?: string; customerName?: string; status?: string; reason?: string; resolutionNote?: string }>();
  const businessId = param(params.businessId);
  const disputeId = param(params.disputeId);
  const customerName = param(params.customerName) || 'العميل';
  const initialStatus = param(params.status);
  const reason = param(params.reason);
  const { session } = useAuth();
  const [resolutionNote, setResolutionNote] = useState(param(params.resolutionNote));
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  if (!session) return <Redirect href="/sign-in" />;
  if (!businessId || !disputeId) return <Redirect href="/home" />;

  const update = (status: 'under_review' | 'resolved' | 'rejected') => {
    if (loading || ((status === 'resolved' || status === 'rejected') && resolutionNote.trim().length < 3)) return;
    setLoading(true);
    setError(null);
    void ibex.updateDispute({ disputeId, status, ...(resolutionNote.trim() ? { resolutionNote } : {}) }, `mobile-dispute-update-${Date.now().toString(36)}`)
      .then(() => setDone(true))
      .catch((updateError: unknown) => setError(message(updateError)))
      .finally(() => setLoading(false));
  };

  return (
    <AppScreen>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()} style={styles.backButton}><Text style={styles.backText}>رجوع</Text></Pressable>
        <Heading title={customerName} subtitle={done ? 'تم تحديث حالة طلب المراجعة.' : `طلب مراجعة · ${initialStatus || 'open'}`} />
        <View style={styles.reasonCard}><Text style={styles.reasonLabel}>سبب الطلب</Text><Text style={styles.reason}>{reason}</Text></View>
        {done ? (
          <PrimaryButton onPress={() => router.back()}>العودة إلى الطلبات</PrimaryButton>
        ) : (
          <>
            <Field label="ملاحظة المعالجة" multiline numberOfLines={5} onChangeText={setResolutionNote} placeholder="اكتب نتيجة المراجعة أو سبب القرار..." style={styles.noteInput} textAlignVertical="top" value={resolutionNote} />
            <ErrorMessage message={error} />
            {initialStatus === 'open' ? <PrimaryButton loading={loading} onPress={() => update('under_review')}>بدء المراجعة</PrimaryButton> : null}
            <View style={styles.actions}>
              <Pressable disabled={loading || resolutionNote.trim().length < 3} onPress={() => update('resolved')} style={styles.action}><Text style={styles.actionText}>تمت المعالجة</Text></Pressable>
              <Pressable disabled={loading || resolutionNote.trim().length < 3} onPress={() => update('rejected')} style={styles.action}><Text style={styles.actionText}>رفض الطلب</Text></Pressable>
            </View>
          </>
        )}
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: theme.spacing.xl },
  backButton: { alignSelf: 'flex-start', paddingVertical: theme.spacing.sm, marginBottom: theme.spacing.md },
  backText: { color: theme.colors.textMuted, fontWeight: '700', writingDirection: 'rtl' },
  reasonCard: { padding: theme.spacing.lg, borderRadius: theme.radius.lg, backgroundColor: theme.colors.surfaceMuted, marginBottom: theme.spacing.lg },
  reasonLabel: { color: theme.colors.textMuted, fontSize: theme.typography.caption, textAlign: 'right', writingDirection: 'rtl' },
  reason: { color: theme.colors.text, marginTop: theme.spacing.sm, lineHeight: 24, textAlign: 'right', writingDirection: 'rtl' },
  noteInput: { minHeight: 130, paddingTop: theme.spacing.md },
  actions: { flexDirection: 'row-reverse', gap: theme.spacing.sm, marginTop: theme.spacing.md },
  action: { flex: 1, minHeight: 52, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center' },
  actionText: { color: theme.colors.text, fontWeight: '700', writingDirection: 'rtl' },
});
