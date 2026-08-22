import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { useAuth } from '../../../src/features/auth/auth-context';
import { ibex } from '../../../src/lib/ibex';
import { Button, InlineFeedback, Surface, TextField } from '../../../src/ui/primitives';
import { SecondaryShell } from '../../../src/ui/secondary-shell';
import { theme } from '../../../src/ui/theme';

function param(value: string | string[] | undefined): string { return Array.isArray(value) ? (value[0] ?? '') : (value ?? ''); }
function message(error: unknown): string { return error instanceof Error && error.message ? error.message : 'تعذر إرسال طلب المراجعة.'; }

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
    void ibex.openDispute({ transactionId, reason }, `mobile-dispute-${Date.now().toString(36)}`)
      .then(() => setDone(true))
      .catch((submitError: unknown) => setError(message(submitError)))
      .finally(() => setLoading(false));
  };

  return (
    <SecondaryShell title={done ? 'تم إرسال الطلب' : 'طلب مراجعة حركة'} subtitle={done ? 'بانتظار مراجعة النشاط' : movementLabel} onBack={() => router.back()}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {done ? (
          <>
            <Surface variant="tinted">
              <Text style={styles.successTitle}>تم استلام طلبك</Text>
              <Text style={styles.successBody}>بقيت الحركة والرصيد كما هما. سيستطيع النشاط مراجعة الطلب والرد عليه دون تعديل التاريخ المالي بصمت.</Text>
            </Surface>
            <Button onPress={() => router.back()}>العودة إلى كشف الحساب</Button>
          </>
        ) : (
          <>
            <Surface variant="outlined">
              <Text style={styles.movementTitle}>{movementLabel}</Text>
              {amount ? <Text style={styles.amount}>{amount}</Text> : null}
              <Text style={styles.movementBody}>طلب المراجعة قناة اعتراض مستقلة عن Ledger، ولا يحذف الحركة أو يغيّر الرصيد تلقائيًا.</Text>
            </Surface>
            <TextField label="سبب طلب المراجعة" multiline numberOfLines={5} onChangeText={setReason} placeholder="اكتب باختصار ما الذي يحتاج إلى مراجعة..." style={styles.reasonInput} textAlignVertical="top" value={reason} />
            {error ? <InlineFeedback tone="danger">{error}</InlineFeedback> : null}
            <Button disabled={reason.trim().length < 3} loading={loading} onPress={submit}>إرسال طلب المراجعة</Button>
          </>
        )}
      </ScrollView>
    </SecondaryShell>
  );
}

const styles = StyleSheet.create({
  content: { gap: theme.spacing.lg, paddingTop: theme.spacing.lg, paddingBottom: theme.spacing.xl },
  movementTitle: { color: theme.colors.text, fontSize: theme.typography.styles.heading.fontSize, fontWeight: '800', textAlign: 'right', writingDirection: 'rtl' },
  amount: { color: theme.colors.text, fontSize: theme.typography.styles.title.fontSize, fontWeight: '800', marginTop: theme.spacing.sm, textAlign: 'right', writingDirection: 'ltr' },
  movementBody: { color: theme.colors.textMuted, lineHeight: 24, marginTop: theme.spacing.md, textAlign: 'right', writingDirection: 'rtl' },
  reasonInput: { minHeight: 130, paddingTop: theme.spacing.md },
  successTitle: { color: theme.colors.success, fontSize: theme.typography.styles.heading.fontSize, fontWeight: '800', textAlign: 'right', writingDirection: 'rtl' },
  successBody: { color: theme.colors.textMuted, lineHeight: 24, marginTop: theme.spacing.sm, textAlign: 'right', writingDirection: 'rtl' },
});
