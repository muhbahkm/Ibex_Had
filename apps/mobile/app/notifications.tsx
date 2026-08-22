import type { NotificationRecord } from '../../../packages/application/src/ports';
import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../src/features/auth/auth-context';
import { ibex } from '../src/lib/ibex';
import { AppScreen, ErrorMessage, Heading } from '../src/ui/primitives';
import { theme } from '../src/ui/theme';

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : 'تعذر تحميل الإشعارات.';
}
function transactionLabel(type: NotificationRecord['transactionType']): string {
  const labels: Partial<Record<NotificationRecord['transactionType'], string>> = {
    sale_on_account: 'بيع آجل',
    receipt: 'قبض',
    reversal: 'عكس حركة',
    opening_balance: 'رصيد افتتاحي',
    return: 'مرتجع',
    discount: 'خصم',
    disbursement: 'صرف',
    adjustment: 'تسوية',
  };
  return labels[type] ?? type;
}
function notificationCopy(notification: NotificationRecord): { title: string; body: string } {
  if (notification.kind === 'transaction_posted') {
    return {
      title: 'حركة جديدة في حسابك',
      body: `${notification.businessName} · ${transactionLabel(notification.transactionType)}`,
    };
  }
  if (notification.kind === 'dispute_opened') {
    return {
      title: 'طلب مراجعة جديد',
      body: `${notification.businessName} · توجد حركة طلب العميل مراجعتها.`,
    };
  }
  return {
    title: notification.disputeStatus === 'rejected' ? 'تم رفض طلب المراجعة' : 'تمت معالجة طلب المراجعة',
    body: `${notification.businessName} · ${transactionLabel(notification.transactionType)}`,
  };
}

export default function NotificationsScreen() {
  const router = useRouter();
  const { session, isPreviewMode } = useAuth();
  const [notifications, setNotifications] = useState<readonly NotificationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [markingId, setMarkingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  useFocusEffect(useCallback(() => {
    if (isPreviewMode) {
      setNotifications([]);
      setLoading(false);
      return undefined;
    }
    let active = true;
    setLoading(true);
    setError(null);
    void ibex.listNotifications({ limit: 100 })
      .then((rows) => { if (active) setNotifications(rows); })
      .catch((loadError: unknown) => { if (active) setError(errorMessage(loadError)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [isPreviewMode, refreshKey]));

  if (!session) return <Redirect href="/sign-in" />;
  if (isPreviewMode) return <Redirect href="/home" />;

  const markRead = (notification: NotificationRecord) => {
    if (notification.readAt || markingId) return;
    setMarkingId(notification.notificationId);
    setError(null);
    void ibex.markNotificationRead({ notificationId: notification.notificationId })
      .then(() => setRefreshKey((value) => value + 1))
      .catch((markError: unknown) => setError(errorMessage(markError)))
      .finally(() => setMarkingId(null));
  };

  return (
    <AppScreen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>رجوع</Text>
        </Pressable>
        <Heading title="الإشعارات" subtitle="الأحداث المهمة في حساباتك وطلبات المراجعة، دون تنبيهات مزعجة." />
        <ErrorMessage message={error} />
        {loading ? <ActivityIndicator color={theme.colors.primary} style={styles.loader} /> : null}

        <View style={styles.list}>
          {notifications.map((notification) => {
            const copy = notificationCopy(notification);
            const unread = !notification.readAt;
            return (
              <Pressable
                key={notification.notificationId}
                disabled={!unread || markingId !== null}
                onPress={() => markRead(notification)}
                style={({ pressed }) => [styles.card, unread ? styles.unreadCard : null, pressed ? styles.pressed : null]}
              >
                <View style={styles.cardHeader}>
                  <Text style={styles.title}>{copy.title}</Text>
                  {unread ? <View style={styles.unreadDot} /> : null}
                </View>
                <Text style={styles.body}>{copy.body}</Text>
                <View style={styles.metaRow}>
                  <Text style={styles.date}>{new Date(notification.createdAt).toLocaleString('en-GB')}</Text>
                  <Text style={styles.readState}>
                    {markingId === notification.notificationId ? 'جارٍ التحديث…' : unread ? 'اضغط لتحديده كمقروء' : 'مقروء'}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>

        {!loading && notifications.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyTitle}>لا توجد إشعارات</Text>
            <Text style={styles.emptyBody}>ستظهر هنا الحركات الجديدة وطلبات المراجعة المهمة عند حدوثها.</Text>
          </View>
        ) : null}
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
  unreadCard: { backgroundColor: theme.colors.surfaceMuted },
  pressed: { opacity: 0.7 },
  cardHeader: { flexDirection: 'row-reverse', alignItems: 'center', gap: theme.spacing.sm },
  title: { flex: 1, color: theme.colors.text, fontWeight: '800', textAlign: 'right', writingDirection: 'rtl' },
  unreadDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: theme.colors.primary },
  body: { color: theme.colors.textMuted, marginTop: theme.spacing.xs, textAlign: 'right', writingDirection: 'rtl' },
  metaRow: { flexDirection: 'row-reverse', justifyContent: 'space-between', gap: theme.spacing.sm, marginTop: theme.spacing.md },
  date: { color: theme.colors.textMuted, fontSize: theme.typography.caption, writingDirection: 'ltr' },
  readState: { color: theme.colors.textMuted, fontSize: theme.typography.caption, textAlign: 'right', writingDirection: 'rtl' },
  emptyCard: { padding: theme.spacing.lg, borderRadius: theme.radius.lg, backgroundColor: theme.colors.surfaceMuted },
  emptyTitle: { color: theme.colors.text, fontWeight: '800', textAlign: 'right', writingDirection: 'rtl' },
  emptyBody: { color: theme.colors.textMuted, marginTop: theme.spacing.sm, textAlign: 'right', writingDirection: 'rtl' },
});
