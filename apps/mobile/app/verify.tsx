import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import { useAuth } from '../src/features/auth/auth-context';
import {
  resendPhoneOtp,
  verifyPhoneOtpAndCompleteProfile,
} from '../src/features/auth/auth-service';
import {
  AppScreen,
  BrandMark,
  ErrorMessage,
  Heading,
  PrimaryButton,
} from '../src/ui/primitives';
import { theme } from '../src/ui/theme';

function param(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return 'تعذر التحقق من الرمز. تأكد منه وحاول مرة أخرى.';
}

export default function VerifyScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ inviteToken?: string }>();
  const inviteToken = param(params.inviteToken).toLowerCase();
  const { pendingOnboarding, session } = useAuth();
  const [token, setToken] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [seconds, setSeconds] = useState(60);

  useEffect(() => {
    if (seconds <= 0) return;
    const timer = setTimeout(() => setSeconds((value) => value - 1), 1000);
    return () => clearTimeout(timer);
  }, [seconds]);

  if (!pendingOnboarding) {
    if (session && inviteToken && /^[0-9a-f]{48}$/.test(inviteToken)) {
      return <Redirect href={{ pathname: '/invite/[token]', params: { token: inviteToken } }} />;
    }
    return <Redirect href={session ? '/home' : '/sign-in'} />;
  }

  const verify = () => {
    if (loading) return;
    setError(null);
    setLoading(true);
    void verifyPhoneOtpAndCompleteProfile(pendingOnboarding, token)
      .then(() => {
        if (inviteToken && /^[0-9a-f]{48}$/.test(inviteToken)) {
          router.replace({ pathname: '/invite/[token]', params: { token: inviteToken } });
        } else {
          router.replace('/home');
        }
      })
      .catch((verifyError: unknown) => setError(errorMessage(verifyError)))
      .finally(() => setLoading(false));
  };

  const resend = () => {
    if (seconds > 0 || resendLoading) return;
    setError(null);
    setResendLoading(true);
    void resendPhoneOtp(pendingOnboarding.phoneE164)
      .then(() => setSeconds(60))
      .catch((resendError: unknown) => setError(errorMessage(resendError)))
      .finally(() => setResendLoading(false));
  };

  return (
    <AppScreen>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}
      >
        <BrandMark />
        <Heading
          title="أدخل رمز التحقق"
          subtitle={`أرسلنا رمزًا من 6 أرقام إلى ${pendingOnboarding.phoneE164}`}
        />

        <TextInput
          autoFocus
          keyboardType="number-pad"
          maxLength={6}
          onChangeText={(value) => setToken(value.replace(/\D/g, '').slice(0, 6))}
          placeholder="000000"
          placeholderTextColor={theme.colors.textMuted}
          returnKeyType="done"
          style={styles.otpInput}
          textAlign="center"
          value={token}
        />

        <ErrorMessage message={error} />
        <PrimaryButton disabled={token.length !== 6} loading={loading} onPress={verify}>
          تأكيد والدخول
        </PrimaryButton>

        <View style={styles.resendRow}>
          <Pressable disabled={seconds > 0 || resendLoading} onPress={resend}>
            <Text style={[styles.resend, seconds > 0 ? styles.resendDisabled : null]}>
              {resendLoading
                ? 'جارٍ إعادة الإرسال...'
                : seconds > 0
                  ? `إعادة الإرسال بعد ${seconds}s`
                  : 'إعادة إرسال الرمز'}
            </Text>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  otpInput: {
    height: 72,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.md,
    backgroundColor: theme.colors.surface,
    color: theme.colors.text,
    fontSize: 30,
    fontWeight: '700',
    letterSpacing: 12,
    writingDirection: 'ltr',
    marginBottom: theme.spacing.sm,
  },
  resendRow: { alignItems: 'center', marginTop: theme.spacing.lg },
  resend: { color: theme.colors.primary, fontSize: theme.typography.caption, fontWeight: '700', writingDirection: 'rtl' },
  resendDisabled: { color: theme.colors.textMuted },
});
