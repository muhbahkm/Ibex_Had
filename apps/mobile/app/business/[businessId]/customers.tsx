import type { BusinessCustomerSummaryRecord } from '../../../../../packages/application/src/ports';
import { Redirect, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../../../src/features/auth/auth-context';
import { ibex } from '../../../src/lib/ibex';
import { AppScreen, ErrorMessage, Field, Heading, PrimaryButton } from '../../../src/ui/primitives';
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

  const load = useCallback(() => {
    let active = true;
    setLoading(true);
    setError(null);
    void ibex.listBusinessCustomers({ businessId, search }).then((rows) => { if (active) setCustomers(rows); }).catch((loadError: unknown) => { if (active) setError(message(loadError)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [businessId, search]);

  useFocusEffect(load);
  if (!session) return <Redirect href="/sign-in" />;
  if (!businessId) return <Redirect href="/home" />;

  return (
    <AppScreen>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()} style={styles.backButton}><Text style={styles.backText}>رجوع</Text></Pressable>
        <Heading title={businessName} subtitle="العملاء والحسابات المشتركة لهذا النشاط." />
        <Field label="بحث" onChangeText={setSearch} placeholder="اسم العميل أو رقم الجوال" returnKeyType="search" value={search} />
        <View style={styles.actions}>
          <View style={styles.actionItem}><PrimaryButton onPress={() => router.push({ pathname: '/business/[businessId]/customer/new', params: { businessId, businessName } })}>إضافة عميل</PrimaryButton></View>
          <View style={styles.actionItem}><PrimaryButton onPress={() => router.push({ pathname: '/business/[businessId]/disputes', params: { businessId, businessName } })}>طلبات المراجعة</PrimaryButton></View>
        </View>
        <ErrorMessage message={error} />
        {loading ? <ActivityIndicator color={theme.colors.primary} style={styles.loader} /> : null}
        {!loading && customers.length === 0 ? <View style={styles.emptyCard}><Text style={styles.emptyTitle}>لا توجد نتائج</Text><Text style={styles.emptyBody}>أضف أول عميل أو غيّر عبارة البحث.</Text></View> : null}
        <View style={styles.list}>
          {customers.map((customer) => (
            <Pressable key={customer.businessCustomerId} onPress={() => router.push({ pathname: '/customer/[businessCustomerId]', params: { businessCustomerId: customer.businessCustomerId, customerIdentityId: customer.customerIdentityId, businessId, businessName, displayName: customer.displayName, phone: customer.phoneE164 ?? '' } })} style={({ pressed }) => [styles.customerCard, pressed ? styles.cardPressed : null]}>
              <View style={styles.customerMeta}><Text style={styles.customerName}>{customer.displayName}</Text><Text style={styles.customerCaption}>{customer.phoneE164 ?? 'بدون رقم جوال'} · {customer.accountCount} حساب</Text></View>
              <Text style={styles.chevron}>‹</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: theme.spacing.xl },
  backButton: { alignSelf: 'flex-start', paddingVertical: theme.spacing.sm, marginBottom: theme.spacing.md },
  backText: { color: theme.colors.textMuted, fontWeight: '700', writingDirection: 'rtl' },
  actions: { flexDirection: 'row-reverse', gap: theme.spacing.sm },
  actionItem: { flex: 1 },
  loader: { marginVertical: theme.spacing.lg },
  emptyCard: { marginTop: theme.spacing.lg, padding: theme.spacing.lg, borderRadius: theme.radius.lg, backgroundColor: theme.colors.surfaceMuted },
  emptyTitle: { color: theme.colors.text, fontWeight: '700', fontSize: theme.typography.heading, textAlign: 'right' },
  emptyBody: { color: theme.colors.textMuted, marginTop: theme.spacing.sm, textAlign: 'right', writingDirection: 'rtl' },
  list: { gap: theme.spacing.sm, marginTop: theme.spacing.lg },
  customerCard: { minHeight: 76, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.lg, backgroundColor: theme.colors.surface, padding: theme.spacing.lg, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' },
  cardPressed: { opacity: 0.72 },
  customerMeta: { flex: 1, gap: theme.spacing.xs },
  customerName: { color: theme.colors.text, fontWeight: '700', fontSize: theme.typography.body, textAlign: 'right', writingDirection: 'rtl' },
  customerCaption: { color: theme.colors.textMuted, fontSize: theme.typography.caption, textAlign: 'right', writingDirection: 'rtl' },
  chevron: { color: theme.colors.textMuted, fontSize: 28, marginRight: theme.spacing.md },
});
