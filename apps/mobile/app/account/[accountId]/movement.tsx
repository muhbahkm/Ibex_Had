import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../../../src/features/auth/auth-context';
import { ibex } from '../../../src/lib/ibex';
import { majorUnitsToMinor } from '../../../src/lib/money-display';
import { AppScreen, ErrorMessage, Field, Heading, PrimaryButton } from '../../../src/ui/primitives';
import { theme } from '../../../src/ui/theme';

function param(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

function message(error: unknown): string {
  return error instanceof Error && error.message ? error.message : 'تعذر تسجيل الحركة.';
}

export default function MovementScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    accountId?: string;
    businessId?: string;
    customerIdentityId?: string;
    displayName?: string;
    currencyCode?: string;
    kind?: string;
  }>();
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
  const [idempotencyKey] = useState(
    () => `mobile-${kind}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`,
  );

  if (!session) return <Redirect href="/sign-in" />;
  if (!accountId || !businessId || !customerIdentityId || !currencyCode) return <Redirect href="/home" />;

  const submit = () => {
    if (loading) return;
    setError(null);
    let amountMinor: string;
    try {
      amountMinor = majorUnitsToMinor(amount, currencyCode);
    } catch (validationError) {
      setError(message(validationError));
      return;
    }

    setLoading(true);
    const input = {
      businessId,
      customerIdentityId,
      accountId,
      amountMinor,
      currencyCode,
      idempotencyKey,
      ...(description.trim() ? { description: description.trim() } : {}),
    };
    const command = kind === 'receipt' ? ibex.postReceipt(input) : ibex.postSale(input);
    void command
      .then(() => router.back())
      .catch((postError: unknown) => setError(message(postError)))
      .finally(() => setLoading(false));
  };

  return (
    <AppScreen>
      <Pressable onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backText}>رجوع</Text>
      </Pressable>
      <Heading
        title={kind === 'receipt' ? 'تسجيل قبض' : 'بيع آجل'}
        subtitle={`${displayName} · ${currencyCode}`}
      />

      <View style={styles.kindCard}>
        <Text style={styles.kindText}>
          {kind === 'receipt'
            ? 'سيخفض القبض رصيد العميل بالقيمة المدخلة.'
            : 'سيزيد البيع الآجل رصيد العميل بالقيمة المدخلة.'}
        </Text>
      </View>

      <Field
        autoFocus
        keyboardType="decimal-pad"
        label={`المبلغ (${currencyCode})`}
        onChangeText={setAmount}
        placeholder={currencyCode === 'YER' ? '50000' : '500.00'}
        value={amount}
      />
      <Field
        label="البيان — اختياري"
        onChangeText={setDescription}
        placeholder={kind === 'receipt' ? 'دفعة نقدية' : 'فاتورة مبيعات'}
        value={description}
      />
      <ErrorMessage message={error} />
      <PrimaryButton disabled={!amount.trim()} loading={loading} onPress={submit}>
        {kind === 'receipt' ? 'اعتماد القبض' : 'اعتماد البيع الآجل'}
      </PrimaryButton>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  backButton: { alignSelf: 'flex-start', paddingVertical: theme.spacing.sm, marginBottom: theme.spacing.md },
  backText: { color: theme.colors.textMuted, fontWeight: '700', writingDirection: 'rtl' },
  kindCard: { padding: theme.spacing.lg, backgroundColor: theme.colors.surfaceMuted, borderRadius: theme.radius.lg, marginBottom: theme.spacing.lg },
  kindText: { color: theme.colors.textMuted, lineHeight: 24, textAlign: 'right', writingDirection: 'rtl' },
});
