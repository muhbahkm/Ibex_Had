import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../../../src/features/auth/auth-context';
import { ibex } from '../../../src/lib/ibex';
import { AppScreen, ErrorMessage, Field, Heading, PrimaryButton } from '../../../src/ui/primitives';
import { theme } from '../../../src/ui/theme';

function param(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

function message(error: unknown): string {
  return error instanceof Error && error.message ? error.message : 'تعذر عكس الحركة.';
}

export default function ReverseTransactionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    accountId?: string;
    transactionId?: string;
    movementLabel?: string;
    amount?: string;
  }>();
  const accountId = param(params.accountId);
  const transactionId = param(params.transactionId);
  const movementLabel = param(params.movementLabel) || 'الحركة';
  const amount = param(params.amount);
  const { session } = useAuth();
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [idempotencyKey] = useState(
    () => `mobile-reversal-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
  );

  if (!session) return <Redirect href="/sign-in" />;
  if (!accountId || !transactionId) return <Redirect href="/home" />;

  const submit = () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    void ibex
      .reverseTransaction(
        {
          transactionId,
          idempotencyKey,
          ...(reason.trim() ? { reason: reason.trim() } : {}),
        },
        `mobile-reversal-request-${Date.now().toString(36)}`,
      )
      .then(() => router.back())
      .catch((reverseError: unknown) => setError(message(reverseError)))
      .finally(() => setLoading(false));
  };

  return (
    <AppScreen>
      <Pressable onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backText}>إلغاء</Text>
      </Pressable>
      <Heading title="عكس حركة مالية" subtitle="لن يتم تعديل الحركة الأصلية؛ سيُنشأ قيد عكسي مستقل وقابل للتدقيق." />

      <View style={styles.warningCard}>
        <Text style={styles.warningTitle}>{movementLabel}</Text>
        {amount ? <Text style={styles.amount}>{amount}</Text> : null}
        <Text style={styles.warningBody}>
          بعد الاعتماد ستصبح الحركة الأصلية معلمة كمعكوسة، ويُنشأ Reversal يساوي أثرها المالي بالعكس تمامًا.
        </Text>
      </View>

      <Field
        label="سبب العكس — اختياري"
        onChangeText={setReason}
        placeholder="مثال: تم تسجيل المبلغ بالخطأ"
        value={reason}
      />
      <ErrorMessage message={error} />
      <PrimaryButton loading={loading} onPress={submit}>تأكيد إنشاء القيد العكسي</PrimaryButton>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  backButton: { alignSelf: 'flex-start', paddingVertical: theme.spacing.sm, marginBottom: theme.spacing.md },
  backText: { color: theme.colors.textMuted, fontWeight: '700', writingDirection: 'rtl' },
  warningCard: { padding: theme.spacing.lg, backgroundColor: theme.colors.surfaceMuted, borderRadius: theme.radius.lg, marginBottom: theme.spacing.lg },
  warningTitle: { color: theme.colors.text, fontSize: theme.typography.heading, fontWeight: '800', textAlign: 'right', writingDirection: 'rtl' },
  amount: { color: theme.colors.text, fontSize: 26, fontWeight: '800', marginTop: theme.spacing.sm, textAlign: 'right', writingDirection: 'ltr' },
  warningBody: { color: theme.colors.textMuted, lineHeight: 25, marginTop: theme.spacing.md, textAlign: 'right', writingDirection: 'rtl' },
});
