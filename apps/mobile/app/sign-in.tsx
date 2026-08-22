import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
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
  isConfiguredPreviewManagerPhone,
  previewManagerPersona,
} from '../src/features/auth/preview-persona';
import {
  AppScreen,
  BrandMark,
  ErrorMessage,
  Field,
  Heading,
  InlineFeedback,
  PrimaryButton,
  Surface,
} from '../src/ui/primitives';
import { theme } from '../src/ui/theme';

function param(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return 'تعذر اعتماد رقم الجوال. حاول مرة أخرى.';
}

export default function SignInScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ inviteToken?: string }>();
  const inviteToken = param(params.inviteToken).toLowerCase();
  const auth = useAuth();
  const { session, setPendingOnboarding, isPreviewMode } = auth;
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  if (session) {
    return inviteToken && /^[0-9a-f]{48}$/.test(inviteToken) && !isPreviewMode
      ? <Redirect href={{ pathname: '/invite/[token]', params: { token: inviteToken } }} />
      : <Redirect href="/home" />;
  }

  const submitManagerPreview = () => {
    try {
      setError(null);
      auth.enterManagerPreview();
      router.replace('/home');
    } catch (previewError: unknown) {
      setError(errorMessage(previewError));
    }
  };

  const submitPhoneAuth = () => {
    if (loading) return;
    setError(null);
    setLoading(true);
    void requestPhoneOtp({ fullName, phone })
      .then((pending) => {
        setPendingOnboarding(pending);
        if (inviteToken && /^[0-9a-f]{48}$/.test(inviteToken)) {
          router.push({ pathname: '/verify', params: { inviteToken } });
        } else {
          router.push('/verify');
        }
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
            title={isPreviewMode ? 'مساحة المدير' : inviteToken ? 'سجل الدخول لفتح دعوتك' : 'دفترك معك، بوضوح.'}
            subtitle={isPreviewMode
              ? 'نواصل تطوير التطبيق بهوية مدير ثابتة وآمنة للمعاينة، دون اعتبار رقم الجوال موثقًا إنتاجيًا.'
              : inviteToken
                ? 'استخدم نفس رقم الجوال الذي سجله النشاط لك. بعد التحقق ستعود مباشرة إلى الدعوة.'
                : 'أدخل اسمك ورقم جوالك. سنرسل رمز تحقق واحد لتأمين حسابك وربط دفاترك بك.'}
          />

          {isPreviewMode ? (
            <View style={styles.previewStack}>
              <Surface variant="tinted">
                <Text style={styles.personaEyebrow}>مدير مساحة التطوير</Text>
                <Text style={styles.personaName}>{previewManagerPersona.fullName}</Text>
                <Text style={styles.personaMeta}>{previewManagerPersona.businessName} · Manager</Text>
              </Surface>

              <InlineFeedback tone="info">
                {isConfiguredPreviewManagerPhone()
                  ? 'تم تحميل رقم مدير المعاينة من إعداد محلي. الرقم لا يُحفظ في GitHub ولا يمنح أي صلاحية إنتاجية.'
                  : 'يُستخدم رقم تجريبي اصطناعي حاليًا. يمكن ضبط رقم المدير الحقيقي محليًا عبر متغير البيئة المخصص دون حفظه في GitHub.'}
              </InlineFeedback>

              <PrimaryButton onPress={submitManagerPreview}>الدخول إلى مساحة المدير</PrimaryButton>
              <Text style={styles.privacy}>
                هذا المسار للمعاينة والتطوير فقط. سيتم ربط التحقق الحقيقي عبر OTP/WhatsApp لاحقًا قبل أي إصدار إنتاجي.
              </Text>
            </View>
          ) : (
            <>
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
                  onPress={submitPhoneAuth}
                >
                  إرسال رمز التحقق
                </PrimaryButton>
              </View>

              <Text style={styles.privacy}>
                لا نستخدم رقم الجوال كمفتاح مالي. هويتك الداخلية دائمة ويمكن تغيير الرقم لاحقًا عبر مسار تحقق آمن.
              </Text>
            </>
          )}

          {isPreviewMode ? <ErrorMessage message={error} /> : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flexGrow: 1, paddingBottom: theme.spacing.xl },
  form: { marginTop: theme.spacing.sm },
  previewStack: { gap: theme.spacing.md },
  personaEyebrow: {
    color: theme.colors.accent,
    fontSize: theme.typography.styles.captionStrong.fontSize,
    lineHeight: theme.typography.styles.captionStrong.lineHeight,
    fontWeight: theme.typography.styles.captionStrong.fontWeight,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  personaName: {
    color: theme.colors.text,
    fontSize: theme.typography.styles.title.fontSize,
    lineHeight: theme.typography.styles.title.lineHeight,
    fontWeight: theme.typography.styles.title.fontWeight,
    textAlign: 'right',
    writingDirection: 'rtl',
    marginTop: theme.spacing.xxs,
  },
  personaMeta: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.styles.caption.fontSize,
    lineHeight: theme.typography.styles.caption.lineHeight,
    textAlign: 'right',
    writingDirection: 'rtl',
    marginTop: theme.spacing.xxs,
  },
  privacy: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.caption,
    lineHeight: 21,
    textAlign: 'right',
    writingDirection: 'rtl',
    paddingTop: theme.spacing.md,
  },
});