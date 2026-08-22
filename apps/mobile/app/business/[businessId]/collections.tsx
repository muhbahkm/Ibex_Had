import type { BusinessCollectionOverview, CustomerCollectionSummary } from '../../../../../packages/application/src/collection-read-model';
import { Redirect, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../../../src/features/auth/auth-context';
import { getBusinessCollectionOverview } from '../../../src/lib/collection-overview';
import { formatMinorUnits } from '../../../src/lib/money-display';
import { EmptyState, ErrorState, InlineFeedback, LoadingState, Surface } from '../../../src/ui/primitives';
import { MetricStrip, SectionHeading, StatusBadge } from '../../../src/ui/operational-primitives';
import { SecondaryShell } from '../../../src/ui/secondary-shell';
import { theme } from '../../../src/ui/theme';

function param(value: string | string[] | undefined): string { return Array.isArray(value) ? (value[0] ?? '') : (value ?? ''); }
function message(error: unknown): string { return error instanceof Error && error.message ? error.message : 'تعذر تحميل متابعة التحصيل.'; }
function stateMeta(state: CustomerCollectionSummary['followUpState']) {
  if (state === 'stale_debt') return { label: 'متابعة راكدة', tone: 'warning' as const };
  if (state === 'active_debt') return { label: 'ذمة نشطة', tone: 'info' as const };
  return { label: 'لا توجد ذمة', tone: 'success' as const };
}

export default function CollectionsScreen() {
  const router = useRouter();
  const { session, isPreviewMode } = useAuth();
  const params = useLocalSearchParams<{ businessId?: string; businessName?: string }>();
  const businessId = param(params.businessId);
  const businessName = param(params.businessName) || 'النشاط';
  const [overview, setOverview] = useState<BusinessCollectionOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);

  useFocusEffect(useCallback(() => {
    if (!businessId) return undefined;
    let active = true;
    setLoading(true);
    setError(null);
    void getBusinessCollectionOverview({ businessId, limit: 100, staleAfterDays: 30 })
      .then((result) => { if (active) setOverview(result); })
      .catch((loadError: unknown) => { if (active) setError(message(loadError)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [businessId, refreshNonce]));

  const followUpCustomers = useMemo(() => overview?.customers.filter((customer) => customer.debtAccountCount > 0) ?? [], [overview]);

  if (!session) return <Redirect href="/sign-in" />;
  if (!businessId) return <Redirect href="/home" />;

  return (
    <SecondaryShell title="متابعة التحصيل" subtitle={businessName} onBack={() => router.back()}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>Read Model تشغيلي</Text>
          <Text style={styles.title}>الذمم والمتابعة، مفصولة حسب العملة.</Text>
          <Text style={styles.body}>الحالة «راكدة» تعني وجود رصيد موجب وعدم ظهور حركة خلال 30 يومًا؛ لا تعني أن الدين متأخر نظاميًا ما لم يوجد تاريخ استحقاق صريح.</Text>
        </View>

        {isPreviewMode ? <InlineFeedback tone="info">بيانات المعاينة محلية. منطق المتابعة نفسه مشترك مع مسار الإنتاج.</InlineFeedback> : null}
        {error ? <ErrorState message={error} onRetry={() => setRefreshNonce((value) => value + 1)} retryLabel="إعادة التحميل" /> : null}
        {loading ? <LoadingState label="جارٍ بناء صورة التحصيل" /> : null}

        {!loading && !error && overview ? (
          <>
            <MetricStrip items={[
              { label: 'عملاء', value: String(overview.customerCount) },
              { label: 'لديهم ذمة', value: String(overview.debtorCustomerCount) },
              { label: 'تحتاج متابعة', value: String(overview.staleDebtorCustomerCount) },
            ]} />

            <View style={styles.section}>
              <SectionHeading title="ملخص حسب العملة" caption="لا توجد أي عملية جمع بين العملات المختلفة." />
              <View style={styles.stack}>
                {overview.currencies.map((currency) => (
                  <Surface key={currency.currencyCode} variant="outlined">
                    <View style={styles.currencyHeader}>
                      <Text style={styles.currencyCode}>{currency.currencyCode}</Text>
                      <StatusBadge tone="neutral">{String(currency.debtorAccountCount)} حساب مدين</StatusBadge>
                    </View>
                    <Text style={styles.amount}>{formatMinorUnits(currency.receivableMinor, currency.currencyCode)}</Text>
                    <Text style={styles.caption}>إجمالي الذمم المدينة ضمن هذه العملة فقط</Text>
                    {currency.payableMinor > 0n ? <Text style={styles.creditText}>وللعملاء على النشاط: {formatMinorUnits(currency.payableMinor, currency.currencyCode)}</Text> : null}
                  </Surface>
                ))}
              </View>
            </View>

            <View style={styles.section}>
              <SectionHeading title="قائمة المتابعة" caption="العملاء ذوو الرصيد الموجب، مع تقديم الحسابات الراكدة أولًا." />
              {followUpCustomers.length === 0 ? <EmptyState title="لا توجد ذمم مدينة" message="لا يظهر حاليًا أي حساب برصيد موجب ضمن العملاء المحملين." /> : null}
              <View style={styles.stack}>
                {followUpCustomers.map((customer) => {
                  const meta = stateMeta(customer.followUpState);
                  const debtAccounts = customer.accounts.filter((account) => account.balanceMinor > 0n);
                  return (
                    <Pressable
                      key={customer.businessCustomerId}
                      onPress={() => router.push({ pathname: '/customer/[businessCustomerId]', params: { businessCustomerId: customer.businessCustomerId, customerIdentityId: customer.customerIdentityId, businessId, businessName, displayName: customer.displayName, phone: customer.phoneE164 ?? '' } })}
                      style={({ pressed }) => [pressed ? styles.pressed : null]}
                    >
                      <Surface variant={customer.followUpState === 'stale_debt' ? 'tinted' : 'outlined'}>
                        <View style={styles.rowHeader}>
                          <Text style={styles.customerName}>{customer.displayName}</Text>
                          <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
                        </View>
                        <View style={styles.balanceList}>
                          {debtAccounts.map((account) => (
                            <View key={account.accountId} style={styles.balanceRow}>
                              <Text style={styles.balanceCurrency}>{account.currencyCode}</Text>
                              <Text style={styles.balanceAmount}>{formatMinorUnits(account.balanceMinor, account.currencyCode)}</Text>
                            </View>
                          ))}
                        </View>
                        <Text style={styles.lastMovement}>آخر حركة: {customer.lastMovementAt ? new Date(customer.lastMovementAt).toLocaleDateString('en-GB') : 'لا توجد حركة مسجلة'}</Text>
                      </Surface>
                    </Pressable>
                  );
                })}
              </View>
            </View>
          </>
        ) : null}
      </ScrollView>
    </SecondaryShell>
  );
}

const styles = StyleSheet.create({
  content: { gap: theme.spacing.lg, paddingTop: theme.spacing.lg, paddingBottom: theme.spacing.xl },
  hero: { gap: theme.spacing.xs },
  eyebrow: { color: theme.colors.accent, fontSize: theme.typography.styles.label.fontSize, fontWeight: theme.typography.styles.label.fontWeight, textAlign: 'right', writingDirection: 'rtl' },
  title: { color: theme.colors.text, fontSize: theme.typography.styles.title.fontSize, lineHeight: theme.typography.styles.title.lineHeight, fontWeight: theme.typography.styles.title.fontWeight, textAlign: 'right', writingDirection: 'rtl' },
  body: { color: theme.colors.textMuted, fontSize: theme.typography.styles.body.fontSize, lineHeight: theme.typography.styles.body.lineHeight, textAlign: 'right', writingDirection: 'rtl' },
  section: { gap: theme.spacing.md },
  stack: { gap: theme.spacing.sm },
  currencyHeader: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', gap: theme.spacing.sm },
  currencyCode: { color: theme.colors.text, fontWeight: '800', writingDirection: 'ltr' },
  amount: { color: theme.colors.text, fontSize: theme.typography.styles.heading.fontSize, lineHeight: theme.typography.styles.heading.lineHeight, fontWeight: '800', marginTop: theme.spacing.sm, textAlign: 'right', writingDirection: 'ltr' },
  caption: { color: theme.colors.textMuted, fontSize: theme.typography.styles.caption.fontSize, marginTop: theme.spacing.xs, textAlign: 'right', writingDirection: 'rtl' },
  creditText: { color: theme.colors.textMuted, fontSize: theme.typography.styles.caption.fontSize, marginTop: theme.spacing.sm, textAlign: 'right', writingDirection: 'rtl' },
  rowHeader: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.sm },
  customerName: { flex: 1, color: theme.colors.text, fontSize: theme.typography.styles.bodyStrong.fontSize, fontWeight: theme.typography.styles.bodyStrong.fontWeight, textAlign: 'right', writingDirection: 'rtl' },
  balanceList: { gap: theme.spacing.xs, marginTop: theme.spacing.md },
  balanceRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  balanceCurrency: { color: theme.colors.textMuted, fontSize: theme.typography.styles.caption.fontSize, writingDirection: 'ltr' },
  balanceAmount: { color: theme.colors.text, fontWeight: '800', writingDirection: 'ltr' },
  lastMovement: { color: theme.colors.textMuted, fontSize: theme.typography.styles.caption.fontSize, marginTop: theme.spacing.md, textAlign: 'right', writingDirection: 'rtl' },
  pressed: { opacity: 0.72 },
});
