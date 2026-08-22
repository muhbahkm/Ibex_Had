import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { useAuth } from '../../../src/features/auth/auth-context';
import { ibex } from '../../../src/lib/ibex';
import { majorUnitsToMinor } from '../../../src/lib/money-display';
import { Button, InlineFeedback, Surface, TextField } from '../../../src/ui/primitives';
import { SecondaryShell } from '../../../src/ui/secondary-shell';
import { theme } from '../../../src/ui/theme';

function param(value: string | string[] | undefined): string { return Array.isArray(value) ? (value[0] ?? '') : (value ?? ''); }
function message(error: unknown): string { return error instanceof Error && error.message ? error.message : 'تعذر تسجيل الحركة.'; }

export default function MovementScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ accountId?: string; businessId?: string; customerIdentityId?: string; displayName?: string; currencyCode?: string; kind?: string }>();
  const accountId = param(params.accountId);
  const businessId = param(params.businessId);
  const customerIdentityId = param(params.customerIdentityId);
  const displayName = param(params.displayName) || 'العميل';
  const currencyCode = param(params.currencyCode);
  const kind = param(params.kind) === 'receipt' ? 'receipt' : 'sale';
  const { session } = useAuth();
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [idempotencyKey] = useState(() => `mobile-${kind}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`);

  if (!session) return <Redirect href="/sign-in" />;
  if (!accountId || !businessId || !customerIdentityId || !currencyCode) return <Redirect href="/home" />;

  const submit = () => {
    if (loading) return;
    setError(null);
    let amountMinor: string;
    try { amountMinor = majorUnitsToMinor(amount, currencyCode); }
    catch (validationError) { setError(message(validationError)); return; }

    setLoading(true);
    const input = { businessId, customerIdentityId, accountId, amountMinor, currencyCode, idempotencyKey, ...(description.trim() ? { description: description.trim() } : {}) };
    const command = kind === 'receipt' ? ibex.postReceipt(input) : ibex.postSale(input);
    void command.then(() => router.back()).catch((postError: unknown) => setError(message(postError))).finally(() => setLoading(false));
  };

  const isReceipt = kind === 'receipt';
  return (
    <SecondaryShell title={isReceipt ? 'تسجيل قبض' : 'بيع آجل'} subtitle={`${displayName} · ${currencyCode}`} onBack={() => router.back()} backLabel="إلغاء">
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Surface variant="tinted">
          <Text style={styles.explainTitle}>{isReceipt ? 'أثر العملية' : 'أثر العملية'}</Text>
          <Text style={styles.explainBody}>{isReceipt ? 'سيخفض القبض رصيد العميل بالقيمة المدخلة بعد اعتماد الأمر من طبقة التطبيق.' : 'سيزيد البيع الآجل رصيد العميل بالقيمة المدخلة بعد اعتماد الأمر من طبقة التطبيق.'}</Text>
        </Surface>

        <TextField autoFocus keyboardType="decimal-pad" label={`المبلغ (${currencyCode})`} onChangeText={setAmount} placeholder={currencyCode === 'YER' ? '50000' : '500.00'} value={amount} />
        <TextField label="البيان — اختياري" onChangeText={setDescription} placeholder={isReceipt ? 'دفعة نقدية' : 'فاتورة مبيعات'} value={description} />
        {error ? <InlineFeedback tone="danger">{error}</InlineFeedback> : null}
        <Button disabled={!amount.trim()} loading={loading} onPress={submit}>{isReceipt ? 'اعتماد القبض' : 'اعتماد البيع الآجل'}</Button>
        <Text style={styles.auditNote}>لا تعدّل هذه الشاشة Ledger مباشرة؛ الاعتماد يمر عبر Application/Domain command نفسه المستخدم في بقية القنوات.</Text>
      </ScrollView>
    </SecondaryShell>
  );
}

const styles = StyleSheet.create({
  content: { gap: theme.spacing.lg, paddingTop: theme.spacing.lg, paddingBottom: theme.spacing.xl },
  explainTitle: { color: theme.colors.accent, fontSize: theme.typography.styles.label.fontSize, fontWeight: '700', textAlign: 'right', writingDirection: 'rtl' },
  explainBody: { color: theme.colors.textMuted, lineHeight: 24, marginTop: theme.spacing.xs, textAlign: 'right', writingDirection: 'rtl' },
  auditNote: { color: theme.colors.textSubtle, fontSize: theme.typography.caption, lineHeight: 20, textAlign: 'right', writingDirection: 'rtl' },
});
