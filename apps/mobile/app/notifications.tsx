import type { NotificationRecord } from '../../../packages/application/src/ports';
import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../src/features/auth/auth-context';
import { ibex } from '../src/lib/ibex';
import { EmptyState, ErrorState, LoadingState, Surface } from '../src/ui/primitives';
import { MetricStrip, StatusBadge } from '../src/ui/operational-primitives';
import { ProductShell } from '../src/ui/product-shell';
import { theme } from '../src/ui/theme';

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : 'تعذر تحميل الإشعارات.';
}

function transactionLabel(type: NotificationRecord['transactionType']): string {
  const labels: Partial<Record<NotificationRecord['transactionType'], string>> = {
    sale_on_account: 'بيع آجل', receipt: 'قبض', reversal: 'عكس حركة', opening_balance: 'رصيد افتتاحي',
    return: 'مرتجع', discount: 'خصم', disbursement: 'صرف', adjustment: 'تسوية',
  };
  return labels[type] ?? type;
}

function notificationCopy(notification: NotificationRecord): { title: string; body: string } {
  if (notification.kind === 'transaction_posted') return { title: 'حركة جديدة', body: `${notification.businessName} · ${transactionLabel(notification.transactionType)}` };
  if (notification.kind === 'dispute_opened') return { title: 'طلب مراجعة جديد', body: `${notification.businessName} · توجد حركة طلب العميل مراجعتها.` };
  return {
    title: notification.disputeStatus === 'rejected' ? 'تم رفض طلب المراجعة' : 'تمت معالجة طلب المراجعة',
    body: `${notification.businessName} · ${transactionLabel(notification.transactionType)}`,
  };
}

type FilterKey = 'all' | 'unread' | 'reviews' | 'movements';

