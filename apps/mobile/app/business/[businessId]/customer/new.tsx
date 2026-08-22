import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';

import { useAuth } from '../../../../src/features/auth/auth-context';
import { ibex } from '../../../../src/lib/ibex';
import { Button, InlineFeedback, Surface, TextField } from '../../../../src/ui/primitives';
import { SecondaryShell } from '../../../../src/ui/secondary-shell';
import { theme } from '../../../../src/ui/theme';

function param(value: string | string[] | undefined): string { return Array.isArray(value) ? (value[0] ?? '') : (value ?? ''); }
function message(error: unknown): string { return error instanceof Error && error.message ? error.message : 'تعذر إضافة العميل.'; }

export default function CreateCustomerScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ businessId?: string; businessName?: string }>();
  const businessId = param(params.businessId);
  const businessName = param(params.businessName) || 'النشاط';
  const { session } = useAuth();
  const [displayName, setDisplayName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!session) return <Redirect href="/sign-in" />;
  if (!businessId) return <Redirect href="/home" />;

  const submit = () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    void ibex.createCustomer({ businessId, displayName, ...(phone.trim() ? { phone } : {}) }, `mobile-customer-${Date.now().toString(36)}`)
      .then((customer) => router.replace({ pathname: '/customer/[businessCustomerId]', params: { businessCustomerId: customer.businessCustomerId, customerIdentityId: customer.customerIdentityId, businessId, businessName, displayName: customer.displayName, phone } }))
      .catch((createError: unknown) => setError(message(createError)))
      .finally(() => setLoading(false));
  };

  return (
    <SecondaryShell title="إضافة عميل" subtitle={businessName} onBack={() => router.back()} backLabel="إلغاء">
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Surface variant="tinted">
          <Text style={styles.noteTitle}>هوية العميل داخل النشاط</Text>
          <Text style={styles.noteBody}>الاسم مطلوب. رقم الجوال اختياري الآن، ولا يعني إدخاله أنه أصبح موثّقًا؛ ربط الهوية بالمستخدم سيتم لاحقًا عبر مسار تحقق مستقل.</Text>
        </Surface>
        <TextField autoFocus label="اسم العميل" onChangeText={setDisplayName} placeholder="محمد عبدالله" value={displayName} />
        <TextField keyboardType="phone-pad" label="رقم الجوال — اختياري" onChangeText={setPhone} placeholder="777123456" value={phone} />
        {error ? <InlineFeedback tone="danger">{error}</InlineFeedback> : null}
        <Button disabled={displayName.trim().length < 2} loading={loading} onPress={submit}>إضافة العميل</Button>
      </ScrollView>
    </SecondaryShell>
  );
}

const styles = StyleSheet.create({
  content: { gap: theme.spacing.lg, paddingTop: theme.spacing.lg, paddingBottom: theme.spacing.xl },
  noteTitle: { color: theme.colors.accent, fontSize: theme.typography.styles.label.fontSize, fontWeight: '700', textAlign: 'right', writingDirection: 'rtl' },
  noteBody: { color: theme.colors.textMuted, lineHeight: 24, marginTop: theme.spacing.xs, textAlign: 'right', writingDirection: 'rtl' },
});
