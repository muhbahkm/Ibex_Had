import type {
  BusinessSummaryRecord,
  MyCustomerAccountRecord,
} from '../../../packages/application/src/ports';
import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../src/features/auth/auth-context';
import { ibex } from '../src/lib/ibex';
import { formatMinorUnits } from '../src/lib/money-display';
import { AppScreen, BrandMark, ErrorMessage, Heading, PrimaryButton } from '../src/ui/primitives';
import { theme } from '../src/ui/theme';

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return 'تعذر تحميل مساحة العمل.';
}

export default function HomeScreen() {
  const router = useRouter();
  const auth = useAuth();
  const { session } = auth;
  const [businesses, setBusinesses] = useState<readonly BusinessSummaryRecord[]>([]);
  const [myAccounts, setMyAccounts] = useState<readonly MyCustomerAccountRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      setError(null);
      void Promise.all([ibex.listBusinesses(), ibex.listMyCustomerAccounts()])
        .then(([businessRows, accountRows]) => {
          if (!active) return;
          setBusinesses(businessRows);
          setMyAccounts(accountRows);
        })
        .catch((loadError: unknown) => {
          if (active) setError(errorMessage(loadError));
        })
        .finally(() => {
          if (active) setLoading(false);
        });
      return () => {
        active = false;
      };
    }, []),
  );

  if (!session) return <Redirect href="/sign-in" />;

  const logout = () => {
    void auth.signOut();
  };

  return (
    <AppScreen>
      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        <View style={styles.headerRow}>
          <BrandMark />
          <Pressable onPress={logout} style={styles.signOutButton}>
            <Text style={styles.signOutText}>تسجيل الخروج</Text>
          </Pressable>
        </View>

        <Heading title="IBEX HAD" subtitle="حساباتك كعميل ومساحات العمل التي تديرها، في مكان واحد." />

        <ErrorMessage message={error} />
        {loading ? <ActivityIndicator style={styles.loader} color={theme.colors.primary} /> : null}

        {myAccounts.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>حساباتي</Text>
            <Text style={styles.sectionSubtitle}>الحسابات التي تم ربطها بهويتك الموثقة.</Text>
            <View style={styles.list}>
              {myAccounts.map((account) => (
                <Pressable
                  key={account.accountId}
                  onPress={() =>
                    router.push({
                      pathname: '/account/[accountId]',
                      params: {
                        accountId: account.accountId,
                        businessId: account.businessId,
                        customerIdentityId: account.customerIdentityId,
                        businessCustomerId: account.businessCustomerId,
                        displayName: account.businessName,
                        currencyCode: account.currencyCode,
                        mode: 'customer',
                      },
                    })
                  }
                  style={({ pressed }) => [styles.customerAccountCard, pressed ? styles.cardPressed : null]}
                >
                  <View style={styles.businessMeta}>
                    <Text style={styles.businessName}>{account.businessName}</Text>
                    <Text style={styles.businessCaption}>{account.currencyCode} · {account.accountStatus}</Text>
                  </View>
                  <Text style={styles.accountBalance}>
                    {formatMinorUnits(account.balanceMinor, account.currencyCode)}
                  </Text>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        <View style={styles.section}>
          <Text style={styles.sectionTitle}>أنشطتي</Text>
          <Text style={styles.sectionSubtitle}>المساحات التجارية التي تملكها أو تعمل ضمن فريقها.</Text>

          {!loading && businesses.length === 0 ? (
            <View style={styles.emptyCard}>
              <Text style={styles.emptyTitle}>لا يوجد نشاط بعد</Text>
              <Text style={styles.emptyBody}>يمكنك إنشاء نشاط، أو استخدام IBEX HAD كعميل فقط.</Text>
            </View>
          ) : null}

          <View style={styles.list}>
            {businesses.map((business) => (
              <Pressable
                key={business.businessId}
                onPress={() =>
                  router.push({
                    pathname: '/business/[businessId]/customers',
                    params: { businessId: business.businessId, businessName: business.name },
                  })
                }
                style={({ pressed }) => [styles.businessCard, pressed ? styles.cardPressed : null]}
              >
                <View style={styles.businessMeta}>
                  <Text style={styles.businessName}>{business.name}</Text>
                  <Text style={styles.businessCaption}>
                    {business.defaultCurrencyCode ?? 'بدون عملة افتراضية'} · {business.role}
                  </Text>
                </View>
                <Text style={styles.chevron}>‹</Text>
              </Pressable>
            ))}
          </View>

          <PrimaryButton onPress={() => router.push('/business/new')}>إنشاء نشاط تجاري</PrimaryButton>
        </View>
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  scrollContent: { paddingBottom: theme.spacing.xl },
  headerRow: { flexDirection: 'row-reverse', alignItems: 'flex-start', justifyContent: 'space-between' },
  signOutButton: { paddingVertical: theme.spacing.sm, paddingHorizontal: theme.spacing.sm },
  signOutText: { color: theme.colors.textMuted, fontSize: theme.typography.caption, fontWeight: '600', writingDirection: 'rtl' },
  loader: { marginVertical: theme.spacing.lg },
  section: { marginBottom: theme.spacing.xl },
  sectionTitle: { color: theme.colors.text, fontSize: theme.typography.heading, fontWeight: '800', textAlign: 'right', writingDirection: 'rtl' },
  sectionSubtitle: { color: theme.colors.textMuted, fontSize: theme.typography.caption, textAlign: 'right', writingDirection: 'rtl', marginTop: theme.spacing.xs, marginBottom: theme.spacing.md },
  emptyCard: { padding: theme.spacing.lg, backgroundColor: theme.colors.surfaceMuted, borderRadius: theme.radius.lg, marginBottom: theme.spacing.lg },
  emptyTitle: { color: theme.colors.text, fontSize: theme.typography.heading, fontWeight: '700', textAlign: 'right', writingDirection: 'rtl' },
  emptyBody: { color: theme.colors.textMuted, fontSize: theme.typography.body, marginTop: theme.spacing.sm, textAlign: 'right', writingDirection: 'rtl' },
  list: { gap: theme.spacing.sm, marginBottom: theme.spacing.lg },
  businessCard: { minHeight: 82, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.lg, backgroundColor: theme.colors.surface, padding: theme.spacing.lg, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' },
  customerAccountCard: { minHeight: 88, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.lg, backgroundColor: theme.colors.surface, padding: theme.spacing.lg, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.md },
  cardPressed: { opacity: 0.72 },
  businessMeta: { flex: 1, gap: theme.spacing.xs },
  businessName: { color: theme.colors.text, fontSize: theme.typography.heading, fontWeight: '700', textAlign: 'right', writingDirection: 'rtl' },
  businessCaption: { color: theme.colors.textMuted, fontSize: theme.typography.caption, textAlign: 'right', writingDirection: 'rtl' },
  accountBalance: { color: theme.colors.text, fontSize: theme.typography.body, fontWeight: '800', writingDirection: 'ltr' },
  chevron: { color: theme.colors.textMuted, fontSize: 28, marginRight: theme.spacing.md },
});
