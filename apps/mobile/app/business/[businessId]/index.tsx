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
import {
  AppBar,
  AppScreen,
  Button,
  ErrorState,
  InlineFeedback,
  LoadingState,
  Surface,
} from '../../../src/ui/primitives';
import { theme } from '../../../src/ui/theme';

function param(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message
    ? error.message
    : 'تعذر تحميل مساحة إدارة النشاط.';
}

export default function BusinessWorkspaceScreen() {
  const router = useRouter();
  const auth = useAuth();
  const params = useLocalSearchParams<{
    businessId?: string;
    businessName?: string;
    currencyCode?: string;
    role?: string;
  }>();
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

  useFocusEffect(
    useCallback(() => {
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
        .catch((loadError: unknown) => {
          if (active) setError(errorMessage(loadError));
        })
        .finally(() => {
          if (active) setLoading(false);
        });

      return () => {
        active = false;
      };
    }, [businessId, refreshNonce]),
  );

  const openDisputes = useMemo(
    () => disputes.filter((row) => row.status === 'open' || row.status === 'under_review').length,
    [disputes],
  );

  if (!auth.session) return <Redirect href="/sign-in" />;
  if (!businessId) return <Redirect href="/home" />;

  return (
    <AppScreen>
      <AppBar
        leading={
          <Pressable
            accessibilityRole="button"
            onPress={() => router.back()}
            style={({ pressed }) => [styles.backButton, pressed ? styles.pressed : null]}
          >
            <Text style={styles.backText}>رجوع</Text>
          </Pressable>
        }
        subtitle={`${currencyCode} · ${role}`}
        title={businessName}
      />

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>مساحة إدارة النشاط</Text>
          <Text style={styles.title}>إدارة العملاء والمتابعة من نقطة واحدة.</Text>
          <Text style={styles.body}>
            هذه الشاشة تجمع أهم مؤشرات التشغيل الحالية دون نقل المنطق المالي إلى الواجهة.
          </Text>
        </View>

        {auth.isPreviewMode ? (
          <InlineFeedback tone="info">
            المؤشرات هنا مأخوذة من Preview Runtime المحلي فقط؛ لا توجد كتابة مالية مباشرة إلى Supabase.
          </InlineFeedback>
        ) : null}

        {error ? (
          <ErrorState
            message={error}
            onRetry={() => setRefreshNonce((value) => value + 1)}
            retryLabel="إعادة التحميل"
          />
        ) : null}

        {loading ? <LoadingState label="جارٍ تحميل بيانات النشاط" /> : null}

        {!loading && !error ? (
          <>
            <Surface variant="outlined">
              <View style={styles.metricsRow}>
                <View style={styles.metric}>
                  <Text style={styles.metricValue}>{String(customers.length)}</Text>
                  <Text style={styles.metricLabel}>عميل</Text>
                </View>
                <View style={styles.metricDivider} />
                <View style={styles.metric}>
                  <Text style={styles.metricValue}>{String(openDisputes)}</Text>
                  <Text style={styles.metricLabel}>مراجعة مفتوحة</Text>
                </View>
                <View style={styles.metricDivider} />
                <View style={styles.metric}>
                  <Text style={styles.metricValue}>{String(notifications.length)}</Text>
                  <Text style={styles.metricLabel}>إشعار جديد</Text>
                </View>
              </View>
            </Surface>

            <View style={styles.actions}>
              <Button
                onPress={() =>
                  router.push({
                    pathname: '/business/[businessId]/customer/new',
                    params: { businessId, businessName },
                  })
                }
              >
                إضافة عميل
              </Button>
              <Button
                onPress={() =>
                  router.push({
                    pathname: '/business/[businessId]/customers',
                    params: { businessId, businessName },
                  })
                }
                variant="secondary"
              >
                فتح العملاء والحسابات
              </Button>
              <Button
                onPress={() =>
                  router.push({
                    pathname: '/business/[businessId]/disputes',
                    params: { businessId, businessName },
                  })
                }
                variant="ghost"
              >
                طلبات المراجعة
              </Button>
            </View>

            <Surface variant="tinted">
              <Text style={styles.noteTitle}>حدود هذه الدفعة</Text>
              <Text style={styles.noteBody}>
                لا نعرض إجماليات مالية مجمعة عبر العملات، ولا ننشئ Dashboard ماليًا مصطنعًا قبل وجود read model خلفي صريح يحافظ على فصل العملات ومصدر الحقيقة.
              </Text>
            </Surface>
          </>
        ) : null}
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: {
    gap: theme.spacing.lg,
    paddingTop: theme.spacing.md,
    paddingBottom: theme.spacing.xl,
  },
  backButton: {
    minWidth: theme.layout.minTouchTarget,
    minHeight: theme.layout.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
  },
  backText: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.styles.label.fontSize,
    lineHeight: theme.typography.styles.label.lineHeight,
    fontWeight: theme.typography.styles.label.fontWeight,
    writingDirection: 'rtl',
  },
  hero: { gap: theme.spacing.xs },
  eyebrow: {
    color: theme.colors.accent,
    fontSize: theme.typography.styles.label.fontSize,
    lineHeight: theme.typography.styles.label.lineHeight,
    fontWeight: theme.typography.styles.label.fontWeight,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  title: {
    color: theme.colors.text,
    fontSize: theme.typography.styles.title.fontSize,
    lineHeight: theme.typography.styles.title.lineHeight,
    fontWeight: theme.typography.styles.title.fontWeight,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  body: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.styles.body.fontSize,
    lineHeight: theme.typography.styles.body.lineHeight,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  metricsRow: {
    flexDirection: 'row-reverse',
    alignItems: 'stretch',
  },
  metric: {
    flex: 1,
    minHeight: 78,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xxs,
  },
  metricDivider: { width: 1, backgroundColor: theme.colors.border },
  metricValue: {
    color: theme.colors.text,
    fontSize: theme.typography.styles.heading.fontSize,
    lineHeight: theme.typography.styles.heading.lineHeight,
    fontWeight: theme.typography.styles.heading.fontWeight,
    writingDirection: 'ltr',
  },
  metricLabel: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.styles.caption.fontSize,
    lineHeight: theme.typography.styles.caption.lineHeight,
    textAlign: 'center',
    writingDirection: 'rtl',
  },
  actions: { gap: theme.spacing.sm },
  noteTitle: {
    color: theme.colors.text,
    fontSize: theme.typography.styles.bodyStrong.fontSize,
    lineHeight: theme.typography.styles.bodyStrong.lineHeight,
    fontWeight: theme.typography.styles.bodyStrong.fontWeight,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  noteBody: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.styles.caption.fontSize,
    lineHeight: theme.typography.styles.caption.lineHeight,
    textAlign: 'right',
    writingDirection: 'rtl',
    marginTop: theme.spacing.xs,
  },
  pressed: { opacity: 0.72 },
});