import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { useAuth } from '../../../../src/features/auth/auth-context';
import { ibex } from '../../../../src/lib/ibex';
import { AppScreen, ErrorMessage, Field, Heading, PrimaryButton } from '../../../../src/ui/primitives';
import { theme } from '../../../../src/ui/theme';

function param(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

function message(error: unknown): string {
  return error instanceof Error && error.message ? error.message : 'تعذر إضافة العميل.';
}

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
    void ibex
      .createCustomer(
        {
          businessId,
          displayName,
          ...(phone.trim() ? { phone } : {}),
        },
        `mobile-customer-${Date.now().toString(36)}`,
      )
      .then((customer) => {
        router.replace({
          pathname: '/customer/[businessCustomerId]',
          params: {
            businessCustomerId: customer.businessCustomerId,
            customerIdentityId: customer.customerIdentityId,
            businessId,
            businessName,
            displayName: customer.displayName,
            phone,
          },
        });
      })
      .catch((createError: unknown) => setError(message(createError)))
      .finally(() => setLoading(false));
  };

  return (
    <AppScreen>
      <Pressable onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backText}>رجوع</Text>
      </Pressable>
      <Heading title="إضافة عميل" subtitle={`سيظهر العميل داخل ${businessName} فقط.`} />
      <Field
        autoFocus
        label="اسم العميل"
        onChangeText={setDisplayName}
        placeholder="محمد عبدالله"
        value={displayName}
      />
      <Field
        keyboardType="phone-pad"
        label="رقم الجوال — اختياري"
        onChangeText={setPhone}
        placeholder="0777 123 456"
        value={phone}
      />
      <ErrorMessage message={error} />
      <PrimaryButton disabled={displayName.trim().length < 2} loading={loading} onPress={submit}>
        إضافة العميل
      </PrimaryButton>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  backButton: { alignSelf: 'flex-start', paddingVertical: theme.spacing.sm, marginBottom: theme.spacing.md },
  backText: { color: theme.colors.textMuted, fontWeight: '700', writingDirection: 'rtl' },
});
