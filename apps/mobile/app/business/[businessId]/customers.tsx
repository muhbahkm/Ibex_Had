import type { BusinessCustomerSummaryRecord } from '../../../../../packages/application/src/ports';
import { Redirect, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../../../src/features/auth/auth-context';
import { ibex } from '../../../src/lib/ibex';
import { Button, EmptyState, ErrorState, LoadingState, Surface, TextField } from '../../../src/ui/primitives';
import { SecondaryShell } from '../../../src/ui/secondary-shell';
import { theme } from '../../../src/ui/theme';

function param(value: string | string[] | undefined): string { return Array.isArray(value) ? (value[0] ?? '') : (value ?? ''); }
function message(error: unknown): string { return error instanceof Error && error.message ? error.message : 'تعذر تحميل العملاء.'; }

export default function CustomersScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ businessId?: string; businessName?: string }>();
  const businessId = param(params.businessId);
  const businessName = param(params.businessName) || 'النشاط';
  const { session } = useAuth();
  const [customers, setCustomers] = useState<readonly BusinessCustomerSummaryRecord[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    setError(null);
    void ibex.listBusinessCustomers({ businessId, search })
      .then((rows) => { if (active) setCustomers(rows); })
      .catch((loadError: unknown) => { if (active) setError(message(loadError)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [businessId, search, refreshNonce]));

  const accountCount = useMemo(() => customers.reduce((sum, customer) => sum + customer.accountCount, 0), [customers]);

  if (!session) return <Redirect href="/sign-in" />;
  if (!businessId) return <Redirect href="/home" />;

  return (
    <SecondaryShell title="العملاء" subtitle={businessName} onBack={() => router.back()}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Surface variant="tinted">
          <View style={styles.metricsRow}>
            <View style={styles.metric}><Text style={styles.metricValue}>{String(customers.length)}</Text><Text style={styles.metricLabel}>عميل ظاهر</Text></View>
            <View style={styles.metricDivider} />
            <View style={styles.metric}><Text style={styles.metricValue}>{String(accountCount)}</Text><Text style={styles.metricLabel}>حساب</Text></View>
          </View>
        </Surface>

        <TextField label="بحث" onChangeText={setSearch} placeholder="اسم العميل أو رقم الجوال" returnKeyType="search" value={search} />

        <View style={styles.actions}>
          <View style={styles.actionItem}><Button onPress={() => router.push({ pathname: '/business/[businessId]/customer/new', params: { businessId, businessName } })}>إضافة عميل</Button></View>
          <View style={styles.actionItem}><Button variant="secondary" onPress={() => router.push({ pathname: '/business/[businessId]/disputes', params: { businessId, businessName } })}>طلبات المراجعة</Button></View>
        </View>

        {error ? <ErrorState message={error} onRetry={() => setRefreshNonce((value) => value + 1)} /> : null}
        {loading ? <LoadingState label="جارٍ تحميل العملاء" /> : null}
        {!loading && !error && customers.length === 0 ? <EmptyState title="لا توجد نتائج" message="أضف أول عميل أو غيّر عبارة البحث." /> : null}

        <View style={styles.list}>
          {customers.map((customer) => (
            <Pressable
              accessibilityRole="button"
              key={customer.businessCustomerId}
              onPress={() => router.push({ pathname: '/customer/[businessCustomerId]', params: { businessCustomerId: customer.businessCustomerId, customerIdentityId: customer.customerIdentityId, businessId, businessName, displayName: customer.displayName, phone: customer.phoneE164 ?? '' } })}
              style={({ pressed }) => [pressed ? styles.pressed : null]}
            >
              <Surface variant="outlined">
                <View style={styles.customerRow}>
                  <View style={styles.customerMeta}>
                    <Text style={styles.customerName}>{customer.displayName}</Text>
                    <Text style={styles.customerCaption}>{customer.phoneE164 ?? 'بدون رقم جوال'} · {String(customer.accountCount)} حساب</Text>
                  </View>
                  <Text style={styles.chevron}>‹</Text>
                </View>
              </Surface>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </SecondaryShell>
  );
}

const styles = StyleSheet.create({
  content: { gap: theme.spacing.lg, paddingTop: theme.spacing.lg, paddingBottom: theme.spacing.xl },
  metricsRow: { flexDirection: 'row-reverse', alignItems: 'stretch' },
  metric: { flex: 1, minHeight: 64, alignItems: 'center', justifyContent: 'center', gap: theme.spacing.xxs },
  metricValue: { color: theme.colors.text, fontSize: theme.typography.styles.heading.fontSize, fontWeight: '700', writingDirection: 'ltr' },
  metricLabel: { color: theme.colors.textMuted, fontSize: theme.typography.caption, writingDirection: 'rtl' },
  metricDivider: { width: 1, backgroundColor: theme.colors.border },
  actions: { flexDirection: 'row-reverse', gap: theme.spacing.sm },
  actionItem: { flex: 1 },
  list: { gap: theme.spacing.sm },
  customerRow: { minHeight: theme.layout.minTouchTarget, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.md },
  customerMeta: { flex: 1, gap: theme.spacing.xxs },
  customerName: { color: theme.colors.text, fontSize: theme.typography.styles.bodyStrong.fontSize, lineHeight: theme.typography.styles.bodyStrong.lineHeight, fontWeight: theme.typography.styles.bodyStrong.fontWeight, textAlign: 'right', writingDirection: 'rtl' },
  customerCaption: { color: theme.colors.textMuted, fontSize: theme.typography.caption, textAlign: 'right', writingDirection: 'rtl' },
  chevron: { color: theme.colors.textMuted, fontSize: 28, writingDirection: 'ltr' },
  pressed: { opacity: 0.72 },
});
