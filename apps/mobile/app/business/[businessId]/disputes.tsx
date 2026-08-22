import type { BusinessDisputeRecord } from '../../../../../packages/application/src/ports';
import { Redirect, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../../../src/features/auth/auth-context';
import { ibex } from '../../../src/lib/ibex';
import { EmptyState, ErrorState, LoadingState, Surface } from '../../../src/ui/primitives';
import { SecondaryShell } from '../../../src/ui/secondary-shell';
import { theme } from '../../../src/ui/theme';

function param(value: string | string[] | undefined): string { return Array.isArray(value) ? (value[0] ?? '') : (value ?? ''); }
function message(error: unknown): string { return error instanceof Error && error.message ? error.message : 'تعذر تحميل طلبات المراجعة.'; }
function statusLabel(status: BusinessDisputeRecord['status']): string { return { open: 'جديد', under_review: 'قيد المراجعة', resolved: 'تمت المعالجة', rejected: 'مرفوض', withdrawn: 'مسحوب' }[status]; }

export default function BusinessDisputesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ businessId?: string; businessName?: string }>();
  const businessId = param(params.businessId);
  const businessName = param(params.businessName) || 'النشاط';
  const { session } = useAuth();
  const [rows, setRows] = useState<readonly BusinessDisputeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    setError(null);
    void ibex.listBusinessDisputes({ businessId, limit: 100 }).then((items) => { if (active) setRows(items); }).catch((loadError: unknown) => { if (active) setError(message(loadError)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [businessId, refreshNonce]));

  const openCount = useMemo(() => rows.filter((row) => row.status === 'open' || row.status === 'under_review').length, [rows]);

  if (!session) return <Redirect href="/sign-in" />;
  if (!businessId) return <Redirect href="/home" />;

  return (
    <SecondaryShell title="طلبات المراجعة" subtitle={businessName} onBack={() => router.back()}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Surface variant="tinted">
          <View style={styles.metricsRow}>
            <View style={styles.metric}><Text style={styles.metricValue}>{String(openCount)}</Text><Text style={styles.metricLabel}>تحتاج متابعة</Text></View>
            <View style={styles.metricDivider} />
            <View style={styles.metric}><Text style={styles.metricValue}>{String(rows.length)}</Text><Text style={styles.metricLabel}>إجمالي الطلبات</Text></View>
          </View>
          <Text style={styles.policyText}>المراجعة لا تغيّر Ledger تلقائيًا؛ أي تصحيح مالي يمر عبر إجراء مالي صريح وقابل للتدقيق.</Text>
        </Surface>

        {error ? <ErrorState message={error} onRetry={() => setRefreshNonce((value) => value + 1)} /> : null}
        {loading ? <LoadingState label="جارٍ تحميل طلبات المراجعة" /> : null}
        {!loading && !error && rows.length === 0 ? <EmptyState title="لا توجد طلبات مراجعة" message="ستظهر هنا اعتراضات العملاء عندما تحتاج إلى متابعة." /> : null}

        <View style={styles.list}>
          {rows.map((row) => (
            <Pressable accessibilityRole="button" key={row.disputeId} onPress={() => router.push({ pathname: '/business/[businessId]/dispute/[disputeId]', params: { businessId, businessName, disputeId: row.disputeId, customerName: row.customerName, status: row.status, reason: row.reason, resolutionNote: row.resolutionNote ?? '' } })} style={({ pressed }) => [pressed ? styles.pressed : null]}>
              <Surface variant="outlined">
                <View style={styles.top}><Text style={styles.name}>{row.customerName}</Text><Text style={styles.status}>{statusLabel(row.status)}</Text></View>
                <Text style={styles.reason} numberOfLines={3}>{row.reason}</Text>
                <View style={styles.footer}><Text style={styles.date}>{new Date(row.createdAt).toLocaleDateString('en-GB')}</Text><Text style={styles.chevron}>‹</Text></View>
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
  policyText: { color: theme.colors.textMuted, fontSize: theme.typography.caption, lineHeight: 21, marginTop: theme.spacing.md, textAlign: 'right', writingDirection: 'rtl' },
  list: { gap: theme.spacing.sm },
  pressed: { opacity: 0.72 },
  top: { flexDirection: 'row-reverse', justifyContent: 'space-between', gap: theme.spacing.md },
  name: { color: theme.colors.text, fontWeight: '800', textAlign: 'right', writingDirection: 'rtl' },
  status: { color: theme.colors.accent, fontSize: theme.typography.caption, fontWeight: '700', writingDirection: 'rtl' },
  reason: { color: theme.colors.textMuted, marginTop: theme.spacing.sm, lineHeight: 22, textAlign: 'right', writingDirection: 'rtl' },
  footer: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginTop: theme.spacing.md },
  date: { color: theme.colors.textMuted, fontSize: theme.typography.caption, writingDirection: 'ltr' },
  chevron: { color: theme.colors.textMuted, fontSize: 24, writingDirection: 'ltr' },
});
