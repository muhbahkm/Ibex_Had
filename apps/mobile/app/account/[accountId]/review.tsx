import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text } from 'react-native';

import { useAuth } from '../../src/features/auth/auth-context';
import { ibex } from '../../src/lib/ibex';
import { AppScreen, ErrorMessage, Field, Heading, PrimaryButton } from '../../src/ui/primitives';
import { theme } from '../../src/ui/theme';

function param(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}
function message(error: unknown): string {
  return error instanceof Error && error.message ? error.message : 'تعذر إرسال طلب المراجعة.';
}

export default function ReviewTransactionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ accountId?: string; transactionId?: string; movementLabel?: string; amount?: string }>();
  const accountId = param(params.accountId);
  const transactionId = param(params.transactionId);
  const movementLabel = param(params.movementLabel) || 'الحركة';
  const amount = param(params.amount);
  const { session } = useAuth();
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [done, setDone] = useState(false);

  if (!session) return <Redirect href="/sign-in" />;
  if (!accountId || !transactionId) return <Redirect href="/home" />;

  const submit = () => {
    if (loading || reason.trim().length < 3) return;
    setLoading(true);
    setError(null);
    void ibex
      .openDispute({ transactionId, reason }, `mobile-dispute-${Date.now().toString(36)}`)
      .then(() => setDone(true))
      .catch((submitError: unknown) => setError(message(submitError)))
      .finally(() => setLoading(false));
  };

  return (
    <AppScreen>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>رجوع</Text>
        </Pressable>
        <Heading
          title={done ? 'تم إرسال طلب المراجعة' : 'طلب مراجعة حركة'}
          subtitle={done ? 'ستبقى الحركة كما هي في السجل المالي حتى يراجعها النشاط ويرد على الطلب.' : `${movementLabel}${amount ? ` · ${amount}` : ''}`}
        />

        {done ? (
          <PrimaryButton onPress={() => router.back()}>العودة إلى كشف الحساب</PrimaryButton>
        ) : (
          <>
            <Field
              label="سبب طلب المراجعة"
              multiline
              numberOfLines={5}
              onChangeText={setReason}
              placeholder="اكتب باختصار ما الذي تعتقد أنه يحتاج إلى مراجعة..."
              style={styles.reasonInput}
              textAlignVertical="top"
              value={reason}
            />
            <Text style={styles.note}>طلب المراجعة لا يحذف الحركة ولا يغيّر الرصيد تلقائيًا.</Text>
            <ErrorMessage message={error} />
            <PrimaryButton disabled={reason.trim().length < 3} loading={loading} onPress={submit}>
              إرسال طلب المراجعة
            </PrimaryButton>
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
  reasonInput: { minHeight: 130, paddingTop: theme.spacing.md },
  note: { color: theme.colors.textMuted, fontSize: theme.typography.caption, lineHeight: 21, textAlign: 'right', writingDirection: 'rtl', marginBottom: theme.spacing.md },
});
