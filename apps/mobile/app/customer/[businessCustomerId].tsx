import type { CustomerAccountSummaryRecord } from '../../../../packages/application/src/ports';
import { Redirect, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, Share, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../../src/features/auth/auth-context';
import { ibex } from '../../src/lib/ibex';
import { formatMinorUnits } from '../../src/lib/money-display';
import { Button, EmptyState, ErrorState, LoadingState, Surface } from '../../src/ui/primitives';
import { SecondaryShell } from '../../src/ui/secondary-shell';
import { theme } from '../../src/ui/theme';

function param(value: string | string[] | undefined): string { return Array.isArray(value) ? (value[0] ?? '') : (value ?? ''); }
function message(error: unknown): string { return error instanceof Error && error.message ? error.message : 'تعذر تحميل حسابات العميل.'; }

export default function CustomerAccountsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ businessCustomerId?: string; customerIdentityId?: string; businessId?: string; businessName?: string; displayName?: string; phone?: string }>();
  const businessCustomerId = param(params.businessCustomerId);
  const customerIdentityId = param(params.customerIdentityId);
  const businessId = param(params.businessId);
  const businessName = param(params.businessName);
  const displayName = param(params.displayName) || 'العميل';
  const phone = param(params.phone);
  const { session } = useAuth();
  const [accounts, setAccounts] = useState<readonly CustomerAccountSummaryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [opening, setOpening] = useState<string | null>(null);
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    setError(null);
    void ibex.listCustomerAccounts({ businessCustomerId })
      .then((rows) => { if (active) setAccounts(rows); })
      .catch((loadError: unknown) => { if (active) setError(message(loadError)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [businessCustomerId, refreshNonce]));

  if (!session) return <Redirect href="/sign-in" />;
  if (!businessCustomerId || !businessId || !customerIdentityId) return <Redirect href="/home" />;

  const openAccount = (currencyCode: string) => {
    if (opening) return;
    setOpening(currencyCode);
    setError(null);
    void ibex.openCustomerAccount({ businessCustomerId, currencyCode }, `mobile-account-${Date.now().toString(36)}`)
      .then(() => ibex.listCustomerAccounts({ businessCustomerId }))
      .then((rows) => setAccounts(rows))
      .catch((openError: unknown) => setError(message(openError)))
      .finally(() => setOpening(null));
  };

  const shareInvite = () => {
    if (sharing) return;
    setSharing(true);
    setError(null);
    void ibex.createCustomerInvite({ businessCustomerId, ttlHours: 168 }, `mobile-invite-${Date.now().toString(36)}`)
      .then((invite) => Share.share({ title: `دعوة IBEX HAD — ${displayName}`, message: `${businessName || 'نشاطك التجاري'} يدعوك لعرض حسابك مباشرة في IBEX HAD. افتح الرابط وسجل الدخول بنفس رقم الجوال المسجل لديك:\n\nibexhad://invite/${invite.token}\n\nتنتهي صلاحية الدعوة في ${new Date(invite.expiresAt).toLocaleDateString('en-GB')}.` }))
      .catch((shareError: unknown) => setError(message(shareError)))
      .finally(() => setSharing(false));
  };

  return (
    <SecondaryShell title={displayName} subtitle={phone || businessName || 'حساب العميل'} onBack={() => router.back()}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Surface variant="tinted">
          <View style={styles.identityBlock}>
            <Text style={styles.identityLabel}>ملف العميل</Text>
            <Text style={styles.identityValue}>{phone || 'لم يضف رقم جوال'}</Text>
            <Text style={styles.identityHint}>{String(accounts.length)} حساب عملة منفصل — لا يتم دمج الأرصدة بين العملات.</Text>
          </View>
        </Surface>

        <Surface variant="outlined">
          <View style={styles.inviteCopy}>
            <Text style={styles.sectionTitle}>وصول العميل إلى حسابه</Text>
            <Text style={styles.sectionBody}>أنشئ رابط دعوة آمنًا. الرابط لا يثبت ملكية الهاتف؛ التحقق الحقيقي سيبقى ضمن مسار المصادقة لاحقًا.</Text>
          </View>
          <Button loading={sharing} onPress={shareInvite} variant="secondary">مشاركة الدعوة</Button>
        </Surface>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>فتح حساب عملة</Text>
          <Text style={styles.sectionBody}>كل عملة مستقلة ماليًا وتظهر في كشف منفصل.</Text>
        </View>
        <View style={styles.currencyActions}>
          {['YER', 'SAR', 'USD'].map((code) => (
            <View key={code} style={styles.currencyItem}>
              <Button disabled={opening !== null} onPress={() => openAccount(code)} variant="secondary">{opening === code ? 'جارٍ الفتح…' : `+ ${code}`}</Button>
            </View>
          ))}
        </View>

        {error ? <ErrorState message={error} onRetry={() => setRefreshNonce((value) => value + 1)} /> : null}
        {loading ? <LoadingState label="جارٍ تحميل الحسابات" /> : null}

        {!loading && !error && accounts.length === 0 ? <EmptyState title="لا توجد حسابات بعد" message="افتح أول حساب عملة لهذا العميل من الخيارات أعلاه." /> : null}

        <View style={styles.list}>
          {accounts.map((account) => (
            <Pressable accessibilityRole="button" key={account.accountId} onPress={() => router.push({ pathname: '/account/[accountId]', params: { accountId: account.accountId, businessId, customerIdentityId, businessCustomerId, displayName, currencyCode: account.currencyCode } })} style={({ pressed }) => [pressed ? styles.pressed : null]}>
              <Surface variant="outlined">
                <View style={styles.accountRow}>
                  <View style={styles.accountMeta}>
                    <Text style={styles.currency}>{account.currencyCode}</Text>
                    <Text style={styles.status}>{account.status === 'active' ? 'نشط' : account.status}</Text>
                  </View>
                  <Text style={styles.balance}>{formatMinorUnits(account.balanceMinor, account.currencyCode)}</Text>
                </View>
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
  identityBlock: { gap: theme.spacing.xxs },
  identityLabel: { color: theme.colors.accent, fontSize: theme.typography.styles.label.fontSize, fontWeight: '700', textAlign: 'right', writingDirection: 'rtl' },
  identityValue: { color: theme.colors.text, fontSize: theme.typography.styles.title.fontSize, fontWeight: '700', textAlign: 'right', writingDirection: phoneDirection },
  identityHint: { color: theme.colors.textMuted, fontSize: theme.typography.caption, lineHeight: 20, textAlign: 'right', writingDirection: 'rtl' },
  inviteCopy: { gap: theme.spacing.xs, marginBottom: theme.spacing.md },
  sectionHeader: { gap: theme.spacing.xxs },
  sectionTitle: { color: theme.colors.text, fontSize: theme.typography.styles.heading.fontSize, lineHeight: theme.typography.styles.heading.lineHeight, fontWeight: theme.typography.styles.heading.fontWeight, textAlign: 'right', writingDirection: 'rtl' },
  sectionBody: { color: theme.colors.textMuted, fontSize: theme.typography.caption, lineHeight: 21, textAlign: 'right', writingDirection: 'rtl' },
  currencyActions: { flexDirection: 'row-reverse', gap: theme.spacing.sm },
  currencyItem: { flex: 1 },
  list: { gap: theme.spacing.sm },
  accountRow: { minHeight: 56, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.md },
  accountMeta: { gap: theme.spacing.xxs },
  currency: { color: theme.colors.text, fontSize: theme.typography.styles.heading.fontSize, fontWeight: '800', writingDirection: 'ltr' },
  status: { color: theme.colors.textMuted, fontSize: theme.typography.caption, textAlign: 'right', writingDirection: 'rtl' },
  balance: { color: theme.colors.text, fontSize: theme.typography.styles.heading.fontSize, fontWeight: '700', writingDirection: 'ltr' },
  pressed: { opacity: 0.72 },
});

const phoneDirection = 'ltr' as const;
