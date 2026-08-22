import type { BusinessDisputeRecord } from '../../../../../packages/application/src/ports';
import { Redirect, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../../../src/features/auth/auth-context';
import { ibex } from '../../../src/lib/ibex';
import { AppScreen, ErrorMessage, Heading } from '../../../src/ui/primitives';
import { theme } from '../../../src/ui/theme';

function param(value: string | string[] | undefined): string { return Array.isArray(value) ? (value[0] ?? '') : (value ?? ''); }
function message(error: unknown): string { return error instanceof Error && error.message ? error.message : 'تعذر تحميل طلبات المراجعة.'; }
function statusLabel(status: BusinessDisputeRecord['status']): string {
  return { open: 'جديد', under_review: 'قيد المراجعة', resolved: 'تمت المعالجة', rejected: 'مرفوض', withdrawn: 'مسحوب' }[status];
}

export default function BusinessDisputesScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ businessId?: string; businessName?: string }>();
  const businessId = param(params.businessId);
  const businessName = param(params.businessName) || 'النشاط';
  const { session } = useAuth();
  const [rows, setRows] = useState<readonly BusinessDisputeRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    setError(null);
    void ibex.listBusinessDisputes({ businessId, limit: 100 }).then((items) => { if (active) setRows(items); }).catch((loadError: unknown) => { if (active) setError(message(loadError)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [businessId]));

  if (!session) return <Redirect href="/sign-in" />;
  if (!businessId) return <Redirect href="/home" />;

  return (
    <AppScreen>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={() => router.back()} style={styles.backButton}><Text style={styles.backText}>رجوع</Text></Pressable>
        <Heading title="طلبات المراجعة" subtitle={`${businessName} · الاعتراض لا يغير الحركة المالية تلقائيًا.`} />
        <ErrorMessage message={error} />
        {loading ? <ActivityIndicator color={theme.colors.primary} style={styles.loader} /> : null}
        <View style={styles.list}>
          {rows.map((row) => (
            <Pressable
              key={row.disputeId}
              onPress={() => router.push({ pathname: '/business/[businessId]/dispute/[disputeId]', params: { businessId, businessName, disputeId: row.disputeId, customerName: row.customerName, status: row.status, reason: row.reason, resolutionNote: row.resolutionNote ?? '' } })}
              style={({ pressed }) => [styles.card, pressed ? styles.pressed : null]}
            >
              <View style={styles.top}><Text style={styles.name}>{row.customerName}</Text><Text style={styles.status}>{statusLabel(row.status)}</Text></View>
              <Text style={styles.reason} numberOfLines={3}>{row.reason}</Text>
              <Text style={styles.date}>{new Date(row.createdAt).toLocaleDateString('en-GB')}</Text>
            </Pressable>
          ))}
        </View>
        {!loading && rows.length === 0 ? <View style={styles.empty}><Text style={styles.emptyText}>لا توجد طلبات مراجعة حاليًا.</Text></View> : null}
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: theme.spacing.xl },
  backButton: { alignSelf: 'flex-start', paddingVertical: theme.spacing.sm, marginBottom: theme.spacing.md },
  backText: { color: theme.colors.textMuted, fontWeight: '700', writingDirection: 'rtl' },
  loader: { marginVertical: theme.spacing.lg },
  list: { gap: theme.spacing.sm },
  card: { padding: theme.spacing.lg, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.lg, backgroundColor: theme.colors.surface },
  pressed: { opacity: 0.72 },
  top: { flexDirection: 'row-reverse', justifyContent: 'space-between', gap: theme.spacing.md },
  name: { color: theme.colors.text, fontWeight: '800', textAlign: 'right', writingDirection: 'rtl' },
  status: { color: theme.colors.primary, fontSize: theme.typography.caption, fontWeight: '700', writingDirection: 'rtl' },
  reason: { color: theme.colors.textMuted, marginTop: theme.spacing.sm, lineHeight: 22, textAlign: 'right', writingDirection: 'rtl' },
  date: { color: theme.colors.textMuted, fontSize: theme.typography.caption, marginTop: theme.spacing.md, writingDirection: 'ltr' },
  empty: { padding: theme.spacing.lg, backgroundColor: theme.colors.surfaceMuted, borderRadius: theme.radius.lg },
  emptyText: { color: theme.colors.textMuted, textAlign: 'right', writingDirection: 'rtl' },
});
