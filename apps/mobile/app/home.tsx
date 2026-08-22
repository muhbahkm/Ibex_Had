import { Redirect, useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../src/features/auth/auth-context';
import { AppScreen, BrandMark, Heading, PrimaryButton } from '../src/ui/primitives';
import { theme } from '../src/ui/theme';

export default function HomeScreen() {
  const router = useRouter();
  const auth = useAuth();
  const { session } = auth;

  if (!session) return <Redirect href="/sign-in" />;

  const logout = () => {
    void auth.signOut();
  };

  return (
    <AppScreen>
      <View style={styles.headerRow}>
        <BrandMark />
        <Pressable onPress={logout} style={styles.signOutButton}>
          <Text style={styles.signOutText}>تسجيل الخروج</Text>
        </Pressable>
      </View>

      <Heading
        title="مساحة العمل"
        subtitle="ابدأ بنشاطك التجاري. جميع الحركات المالية ستعبر من نفس النواة التشغيلية الموثقة."
      />

      <View style={styles.statusCard}>
        <View style={styles.statusDot} />
        <View style={styles.statusContent}>
          <Text style={styles.statusTitle}>الجلسة آمنة ومتصلة</Text>
          <Text style={styles.statusBody} numberOfLines={1}>
            {session.user.phone ?? 'حساب موثق'}
          </Text>
        </View>
      </View>

      <View style={styles.section}>
        <Text style={styles.sectionTitle}>البدء</Text>
        <Text style={styles.sectionBody}>
          أنشئ نشاطك الأول، ثم سننتقل لإضافة العملاء والحركات وكشوف الحساب.
        </Text>
        <PrimaryButton onPress={() => router.push('/business/new')}>إنشاء نشاط تجاري</PrimaryButton>
      </View>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  headerRow: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
  },
  signOutButton: {
    paddingVertical: theme.spacing.sm,
    paddingHorizontal: theme.spacing.sm,
  },
  signOutText: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.caption,
    fontWeight: '600',
    writingDirection: 'rtl',
  },
  statusCard: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    gap: theme.spacing.md,
    backgroundColor: theme.colors.surface,
    borderWidth: 1,
    borderColor: theme.colors.border,
    borderRadius: theme.radius.lg,
    padding: theme.spacing.lg,
  },
  statusDot: {
    width: 10,
    height: 10,
    borderRadius: theme.radius.pill,
    backgroundColor: theme.colors.success,
  },
  statusContent: {
    flex: 1,
    gap: theme.spacing.xs,
  },
  statusTitle: {
    color: theme.colors.text,
    fontSize: theme.typography.body,
    fontWeight: '700',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  statusBody: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.caption,
    textAlign: 'right',
    writingDirection: 'ltr',
  },
  section: {
    marginTop: theme.spacing.xl,
    padding: theme.spacing.lg,
    backgroundColor: theme.colors.surfaceMuted,
    borderRadius: theme.radius.lg,
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: theme.typography.heading,
    fontWeight: '700',
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  sectionBody: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.body,
    lineHeight: 26,
    textAlign: 'right',
    writingDirection: 'rtl',
    marginTop: theme.spacing.sm,
    marginBottom: theme.spacing.md,
  },
});
