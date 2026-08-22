import type { FollowUpState, TodayFollowUpRecord } from '../../../../../packages/application/src/credit-followup';
import { Redirect, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../../../src/features/auth/auth-context';
import { listTodayFollowUps } from '../../../src/lib/credit-followup';
import { formatMinorUnits } from '../../../src/lib/money-display';
import { EmptyState, ErrorState, InlineFeedback, LoadingState, Surface } from '../../../src/ui/primitives';
import { MetricStrip, SectionHeading, StatusBadge } from '../../../src/ui/operational-primitives';
import { SecondaryShell } from '../../../src/ui/secondary-shell';
import { theme } from '../../../src/ui/theme';

function param(value: string | string[] | undefined): string { return Array.isArray(value) ? (value[0] ?? '') : (value ?? ''); }
function message(error: unknown): string { return error instanceof Error && error.message ? error.message : 'تعذر تحميل قائمة المتابعة.'; }
function meta(state: FollowUpState) {
  if (state === 'overdue') return { label: 'متأخر بعد المهلة', tone: 'danger' as const };
  if (state === 'due_today') return { label: 'مستحق اليوم', tone: 'warning' as const };
  return { label: 'مستحق قريبًا', tone: 'info' as const };
}

export default function FollowUpQueueScreen() {
  const router = useRouter();
  const { session, isPreviewMode } = useAuth();
  const params = useLocalSearchParams<{ businessId?: string; businessName?: string }>();
  const businessId = param(params.businessId);
  const businessName = param(params.businessName) || 'النشاط';
  const [rows, setRows] = useState<readonly TodayFollowUpRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);

  useFocusEffect(useCallback(() => {
    if (!businessId) return undefined;
    let active = true;
    setLoading(true);
    setError(null);
    void listTodayFollowUps({ businessId, limit: 100, dueSoonDays: 7 })
      .then((result) => { if (active) setRows(result); })
      .catch((cause: unknown) => { if (active) setError(message(cause)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [businessId, refreshNonce]));

  const metrics = useMemo(() => ({
    overdue: rows.filter((row) => row.followUpState === 'overdue').length,
    today: rows.filter((row) => row.followUpState === 'due_today').length,
    soon: rows.filter((row) => row.followUpState === 'due_soon').length,
  }), [rows]);

  if (!session) return <Redirect href="/sign-in" />;
  if (!businessId) return <Redirect href="/home" />;

  return (
    <SecondaryShell title="متابعة اليوم" subtitle={businessName} onBack={() => router.back()}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Surface variant="tinted">
          <Text style={styles.title}>من يحتاج المتابعة اليوم، ولماذا؟</Text>
          <Text style={styles.body}>الترتيب يعتمد على تاريخ الاستحقاق والمهلة الزمنية، وليس مقارنة مبالغ من عملات مختلفة. الرصيد المعروض هو رصيد الحساب الحالي، وليس ادعاءً بأنه مبلغ فاتورة بعينها.</Text>
        </Surface>

        {isPreviewMode ? <InlineFeedback tone="info">المعاينة لا تحتوي شروط ائتمان تاريخية حقيقية؛ ستظهر القائمة بعد استخدام بيانات إنتاج موثقة.</InlineFeedback> : null}
        {error ? <ErrorState message={error} onRetry={() => setRefreshNonce((value) => value + 1)} retryLabel="إعادة التحميل" /> : null}
        {loading ? <LoadingState label="جارٍ ترتيب أولويات المتابعة" /> : null}

        {!loading && !error ? (
          <>
            <MetricStrip items={[
              { label: 'متأخر', value: String(metrics.overdue) },
              { label: 'اليوم', value: String(metrics.today) },
              { label: 'قريبًا', value: String(metrics.soon) },
            ]} />

            <View style={styles.section}>
              <SectionHeading title="قائمة الأولوية" caption="الأقدم استحقاقًا يظهر أولًا داخل كل درجة أولوية." />
              {rows.length === 0 ? <EmptyState title="لا توجد متابعة مستحقة" message="لا توجد حسابات بشروط ائتمان وصلت إلى نافذة المتابعة الحالية." /> : null}
              <View style={styles.list}>
                {rows.map((row) => {
                  const state = meta(row.followUpState);
                  return (
                    <Pressable
                      key={row.accountId}
                      onPress={() => router.push({ pathname: '/account/[accountId]', params: { accountId: row.accountId, businessId, customerIdentityId: row.customerIdentityId, businessCustomerId: row.businessCustomerId, displayName: row.displayName, currencyCode: row.currencyCode } })}
                      style={({ pressed }) => pressed ? styles.pressed : undefined}
                    >
                      <Surface variant="outlined">
                        <View style={styles.rowTop}>
                          <View style={styles.nameWrap}><Text style={styles.name}>{row.displayName}</Text><StatusBadge tone={state.tone}>{state.label}</StatusBadge></View>
                          <Text style={styles.amount}>{formatMinorUnits(row.balanceMinor, row.currencyCode)}</Text>
                        </View>
                        <View style={styles.metaGrid}>
                          <Text style={styles.metaText}>الاستحقاق: {new Date(row.oldestDueAt).toLocaleDateString('en-GB')}</Text>
                          <Text style={styles.metaText}>الشروط: {String(row.termsDays)} يوم + مهلة {String(row.graceDays)}</Text>
                          {row.followUpState === 'overdue' ? <Text style={styles.dangerText}>متجاوز للمهلة منذ {String(row.daysOverdue)} يوم</Text> : null}
                          {row.lastMovementAt ? <Text style={styles.metaText}>آخر حركة: {new Date(row.lastMovementAt).toLocaleDateString('en-GB')}</Text> : null}
                        </View>
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
  amount: { color: theme.colors.text, fontWeight: '800', writingDirection: 'ltr' },
  metaGrid: { gap: theme.spacing.xs, marginTop: theme.spacing.md },
  metaText: { color: theme.colors.textMuted, fontSize: theme.typography.caption, textAlign: 'right', writingDirection: 'rtl' },
  dangerText: { color: theme.colors.danger, fontSize: theme.typography.caption, fontWeight: '700', textAlign: 'right', writingDirection: 'rtl' },
  pressed: { opacity: 0.72 },
});
