import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { useAuth } from '../../../src/features/auth/auth-context';
import { ibex } from '../../../src/lib/ibex';
import { Button, InlineFeedback, Surface, TextField } from '../../../src/ui/primitives';
import { SecondaryShell } from '../../../src/ui/secondary-shell';
import { theme } from '../../../src/ui/theme';

function param(value: string | string[] | undefined): string { return Array.isArray(value) ? (value[0] ?? '') : (value ?? ''); }
function message(error: unknown): string { return error instanceof Error && error.message ? error.message : 'تعذر عكس الحركة.'; }

export default function ReverseTransactionScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ accountId?: string; transactionId?: string; movementLabel?: string; amount?: string }>();
  const accountId = param(params.accountId);
  const transactionId = param(params.transactionId);
  const movementLabel = param(params.movementLabel) || 'الحركة';
  const amount = param(params.amount);
  const { session } = useAuth();
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [idempotencyKey] = useState(() => `mobile-reversal-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);

  if (!session) return <Redirect href="/sign-in" />;
  if (!accountId || !transactionId) return <Redirect href="/home" />;

  const submit = () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    void ibex.reverseTransaction({ transactionId, idempotencyKey, ...(reason.trim() ? { reason: reason.trim() } : {}) }, `mobile-reversal-request-${Date.now().toString(36)}`)
      .then(() => router.back())
      .catch((reverseError: unknown) => setError(message(reverseError)))
      .finally(() => setLoading(false));
  };

  return (
    <SecondaryShell title="عكس حركة مالية" subtitle="تصحيح قابل للتدقيق" onBack={() => router.back()} backLabel="إلغاء">
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Surface variant="tinted">
          <Text style={styles.warningTitle}>{movementLabel}</Text>
          {amount ? <Text style={styles.amount}>{amount}</Text> : null}
          <Text style={styles.warningBody}>لن يتم تعديل أو حذف الحركة الأصلية. سيُنشأ قيد عكسي مستقل يساوي أثرها المالي بالعكس، وتبقى السلسلة كاملة في سجل التدقيق.</Text>
        </Surface>
        <InlineFeedback tone="warning">هذا إجراء مالي تصحيحي. استخدمه فقط عندما تكون الحركة الأصلية صحيحة من حيث الهوية لكنها تحتاج إلى إلغاء أثرها.</InlineFeedback>
        <TextField label="سبب العكس — اختياري" onChangeText={setReason} placeholder="مثال: تم تسجيل المبلغ بالخطأ" value={reason} />
        {error ? <InlineFeedback tone="danger">{error}</InlineFeedback> : null}
        <Button loading={loading} onPress={submit}>إنشاء القيد العكسي</Button>
      </ScrollView>
    </SecondaryShell>
  );
}

const styles = StyleSheet.create({
  content: { gap: theme.spacing.lg, paddingTop: theme.spacing.lg, paddingBottom: theme.spacing.xl },
  warningTitle: { color: theme.colors.text, fontSize: theme.typography.styles.heading.fontSize, fontWeight: '800', textAlign: 'right', writingDirection: 'rtl' },
  amount: { color: theme.colors.text, fontSize: theme.typography.styles.display.fontSize, lineHeight: theme.typography.styles.display.lineHeight, fontWeight: '800', marginTop: theme.spacing.sm, textAlign: 'right', writingDirection: 'ltr' },
  warningBody: { color: theme.colors.textMuted, lineHeight: 25, marginTop: theme.spacing.md, textAlign: 'right', writingDirection: 'rtl' },
});
