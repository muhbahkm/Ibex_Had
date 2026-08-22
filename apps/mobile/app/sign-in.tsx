import { Redirect, useRouter } from 'expo-router';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAuth } from '../src/features/auth/auth-context';
import { requestPhoneOtp } from '../src/features/auth/auth-service';
import {
  AppScreen,
  BrandMark,
  ErrorMessage,
  Field,
  Heading,
  PrimaryButton,
} from '../src/ui/primitives';
import { theme } from '../src/ui/theme';

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return 'تعذر إرسال رمز التحقق. حاول مرة أخرى.';
}

export default function SignInScreen() {
  const router = useRouter();
  const { session, setPendingOnboarding } = useAuth();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (session) return <Redirect href="/home" />;

  const submit = () => {
    if (loading) return;
    setError(null);
    setLoading(true);
    void requestPhoneOtp({ fullName, phone })
      .then((pending) => {
        setPendingOnboarding(pending);
        router.push('/verify');
      })
      .catch((requestError: unknown) => setError(errorMessage(requestError)))
      .finally(() => setLoading(false));
  };

  return (
    <AppScreen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <BrandMark />
          <Heading
            title="دفترك معك، بوضوح."
            subtitle="أدخل اسمك ورقم جوالك. سنرسل رمز تحقق واحد لتأمين حسابك وربط دفاترك بك."
          />

          <View style={styles.form}>
            <Field
              autoCapitalize="words"
              autoComplete="name"
              label="الاسم"
              onChangeText={setFullName}
              placeholder="مثال: محمد باحكم"
              returnKeyType="next"
              value={fullName}
            />
            <Field
              autoComplete="tel"
              keyboardType="phone-pad"
              label="رقم الجوال"
              onChangeText={setPhone}
              placeholder="777123456 أو +967777123456"
              returnKeyType="done"
              value={phone}
            />
            <ErrorMessage message={error} />
            <PrimaryButton
              disabled={fullName.trim().length < 2 || phone.trim().length < 8}
              loading={loading}
              onPress={submit}
            >
              إرسال رمز التحقق
            </PrimaryButton>
          </View>

          <Text style={styles.privacy}>
            لا نستخدم رقم الجوال كمفتاح مالي. هويتك الداخلية دائمة ويمكن تغيير الرقم لاحقًا
            عبر مسار تحقق آمن.
          </Text>
        </ScrollView>
      </KeyboardAvoidingView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: {
    flexGrow: 1,
    paddingBottom: theme.spacing.xl,
  },
  form: {
    marginTop: theme.spacing.sm,
  },
  privacy: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.caption,
    lineHeight: 21,
    textAlign: 'right',
    writingDirection: 'rtl',
    marginTop: 'auto',
    paddingTop: theme.spacing.xl,
  },
});
