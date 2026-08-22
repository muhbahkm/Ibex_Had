import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../../src/features/auth/auth-context';
import { ibex } from '../../src/lib/ibex';
import {
  AppScreen,
  ErrorMessage,
  Field,
  Heading,
  PrimaryButton,
} from '../../src/ui/primitives';
import { theme } from '../../src/ui/theme';

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return 'تعذر إنشاء النشاط. حاول مرة أخرى.';
}

export default function CreateBusinessScreen() {
  const router = useRouter();
  const { session } = useAuth();
  const [name, setName] = useState('');
  const [currencyCode, setCurrencyCode] = useState('YER');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdName, setCreatedName] = useState<string | null>(null);

  if (!session) return <Redirect href="/sign-in" />;

  const submit = () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    void ibex
      .createBusiness(
        {
          name,
          countryCode: 'YE',
          defaultCurrencyCode: currencyCode,
        },
        `mobile-business-${Date.now().toString(36)}`,
      )
      .then((business) => setCreatedName(business.name))
      .catch((createError: unknown) => setError(errorMessage(createError)))
      .finally(() => setLoading(false));
  };

  if (createdName) {
    return (
      <AppScreen>
        <View style={styles.successCard}>
          <View style={styles.successMark}>
            <Text style={styles.successMarkText}>✓</Text>
          </View>
          <Heading
            title="تم إنشاء النشاط"
            subtitle={`أصبح ${createdName} جاهزًا لإضافة العملاء والحسابات.`}
          />
          <PrimaryButton onPress={() => router.replace('/home')}>العودة لمساحة العمل</PrimaryButton>
        </View>
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <Pressable onPress={() => router.back()} style={styles.backButton}>
        <Text style={styles.backText}>رجوع</Text>
      </Pressable>

      <Heading
        title="نشاطك التجاري"
        subtitle="هذه الخطوة تنشئ مساحة مستقلة بحدود صلاحيات ودفاتر منفصلة."
      />

      <Field
        autoFocus
        label="اسم النشاط"
        onChangeText={setName}
        placeholder="مثال: باحكم للعسل"
        value={name}
      />
      <Field
        autoCapitalize="characters"
        label="العملة الافتراضية"
        maxLength={3}
        onChangeText={(value) => setCurrencyCode(value.toUpperCase())}
        placeholder="YER"
        value={currencyCode}
      />

      <ErrorMessage message={error} />
      <PrimaryButton
        disabled={name.trim().length < 2 || currencyCode.trim().length !== 3}
        loading={loading}
        onPress={submit}
      >
        إنشاء النشاط
      </PrimaryButton>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  backButton: {
    alignSelf: 'flex-start',
    paddingVertical: theme.spacing.sm,
    marginBottom: theme.spacing.lg,
  },
  backText: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.caption,
    fontWeight: '700',
    writingDirection: 'rtl',
  },
  successCard: {
    flex: 1,
    justifyContent: 'center',
  },
  successMark: {
    width: 64,
    height: 64,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'flex-end',
    marginBottom: theme.spacing.lg,
  },
  successMarkText: {
    color: theme.colors.primaryText,
    fontSize: 30,
    fontWeight: '700',
  },
});
