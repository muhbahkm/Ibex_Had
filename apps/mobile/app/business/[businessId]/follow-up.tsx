import type { CollectionPriorityBucket, CollectionTodayPlanRecord } from '../../../../../packages/application/src/collection-engagement';
import { Redirect, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../../../src/features/auth/auth-context';
import { listCollectionTodayPlan } from '../../../src/lib/collection-engagement';
import { formatMinorUnits } from '../../../src/lib/money-display';
import { EmptyState, ErrorState, InlineFeedback, LoadingState, Surface } from '../../../src/ui/primitives';
import { MetricStrip, SectionHeading, StatusBadge } from '../../../src/ui/operational-primitives';
import { SecondaryShell } from '../../../src/ui/secondary-shell';
import { theme } from '../../../src/ui/theme';

function param(value: string | string[] | undefined): string { return Array.isArray(value) ? (value[0] ?? '') : (value ?? ''); }
function message(error: unknown): string { return error instanceof Error && error.message ? error.message : 'تعذر تحميل خطة المتابعة.'; }
function priorityMeta(priority: CollectionPriorityBucket) {
  if (priority === 'urgent') return { label: 'عاجل', tone: 'danger' as const };
  if (priority === 'high') return { label: 'أولوية عالية', tone: 'warning' as const };
  if (priority === 'medium') return { label: 'متابعة اليوم', tone: 'info' as const };
  return { label: 'استعداد', tone: 'neutral' as const };
}
function actionLabel(action: CollectionTodayPlanRecord['recommendedAction']): string {
  const labels: Record<CollectionTodayPlanRecord['recommendedAction'], string> = {
    follow_up_broken_promise: 'متابعة وعد لم يُنفذ',
    confirm_payment_promise: 'تأكيد وعد السداد اليوم',
    execute_scheduled_follow_up: 'تنفيذ المتابعة المجدولة',
    contact_customer: 'التواصل مع العميل',
    review_recent_contact: 'مراجعة نتيجة التواصل الأخير',
    send_due_today_reminder: 'تذكير بالاستحقاق اليوم',
    prepare_due_soon_reminder: 'تهيئة تذكير قبل الاستحقاق',
  };
  return labels[action];
}

export default function FollowUpQueueScreen() {
  const router = useRouter();
  const { session, isPreviewMode } = useAuth();
  const params = useLocalSearchParams<{ businessId?: string; businessName?: string }>();
  const businessId = param(params.businessId);
  const businessName = param(params.businessName) || 'النشاط';
  const [rows, setRows] = useState<readonly CollectionTodayPlanRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);

  useFocusEffect(useCallback(() => {
    if (!businessId) return undefined;
    let active = true;
    setLoading(true);
    setError(null);
    void listCollectionTodayPlan({ businessId, limit: 100, dueSoonDays: 7 })
      .then((result) => { if (active) setRows(result); })
      .catch((cause: unknown) => { if (active) setError(message(cause)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [businessId, refreshNonce]));

  const metrics = useMemo(() => ({
    urgent: rows.filter((row) => row.priorityBucket === 'urgent').length,
    high: rows.filter((row) => row.priorityBucket === 'high').length,
    promises: rows.filter((row) => row.reasonCode === 'broken_promise' || row.reasonCode === 'promise_due_today').length,
  }), [rows]);

  if (!session) return <Redirect href="/sign-in" />;
  if (!businessId) return <Redirect href="/home" />;

  return (
    <SecondaryShell title="خطة المتابعة اليوم" subtitle={businessName} onBack={() => router.back()}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Surface variant="tinted">
          <Text style={styles.title}>الأولوية الآن مبنية على الاستحقاق + تاريخ التواصل.</Text>
          <Text style={styles.body}>الخطة لا تقارن مبالغ العملات ببعضها. الوعد بالسداد أو محاولة الاتصال يغيّران ترتيب المتابعة فقط، ولا يغيران الرصيد المالي.</Text>
        </Surface>

        {isPreviewMode ? <InlineFeedback tone="info">Preview لا يحتوي استحقاقات إنتاج حقيقية؛ سجل التواصل التجريبي متاح من شاشة العميل عند فتحها.</InlineFeedback> : null}
        {error ? <ErrorState message={error} onRetry={() => setRefreshNonce((value) => value + 1)} retryLabel="إعادة التحميل" /> : null}
        {loading ? <LoadingState label="جارٍ بناء خطة اليوم" /> : null}

        {!loading && !error ? (
          <>
            <MetricStrip items={[
              { label: 'عاجل', value: String(metrics.urgent) },
              { label: 'أولوية عالية', value: String(metrics.high) },
              { label: 'وعود تحتاج انتباه', value: String(metrics.promises) },
            ]} />

            <View style={styles.section}>
              <SectionHeading title="خطة التنفيذ" caption="الأسباب واضحة وقابلة للتدقيق؛ لا يوجد ترتيب غامض مبني على AI غير مفسر." />
              {rows.length === 0 ? <EmptyState title="لا توجد متابعة في الخطة" message="لا توجد استحقاقات أو وعود أو إجراءات مجدولة ضمن نافذة اليوم." /> : null}
              <View style={styles.list}>
                {rows.map((row) => {
                  const priority = priorityMeta(row.priorityBucket);
                  return (
                    <Pressable
                      key={row.accountId}
                      onPress={() => router.push({
                        pathname: '/business/[businessId]/collection-contact',
                        params: { businessId, businessName, businessCustomerId: row.businessCustomerId, accountId: row.accountId, displayName: row.displayName, currencyCode: row.currencyCode },
                      })}
                      style={({ pressed }) => pressed ? styles.pressed : undefined}
                    >
                      <Surface variant={row.priorityBucket === 'urgent' ? 'tinted' : 'outlined'}>
                        <View style={styles.rowTop}>
                          <View style={styles.nameWrap}>
                            <Text style={styles.name}>{row.displayName}</Text>
                            <View style={styles.badges}><StatusBadge tone={priority.tone}>{priority.label}</StatusBadge><StatusBadge tone="neutral">{String(row.priorityScore)}</StatusBadge></View>
                          </View>
                          <Text style={styles.amount}>{formatMinorUnits(row.balanceMinor, row.currencyCode)}</Text>
                        </View>
                        <Text style={styles.action}>{actionLabel(row.recommendedAction)}</Text>
                        <View style={styles.metaGrid}>
                          <Text style={styles.metaText}>الاستحقاق: {new Date(row.oldestDueAt).toLocaleDateString('en-GB')}</Text>
                          {row.daysOverdue > 0 ? <Text style={styles.dangerText}>متجاوز للمهلة منذ {String(row.daysOverdue)} يوم</Text> : null}
                          {row.lastFollowUpAt ? <Text style={styles.metaText}>آخر متابعة: {new Date(row.lastFollowUpAt).toLocaleDateString('en-GB')}</Text> : <Text style={styles.metaText}>لا توجد متابعة سابقة</Text>}
                          {row.promisedFor ? <Text style={styles.promiseText}>وعد بالسداد: {new Date(`${row.promisedFor}T00:00:00`).toLocaleDateString('en-GB')}</Text> : null}
                          {row.nextActionAt ? <Text style={styles.metaText}>إجراء مجدول: {new Date(row.nextActionAt).toLocaleDateString('en-GB')}</Text> : null}
                        </View>
                        <Text style={styles.openHint}>اضغط لتسجيل نتيجة المتابعة أو وعد جديد</Text>
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
  title: { color: theme.colors.text, fontSize: theme.typography.styles.heading.fontSize, fontWeight: '800', textAlign: 'right', writingDirection: 'rtl' },
  body: { color: theme.colors.textMuted, marginTop: theme.spacing.sm, lineHeight: 24, textAlign: 'right', writingDirection: 'rtl' },
  section: { gap: theme.spacing.md },
  list: { gap: theme.spacing.sm },
  rowTop: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'flex-start', gap: theme.spacing.md },
  nameWrap: { flex: 1, gap: theme.spacing.xs, alignItems: 'flex-end' },
  name: { color: theme.colors.text, fontWeight: '800', fontSize: theme.typography.styles.bodyStrong.fontSize, textAlign: 'right', writingDirection: 'rtl' },
  badges: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: theme.spacing.xs },
  amount: { color: theme.colors.text, fontWeight: '800', writingDirection: 'ltr' },
  action: { color: theme.colors.accent, fontWeight: '800', marginTop: theme.spacing.md, textAlign: 'right', writingDirection: 'rtl' },
  metaGrid: { gap: theme.spacing.xs, marginTop: theme.spacing.sm },
  metaText: { color: theme.colors.textMuted, fontSize: theme.typography.caption, textAlign: 'right', writingDirection: 'rtl' },
  dangerText: { color: theme.colors.danger, fontSize: theme.typography.caption, fontWeight: '700', textAlign: 'right', writingDirection: 'rtl' },
  promiseText: { color: theme.colors.warning, fontSize: theme.typography.caption, fontWeight: '700', textAlign: 'right', writingDirection: 'rtl' },
  openHint: { color: theme.colors.accent, fontSize: theme.typography.caption, fontWeight: '700', marginTop: theme.spacing.md, textAlign: 'right', writingDirection: 'rtl' },
  pressed: { opacity: 0.72 },
});
