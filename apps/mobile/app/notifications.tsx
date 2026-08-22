import type { NotificationRecord } from '../../../packages/application/src/ports';
import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../src/features/auth/auth-context';
import { ibex } from '../src/lib/ibex';
import { EmptyState, ErrorState, LoadingState, Surface } from '../src/ui/primitives';
import { ProductShell } from '../src/ui/product-shell';
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

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      setError(null);
      void ibex
        .listNotifications({ limit: 100 })
        .then((rows) => {
          if (active) setNotifications(rows);
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
    }, [refreshKey]),
  );

  if (!session) return <Redirect href="/sign-in" />;

  const markRead = (notification: NotificationRecord) => {
    if (notification.readAt || markingId) return;
    setMarkingId(notification.notificationId);
    setError(null);
    void ibex
      .markNotificationRead({ notificationId: notification.notificationId })
      .then(() => setRefreshKey((value) => value + 1))
      .catch((markError: unknown) => setError(errorMessage(markError)))
      .finally(() => setMarkingId(null));
  };

  const unreadNotifications = notifications.reduce(
    (count, notification) => count + (notification.readAt ? 0 : 1),
    0,
  );

  return (
    <ProductShell
      activeTab="notifications"
      onHomePress={() => router.replace('/home')}
      onNotificationsPress={() => undefined}
      subtitle={isPreviewMode ? 'بيانات العرض المحلية' : 'الحركات والمراجعات المهمة'}
      title="الإشعارات"
      unreadNotifications={unreadNotifications}
    >
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={styles.intro}>
          <Text style={styles.introTitle}>ما يحتاج انتباهك، دون ضوضاء.</Text>
          <Text style={styles.introBody}>
            تظهر هنا الحركات الجديدة وطلبات المراجعة المرتبطة بحساباتك، مرتبة في مساحة واحدة واضحة.
          </Text>
        </View>

        {error ? (
          <ErrorState
            message={error}
            onRetry={() => setRefreshKey((value) => value + 1)}
            retryLabel="إعادة التحميل"
          />
        ) : null}

        {loading ? <LoadingState label="جارٍ تحميل الإشعارات" /> : null}

        {!loading && !error && notifications.length === 0 ? (
          <EmptyState
            message="ستظهر هنا الحركات الجديدة وطلبات المراجعة المهمة عند حدوثها."
            title="لا توجد إشعارات"
          />
        ) : null}

        {!loading && !error && notifications.length > 0 ? (
          <View style={styles.list}>
            {notifications.map((notification) => {
              const copy = notificationCopy(notification);
              const unread = !notification.readAt;
              const isUpdating = markingId === notification.notificationId;

              return (
                <Pressable
                  accessibilityRole="button"
                  disabled={!unread || markingId !== null}
                  key={notification.notificationId}
                  onPress={() => markRead(notification)}
                  style={({ pressed }) => [pressed ? styles.pressed : null]}
                >
                  <Surface variant={unread ? 'tinted' : 'outlined'}>
                    <View style={styles.cardHeader}>
                      <View style={styles.titleWrap}>
                        <Text style={styles.title}>{copy.title}</Text>
                        <Text style={styles.body}>{copy.body}</Text>
                      </View>
                      {unread ? <View style={styles.unreadDot} /> : null}
                    </View>

                    <View style={styles.metaRow}>
                      <Text style={styles.date}>
                        {new Date(notification.createdAt).toLocaleString('en-GB')}
                      </Text>
                      <Text style={styles.readState}>
                        {isUpdating
                          ? 'جارٍ التحديث…'
                          : unread
                            ? 'اضغط لتحديده كمقروء'
                            : 'مقروء'}
                      </Text>
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
  content: {
    gap: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  intro: {
    gap: theme.spacing.xs,
  },
  introTitle: {
    color: theme.colors.text,
    fontSize: theme.typography.styles.title.fontSize,
    lineHeight: theme.typography.styles.title.lineHeight,
    fontWeight: theme.typography.styles.title.fontWeight,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  introBody: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.styles.body.fontSize,
    lineHeight: theme.typography.styles.body.lineHeight,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  list: {
    gap: theme.spacing.sm,
  },
  pressed: {
    opacity: 0.72,
  },
  cardHeader: {
    flexDirection: 'row-reverse',
    alignItems: 'flex-start',
    gap: theme.spacing.sm,
  },
  titleWrap: {
    flex: 1,
    gap: theme.spacing.xxs,
  },
  title: {
    color: theme.colors.text,
    fontSize: theme.typography.styles.bodyStrong.fontSize,
    lineHeight: theme.typography.styles.bodyStrong.lineHeight,
    fontWeight: theme.typography.styles.bodyStrong.fontWeight,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  body: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.styles.caption.fontSize,
    lineHeight: theme.typography.styles.caption.lineHeight,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  unreadDot: {
    width: 8,
    height: 8,
    marginTop: theme.spacing.xs,
    borderRadius: theme.radius.full,
    backgroundColor: theme.colors.accent,
  },
  metaRow: {
    flexDirection: 'row-reverse',
    justifyContent: 'space-between',
    gap: theme.spacing.sm,
    marginTop: theme.spacing.md,
  },
  date: {
    color: theme.colors.textSubtle,
    fontSize: theme.typography.styles.caption.fontSize,
    lineHeight: theme.typography.styles.caption.lineHeight,
    writingDirection: 'ltr',
  },
  readState: {
    flex: 1,
    color: theme.colors.textMuted,
    fontSize: theme.typography.styles.caption.fontSize,
    lineHeight: theme.typography.styles.caption.lineHeight,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
});
