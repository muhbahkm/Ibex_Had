import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../../src/features/auth/auth-context';
import { ibex } from '../../src/lib/ibex';
import { AppScreen, BrandMark, ErrorMessage, Heading, PrimaryButton } from '../../src/ui/primitives';
import { theme } from '../../src/ui/theme';

function param(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

function message(error: unknown): string {
  if (!(error instanceof Error) || !error.message) return 'تعذر ربط الحساب بهذه الدعوة.';
  if (error.message.includes('phone')) return 'رقم الجوال الموثق في حسابك لا يطابق رقم العميل المسجل لدى النشاط.';
  if (error.message.includes('expired')) return 'انتهت صلاحية هذه الدعوة. اطلب من النشاط إرسال رابط جديد.';
  if (error.message.includes('consumed')) return 'تم استخدام هذه الدعوة من قبل. افتح حساباتك من الصفحة الرئيسية.';
  return error.message;
}

export default function InviteScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string }>();
  const token = param(params.token).toLowerCase();
  const { session } = useAuth();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [businessName, setBusinessName] = useState<string | null>(null);

  if (!/^[0-9a-f]{48}$/.test(token)) return <Redirect href="/home" />;
  if (!session) {
    return (
      <Redirect
        href={{ pathname: '/sign-in', params: { inviteToken: token } }}
      />
    );
  }

  const claim = () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    void ibex
      .claimCustomerInvite({ token }, `mobile-claim-invite-${Date.now().toString(36)}`)
      .then((result) => setBusinessName(result.businessName))
      .catch((claimError: unknown) => setError(message(claimError)))
      .finally(() => setLoading(false));
  };

  if (businessName) {
    return (
      <AppScreen>
        <View style={styles.center}>
          <View style={styles.successMark}><Text style={styles.successText}>✓</Text></View>
          <Heading
            title="تم ربط حسابك"
            subtitle={`أصبح حسابك مع ${businessName} ظاهرًا ضمن «حساباتي» ويمكنك متابعة الرصيد والحركات مباشرة.`}
          />
          <PrimaryButton onPress={() => router.replace('/home')}>فتح حساباتي</PrimaryButton>
        </View>
      </AppScreen>
    );
  }

  return (
    <AppScreen>
      <View style={styles.center}>
        <BrandMark />
        <Heading
          title="دعوة لعرض حسابك"
          subtitle="سنربط الحساب بهويتك فقط إذا كان رقم جوالك الموثق يطابق الرقم المسجل لدى النشاط. الرابط نفسه لا يمنح أي وصول مالي."
        />
        <ErrorMessage message={error} />
        <PrimaryButton loading={loading} onPress={claim}>تأكيد وربط الحساب</PrimaryButton>
        <Text style={styles.note}>لن يتم تعديل أي حركة مالية أثناء الربط.</Text>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, justifyContent: 'center' },
  successMark: { width: 64, height: 64, borderRadius: theme.radius.lg, alignSelf: 'flex-end', alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.primary, marginBottom: theme.spacing.lg },
  successText: { color: theme.colors.primaryText, fontSize: 30, fontWeight: '800' },
  note: { color: theme.colors.textMuted, fontSize: theme.typography.caption, textAlign: 'center', writingDirection: 'rtl', marginTop: theme.spacing.lg },
});
