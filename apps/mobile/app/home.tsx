import type {
  BusinessSummaryRecord,
  MyCustomerAccountRecord,
} from '../../../packages/application/src/ports';
import { Redirect, useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../src/features/auth/auth-context';
import { ibex } from '../src/lib/ibex';
import { formatMinorUnits } from '../src/lib/money-display';
import {
  Button,
  EmptyState,
  ErrorState,
  InlineFeedback,
  LoadingState,
  Surface,
} from '../src/ui/primitives';
import { ProductShell } from '../src/ui/product-shell';
import { theme } from '../src/ui/theme';

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.message) return error.message;
  return 'تعذر تحميل مساحة العمل.';
}

export default function HomeScreen() {
  const router = useRouter();
  const auth = useAuth();
  const { session, isPreviewMode } = auth;
  const [businesses, setBusinesses] = useState<readonly BusinessSummaryRecord[]>([]);
  const [myAccounts, setMyAccounts] = useState<readonly MyCustomerAccountRecord[]>([]);
  const [unreadNotifications, setUnreadNotifications] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      setError(null);

      void Promise.all([
        ibex.listBusinesses(),
        ibex.listMyCustomerAccounts(),
        ibex.listNotifications({ unreadOnly: true, limit: 100 }),
      ])
        .then(([businessRows, accountRows, notificationRows]) => {
          if (!active) return;
          setBusinesses(businessRows);
          setMyAccounts(accountRows);
          setUnreadNotifications(notificationRows.length);
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
    }, [refreshNonce]),
  );

  if (!session) return <Redirect href="/sign-in" />;

  const logout = () => {
    void auth.signOut();
  };

  return (
    <ProductShell
      activeTab="home"
      onHomePress={() => undefined}
      onNotificationsPress={() => router.push('/notifications')}
      subtitle={isPreviewMode ? 'وضع العرض الآمن' : 'مساحة العمل'}
      title="IBEX HAD"
      trailing={
        <Pressable
          accessibilityRole="button"
          onPress={logout}
          style={({ pressed }) => [styles.headerAction, pressed ? styles.pressed : null]}
        >
          <Text style={styles.headerActionText}>خروج</Text>
        </Pressable>
      }
      unreadNotifications={unreadNotifications}
    >
      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.hero}>
          <Text style={styles.eyebrow}>مساحتك المالية</Text>
          <Text style={styles.heroTitle}>كل ما تحتاجه للوصول إلى حساباتك وأنشطتك بسرعة.</Text>
          <Text style={styles.heroBody}>
            واجهة واحدة للحسابات، الأنشطة، الحركات المهمة والإشعارات، مع فصل واضح بين تجربة العميل وإدارة النشاط.
          </Text>
        </View>

        {isPreviewMode ? (
          <InlineFeedback tone="info">
            وضع العرض يستخدم بيانات محلية تجريبية فقط، ولا يرسل أي حركة مالية إلى Supabase.
          </InlineFeedback>
        ) : null}

        <Surface variant="outlined">
          <View style={styles.metricsRow}>
            <View style={styles.metric}>
              <Text style={styles.metricValue}>{String(businesses.length)}</Text>
              <Text style={styles.metricLabel}>نشاط</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metric}>
              <Text style={styles.metricValue}>{String(myAccounts.length)}</Text>
              <Text style={styles.metricLabel}>حساب</Text>
            </View>
            <View style={styles.metricDivider} />
            <View style={styles.metric}>
              <Text style={styles.metricValue}>{String(unreadNotifications)}</Text>
              <Text style={styles.metricLabel}>إشعار جديد</Text>
            </View>
          </View>
        </Surface>

        <View style={styles.quickActions}>
          <Button onPress={() => router.push('/business/new')}>إنشاء نشاط تجاري</Button>
          <Button onPress={() => router.push('/notifications')} variant="secondary">
            فتح الإشعارات
          </Button>
        </View>

        {error ? (
          <ErrorState
            message={error}
            onRetry={() => setRefreshNonce((value) => value + 1)}
            retryLabel="إعادة التحميل"
          />
        ) : null}

        {loading ? <LoadingState label="جارٍ تحميل مساحة العمل" /> : null}

        {!loading && !error && myAccounts.length > 0 ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>حساباتي</Text>
              <Text style={styles.sectionCaption}>
                {isPreviewMode
                  ? 'حسابات تجريبية لعرض تجربة العميل.'
                  : 'الحسابات المرتبطة بهويتك الموثقة.'}
              </Text>
            </View>

            <View style={styles.stack}>
              {myAccounts.map((account) => (
                <Pressable
                  accessibilityRole="button"
                  key={account.accountId}
                  onPress={() =>
                    router.push({
                      pathname: '/account/[accountId]',
                      params: {
                        accountId: account.accountId,
                        businessId: account.businessId,
                        customerIdentityId: account.customerIdentityId,
                        businessCustomerId: account.businessCustomerId,
                        displayName: account.businessName,
                        currencyCode: account.currencyCode,
                        mode: 'customer',
                      },
                    })
                  }
                  style={({ pressed }) => [pressed ? styles.pressed : null]}
                >
                  <Surface variant="outlined">
                    <View style={styles.accountRow}>
                      <View style={styles.accountMeta}>
                        <Text style={styles.cardTitle}>{account.businessName}</Text>
                        <Text style={styles.cardCaption}>
                          {account.currencyCode} · {account.accountStatus}
                        </Text>
                      </View>
                      <Text style={styles.balance}>
                        {formatMinorUnits(account.balanceMinor, account.currencyCode)}
                      </Text>
                    </View>
                  </Surface>
                </Pressable>
              ))}
            </View>
          </View>
        ) : null}

        {!loading && !error ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>أنشطتي</Text>
              <Text style={styles.sectionCaption}>المساحات التجارية التي تملكها أو تعمل ضمن فريقها.</Text>
            </View>

            {businesses.length === 0 ? (
              <EmptyState
                message="يمكنك إنشاء نشاط جديد، أو الاستمرار في استخدام IBEX HAD كعميل فقط."
                title="لا يوجد نشاط بعد"
              />
            ) : (
              <View style={styles.stack}>
                {businesses.map((business) => (
                  <Pressable
                    accessibilityRole="button"
                    key={business.businessId}
                    onPress={() =>
                      router.push({
                        pathname: '/business/[businessId]/customers',
                        params: { businessId: business.businessId, businessName: business.name },
                      })
                    }
                    style={({ pressed }) => [pressed ? styles.pressed : null]}
                  >
                    <Surface variant="outlined">
                      <View style={styles.businessRow}>
                        <View style={styles.accountMeta}>
                          <Text style={styles.cardTitle}>{business.name}</Text>
                          <Text style={styles.cardCaption}>
                            {business.defaultCurrencyCode ?? 'بدون عملة افتراضية'} · {business.role}
                          </Text>
                        </View>
                        <Text style={styles.chevron}>‹</Text>
                      </View>
                    </Surface>
                  </Pressable>
                ))}
              </View>
            )}
          </View>
        ) : null}
      </ScrollView>
    </ProductShell>
  );
}

