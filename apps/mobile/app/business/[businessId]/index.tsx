import type {
  BusinessCustomerSummaryRecord,
  BusinessDisputeRecord,
  NotificationRecord,
} from '../../../../../packages/application/src/ports';
import { Redirect, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../../../src/features/auth/auth-context';
import { ibex } from '../../../src/lib/ibex';
import { Button, ErrorState, InlineFeedback, LoadingState, Surface } from '../../../src/ui/primitives';
import { MetricStrip, SectionHeading, StatusBadge } from '../../../src/ui/operational-primitives';
import { SecondaryShell } from '../../../src/ui/secondary-shell';
import { theme } from '../../../src/ui/theme';

function param(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : 'تعذر تحميل مساحة إدارة النشاط.';
}

function disputeStatus(status: BusinessDisputeRecord['status']): { label: string; tone: 'warning' | 'info' | 'success' | 'danger' | 'neutral' } {
  if (status === 'open') return { label: 'جديد', tone: 'warning' };
  if (status === 'under_review') return { label: 'قيد المراجعة', tone: 'info' };
  if (status === 'resolved') return { label: 'معالج', tone: 'success' };
  if (status === 'rejected') return { label: 'مرفوض', tone: 'danger' };
  return { label: 'مسحوب', tone: 'neutral' };
}

export default function BusinessWorkspaceScreen() {
  const router = useRouter();
  const auth = useAuth();
  const params = useLocalSearchParams<{ businessId?: string; businessName?: string; currencyCode?: string; role?: string }>();
  const businessId = param(params.businessId);
  const businessName = param(params.businessName) || 'النشاط التجاري';
  const currencyCode = param(params.currencyCode) || '—';
  const role = param(params.role) || 'member';
  const [customers, setCustomers] = useState<readonly BusinessCustomerSummaryRecord[]>([]);
  const [disputes, setDisputes] = useState<readonly BusinessDisputeRecord[]>([]);
  const [notifications, setNotifications] = useState<readonly NotificationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);

  useFocusEffect(useCallback(() => {
    if (!businessId) return undefined;
    let active = true;
    setLoading(true);
    setError(null);
    void Promise.all([
      ibex.listBusinessCustomers({ businessId, limit: 100 }),
      ibex.listBusinessDisputes({ businessId, limit: 100 }),
      ibex.listNotifications({ unreadOnly: true, limit: 100 }),
    ])
      .then(([customerRows, disputeRows, notificationRows]) => {
        if (!active) return;
        setCustomers(customerRows);
        setDisputes(disputeRows);
        setNotifications(notificationRows.filter((row) => row.businessId === businessId));
      })
      .catch((loadError: unknown) => { if (active) setError(errorMessage(loadError)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [businessId, refreshNonce]));

  const openDisputes = useMemo(() => disputes.filter((row) => row.status === 'open' || row.status === 'under_review'), [disputes]);
  const recentCustomers = useMemo(() => [...customers].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 3), [customers]);
  const attentionDisputes = openDisputes.slice(0, 3);

  if (!auth.session) return <Redirect href="/sign-in" />;
  if (!businessId) return <Redirect href="/home" />;

  return (
    <SecondaryShell title={businessName} subtitle={`${currencyCode} · ${role}`} onBack={() => router.back()}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>مساحة إدارة النشاط</Text>
          <Text style={styles.title}>ما يحتاج قرارك أولًا، ثم بقية العمل.</Text>
          <Text style={styles.body}>مساحة تشغيلية مختصرة للعملاء والمراجعات والتنبيهات دون اختراع إجماليات مالية عبر العملات.</Text>
        </View>

        {auth.isPreviewMode ? <InlineFeedback tone="info">هذه المساحة تعمل الآن على Preview Runtime المحلي؛ كل البيانات هنا تجريبية ولا تنشئ حركة مالية حقيقية.</InlineFeedback> : null}
        {error ? <ErrorState message={error} onRetry={() => setRefreshNonce((value) => value + 1)} retryLabel="إعادة التحميل" /> : null}
        {loading ? <LoadingState label="جارٍ تحميل بيانات النشاط" /> : null}

        {!loading && !error ? (
          <>
            <MetricStrip items={[
              { label: 'عميل', value: String(customers.length) },
              { label: 'مراجعة مفتوحة', value: String(openDisputes.length) },
              { label: 'إشعار جديد', value: String(notifications.length) },
            ]} />

            <View style={styles.actions}>
              <Button onPress={() => router.push({ pathname: '/business/[businessId]/customer/new', params: { businessId, businessName } })}>إضافة عميل</Button>
              <Button onPress={() => router.push({ pathname: '/business/[businessId]/customers', params: { businessId, businessName } })} variant="secondary">فتح العملاء والحسابات</Button>
              <Button onPress={() => router.push({ pathname: '/business/[businessId]/disputes', params: { businessId, businessName } })} variant="ghost">طلبات المراجعة</Button>
            </View>

            <View style={styles.section}>
              <SectionHeading title="يحتاج انتباهك" caption="طلبات مراجعة ما زالت مفتوحة أو قيد المعالجة." />
              {attentionDisputes.length === 0 ? (
                <Surface variant="tinted"><Text style={styles.quietText}>لا توجد طلبات مراجعة مفتوحة حاليًا.</Text></Surface>
              ) : (
                <View style={styles.stack}>
                  {attentionDisputes.map((row) => {
                    const meta = disputeStatus(row.status);
                    return (
                      <Pressable key={row.disputeId} onPress={() => router.push({ pathname: '/business/[businessId]/dispute/[disputeId]', params: { businessId, businessName, disputeId: row.disputeId, customerName: row.customerName, status: row.status, reason: row.reason, resolutionNote: row.resolutionNote ?? '' } })} style={({ pressed }) => [pressed ? styles.pressed : null]}>
                        <Surface variant="outlined">
                          <View style={styles.rowHeader}>
                            <Text style={styles.rowTitle}>{row.customerName}</Text>
                            <StatusBadge tone={meta.tone}>{meta.label}</StatusBadge>
                          </View>
                          <Text style={styles.rowBody} numberOfLines={2}>{row.reason}</Text>
                        </Surface>
                      </Pressable>
                    );
                  })}
                </View>
              )}
            </View>

            <View style={styles.section}>
              <SectionHeading title="أحدث العملاء" caption="وصول سريع إلى آخر الملفات التي أضيفت للنشاط." />
              <View style={styles.stack}>
                {recentCustomers.map((customer) => (
                  <Pressable key={customer.businessCustomerId} onPress={() => router.push({ pathname: '/customer/[businessCustomerId]', params: { businessCustomerId: customer.businessCustomerId, customerIdentityId: customer.customerIdentityId, businessId, businessName, displayName: customer.displayName, phone: customer.phoneE164 ?? '' } })} style={({ pressed }) => [pressed ? styles.pressed : null]}>
                    <Surface variant="outlined">
                      <View style={styles.rowHeader}>
                        <Text style={styles.rowTitle}>{customer.displayName}</Text>
                        <StatusBadge tone="neutral">{String(customer.accountCount)} حساب</StatusBadge>
                      </View>
                      <Text style={styles.rowBody}>{customer.phoneE164 ?? 'رقم الجوال غير مسجل'}</Text>
                    </Surface>
                  </Pressable>
                ))}
              </View>
            </View>

            <Surface variant="tinted">
              <Text style={styles.noteTitle}>مبدأ مالي ثابت</Text>
              <Text style={styles.noteBody}>لا نعرض مجموع أرصدة YER وSAR وUSD في رقم واحد. أي Dashboard مالي لاحق سيبنى على read model خلفي صريح يحافظ على فصل العملات.</Text>
            </Surface>
          </>
        ) : null}
      </ScrollView>
    </SecondaryShell>
  );
}

const styles = StyleSheet.create({
  content: { gap: theme.spacing.lg, paddingTop: theme.spacing.lg, paddingBottom: theme.spacing.xl },
  hero: { gap: theme.spacing.xs },
  eyebrow: { color: theme.colors.accent, fontSize: theme.typography.styles.label.fontSize, lineHeight: theme.typography.styles.label.lineHeight, fontWeight: theme.typography.styles.label.fontWeight, textAlign: 'right', writingDirection: 'rtl' },
  title: { color: theme.colors.text, fontSize: theme.typography.styles.title.fontSize, lineHeight: theme.typography.styles.title.lineHeight, fontWeight: theme.typography.styles.title.fontWeight, textAlign: 'right', writingDirection: 'rtl' },
  body: { color: theme.colors.textMuted, fontSize: theme.typography.styles.body.fontSize, lineHeight: theme.typography.styles.body.lineHeight, textAlign: 'right', writingDirection: 'rtl' },
  actions: { gap: theme.spacing.sm },
  section: { gap: theme.spacing.md },
  stack: { gap: theme.spacing.sm },
  rowHeader: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.sm },
  rowTitle: { flex: 1, color: theme.colors.text, fontSize: theme.typography.styles.bodyStrong.fontSize, lineHeight: theme.typography.styles.bodyStrong.lineHeight, fontWeight: theme.typography.styles.bodyStrong.fontWeight, textAlign: 'right', writingDirection: 'rtl' },
  rowBody: { color: theme.colors.textMuted, fontSize: theme.typography.styles.caption.fontSize, lineHeight: theme.typography.styles.caption.lineHeight, marginTop: theme.spacing.xs, textAlign: 'right', writingDirection: 'rtl' },
  quietText: { color: theme.colors.textMuted, fontSize: theme.typography.styles.body.fontSize, lineHeight: theme.typography.styles.body.lineHeight, textAlign: 'right', writingDirection: 'rtl' },
  noteTitle: { color: theme.colors.text, fontSize: theme.typography.styles.bodyStrong.fontSize, lineHeight: theme.typography.styles.bodyStrong.lineHeight, fontWeight: theme.typography.styles.bodyStrong.fontWeight, textAlign: 'right', writingDirection: 'rtl' },
  noteBody: { color: theme.colors.textMuted, fontSize: theme.typography.styles.caption.fontSize, lineHeight: theme.typography.styles.caption.lineHeight, textAlign: 'right', writingDirection: 'rtl', marginTop: theme.spacing.xs },
  pressed: { opacity: 0.72 },
});