export default function NotificationsScreen() {
  const router = useRouter();
  const { session, isPreviewMode } = useAuth();
  const [notifications, setNotifications] = useState<readonly NotificationRecord[]>([]);
  const [filter, setFilter] = useState<FilterKey>('all');
  const [loading, setLoading] = useState(true);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    setError(null);
    void ibex.listNotifications({ limit: 100 })
      .then((rows) => { if (active) setNotifications(rows); })
      .catch((loadError: unknown) => { if (active) setError(errorMessage(loadError)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [refreshKey]));

  if (!session) return <Redirect href="/sign-in" />;

  const markRead = (notification: NotificationRecord) => {
    if (notification.readAt || markingId) return;
    setMarkingId(notification.notificationId);
    setError(null);
    void ibex.markNotificationRead({ notificationId: notification.notificationId })
      .then(() => setRefreshKey((value) => value + 1))
      .catch((markError: unknown) => setError(errorMessage(markError)))
      .finally(() => setMarkingId(null));
  };

  const unread = notifications.filter((row) => !row.readAt).length;
  const reviews = notifications.filter((row) => row.kind !== 'transaction_posted').length;
  const movements = notifications.filter((row) => row.kind === 'transaction_posted').length;

  const visible = useMemo(() => notifications.filter((row) => {
    if (filter === 'unread') return !row.readAt;
    if (filter === 'reviews') return row.kind !== 'transaction_posted';
    if (filter === 'movements') return row.kind === 'transaction_posted';
    return true;
  }), [filter, notifications]);

  const filters: readonly { key: FilterKey; label: string }[] = [
    { key: 'all', label: 'الكل' }, { key: 'unread', label: 'غير المقروء' }, { key: 'reviews', label: 'المراجعات' }, { key: 'movements', label: 'الحركات' },
  ];

  return (
    <ProductShell
      activeTab="notifications"
      onHomePress={() => router.replace('/home')}
      onNotificationsPress={() => undefined}
      subtitle={isPreviewMode ? 'بيانات العرض المحلية' : 'الحركات والمراجعات المهمة'}
      title="الإشعارات"
      unreadNotifications={unread}
    >
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.intro}>
          <Text style={styles.introTitle}>صندوق انتباه، لا صندوق ضوضاء.</Text>
          <Text style={styles.introBody}>صفِّ ما يهمك بين الحركات، المراجعات وغير المقروء، مع إبقاء سجل الأحداث واضحًا.</Text>
        </View>

        {!loading && !error ? (
          <MetricStrip items={[
            { label: 'غير مقروء', value: String(unread) },
            { label: 'مراجعات', value: String(reviews) },
            { label: 'حركات', value: String(movements) },
          ]} />
        ) : null}

        <ScrollView horizontal contentContainerStyle={styles.filters} showsHorizontalScrollIndicator={false}>
          {filters.map((item) => (
            <Pressable key={item.key} onPress={() => setFilter(item.key)} style={({ pressed }) => [styles.filterButton, filter === item.key ? styles.filterActive : null, pressed ? styles.pressed : null]}>
              <Text style={[styles.filterText, filter === item.key ? styles.filterTextActive : null]}>{item.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        {error ? <ErrorState message={error} onRetry={() => setRefreshKey((value) => value + 1)} retryLabel="إعادة التحميل" /> : null}
        {loading ? <LoadingState label="جارٍ تحميل الإشعارات" /> : null}

        {!loading && !error && visible.length === 0 ? (
          <EmptyState message={notifications.length === 0 ? 'ستظهر هنا الحركات الجديدة وطلبات المراجعة المهمة عند حدوثها.' : 'لا توجد عناصر ضمن هذا التصنيف.'} title="لا توجد نتائج" />
        ) : null}

        {!loading && !error && visible.length > 0 ? (
          <View style={styles.list}>
            {visible.map((notification) => {
              const copy = notificationCopy(notification);
              const isUnread = !notification.readAt;
              const isUpdating = markingId === notification.notificationId;
              const reviewKind = notification.kind !== 'transaction_posted';
              return (
                <Pressable accessibilityRole="button" disabled={!isUnread || markingId !== null} key={notification.notificationId} onPress={() => markRead(notification)} style={({ pressed }) => [pressed ? styles.pressed : null]}>
                  <Surface variant={isUnread ? 'tinted' : 'outlined'}>
                    <View style={styles.cardHeader}>
                      <View style={styles.titleWrap}>
                        <View style={styles.titleRow}>
                          <Text style={styles.title}>{copy.title}</Text>
                          <StatusBadge tone={reviewKind ? 'warning' : 'info'}>{reviewKind ? 'مراجعة' : 'حركة'}</StatusBadge>
                        </View>
                        <Text style={styles.body}>{copy.body}</Text>
                      </View>
                      {isUnread ? <View style={styles.unreadDot} /> : null}
                    </View>
                    <View style={styles.metaRow}>
                      <Text style={styles.date}>{new Date(notification.createdAt).toLocaleString('en-GB')}</Text>
                      <Text style={styles.readState}>{isUpdating ? 'جارٍ التحديث…' : isUnread ? 'اضغط لتحديده كمقروء' : 'مقروء'}</Text>
                    </View>
                  </Surface>
                </Pressable>
              );
            })}
          </View>
        ) : null}
      </ScrollView>
    </ProductShell>
  );
}

const styles = StyleSheet.create({
  content: { gap: theme.spacing.lg, paddingTop: theme.spacing.lg, paddingBottom: theme.spacing.xl },
  intro: { gap: theme.spacing.xs },
  introTitle: { color: theme.colors.text, fontSize: theme.typography.styles.title.fontSize, lineHeight: theme.typography.styles.title.lineHeight, fontWeight: theme.typography.styles.title.fontWeight, textAlign: 'right', writingDirection: 'rtl' },
  introBody: { color: theme.colors.textMuted, fontSize: theme.typography.styles.body.fontSize, lineHeight: theme.typography.styles.body.lineHeight, textAlign: 'right', writingDirection: 'rtl' },
  filters: { flexDirection: 'row-reverse', gap: theme.spacing.sm },
  filterButton: { minHeight: theme.layout.minTouchTarget, paddingHorizontal: theme.spacing.md, borderRadius: theme.radius.full, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surface },
  filterActive: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  filterText: { color: theme.colors.textMuted, fontSize: theme.typography.styles.label.fontSize, fontWeight: theme.typography.styles.label.fontWeight, writingDirection: 'rtl' },
  filterTextActive: { color: theme.colors.accentText },
  list: { gap: theme.spacing.sm },
  pressed: { opacity: 0.72 },
  cardHeader: { flexDirection: 'row-reverse', alignItems: 'flex-start', gap: theme.spacing.sm },
  titleWrap: { flex: 1, gap: theme.spacing.xs },
  titleRow: { flexDirection: 'row-reverse', alignItems: 'center', gap: theme.spacing.sm },
  title: { flex: 1, color: theme.colors.text, fontSize: theme.typography.styles.bodyStrong.fontSize, lineHeight: theme.typography.styles.bodyStrong.lineHeight, fontWeight: theme.typography.styles.bodyStrong.fontWeight, textAlign: 'right', writingDirection: 'rtl' },
  body: { color: theme.colors.textMuted, fontSize: theme.typography.styles.caption.fontSize, lineHeight: theme.typography.styles.caption.lineHeight, textAlign: 'right', writingDirection: 'rtl' },
  unreadDot: { width: 8, height: 8, marginTop: theme.spacing.xs, borderRadius: theme.radius.full, backgroundColor: theme.colors.accent },
  metaRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', gap: theme.spacing.sm, marginTop: theme.spacing.md },
  date: { color: theme.colors.textSubtle, fontSize: theme.typography.styles.caption.fontSize, lineHeight: theme.typography.styles.caption.lineHeight, writingDirection: 'ltr' },
  readState: { flex: 1, color: theme.colors.textMuted, fontSize: theme.typography.styles.caption.fontSize, lineHeight: theme.typography.styles.caption.lineHeight, textAlign: 'right', writingDirection: 'rtl' },
});