const styles = StyleSheet.create({
  scrollContent: {
    gap: theme.spacing.lg,
    paddingTop: theme.spacing.lg,
    paddingBottom: theme.spacing.xl,
  },
  headerAction: {
    minWidth: theme.layout.minTouchTarget,
    minHeight: theme.layout.minTouchTarget,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: theme.spacing.xs,
  },
  headerActionText: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.styles.label.fontSize,
    lineHeight: theme.typography.styles.label.lineHeight,
    fontWeight: theme.typography.styles.label.fontWeight,
    writingDirection: 'rtl',
  },
  hero: {
    gap: theme.spacing.xs,
    paddingTop: theme.spacing.xs,
  },
  eyebrow: {
    color: theme.colors.accent,
    fontSize: theme.typography.styles.label.fontSize,
    lineHeight: theme.typography.styles.label.lineHeight,
    fontWeight: theme.typography.styles.label.fontWeight,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  heroTitle: {
    color: theme.colors.text,
    fontSize: theme.typography.styles.title.fontSize,
    lineHeight: theme.typography.styles.title.lineHeight,
    fontWeight: theme.typography.styles.title.fontWeight,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  heroBody: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.styles.body.fontSize,
    lineHeight: theme.typography.styles.body.lineHeight,
    fontWeight: theme.typography.styles.body.fontWeight,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  metricsRow: {
    flexDirection: 'row-reverse',
    alignItems: 'stretch',
  },
  metric: {
    flex: 1,
    minHeight: 70,
    alignItems: 'center',
    justifyContent: 'center',
    gap: theme.spacing.xxs,
  },
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
  metricDivider: {
    width: 1,
    backgroundColor: theme.colors.border,
  },
  quickActions: {
    gap: theme.spacing.sm,
  },
  section: {
    gap: theme.spacing.md,
  },
  sectionHeader: {
    gap: theme.spacing.xxs,
  },
  sectionTitle: {
    color: theme.colors.text,
    fontSize: theme.typography.styles.heading.fontSize,
    lineHeight: theme.typography.styles.heading.lineHeight,
    fontWeight: theme.typography.styles.heading.fontWeight,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  sectionCaption: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.styles.caption.fontSize,
    lineHeight: theme.typography.styles.caption.lineHeight,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  stack: {
    gap: theme.spacing.sm,
  },
  accountRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
    minHeight: theme.layout.minTouchTarget,
  },
  businessRow: {
    flexDirection: 'row-reverse',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: theme.spacing.md,
    minHeight: theme.layout.minTouchTarget,
  },
  accountMeta: {
    flex: 1,
    gap: theme.spacing.xxs,
  },
  cardTitle: {
    color: theme.colors.text,
    fontSize: theme.typography.styles.bodyStrong.fontSize,
    lineHeight: theme.typography.styles.bodyStrong.lineHeight,
    fontWeight: theme.typography.styles.bodyStrong.fontWeight,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  cardCaption: {
    color: theme.colors.textMuted,
    fontSize: theme.typography.styles.caption.fontSize,
    lineHeight: theme.typography.styles.caption.lineHeight,
    textAlign: 'right',
    writingDirection: 'rtl',
  },
  balance: {
    color: theme.colors.text,
    fontSize: theme.typography.styles.bodyStrong.fontSize,
    lineHeight: theme.typography.styles.bodyStrong.lineHeight,
    fontWeight: theme.typography.styles.bodyStrong.fontWeight,
    writingDirection: 'ltr',
  },
  chevron: {
    color: theme.colors.textMuted,
    fontSize: 28,
    writingDirection: 'ltr',
  },
  pressed: {
    opacity: 0.72,
  },
});
