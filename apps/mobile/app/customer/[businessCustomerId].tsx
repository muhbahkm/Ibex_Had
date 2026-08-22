import type { CustomerAccountSummaryRecord } from '../../../../packages/application/src/ports';
import { Redirect, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { useAuth } from '../../src/features/auth/auth-context';
import { ibex } from '../../src/lib/ibex';
import { formatMinorUnits } from '../../src/lib/money-display';
import { AppScreen, ErrorMessage, Heading, PrimaryButton } from '../../src/ui/primitives';
import { theme } from '../../src/ui/theme';

function param(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

function message(error: unknown): string {
  return error instanceof Error && error.message ? error.message : 'تعذر تحميل حسابات العميل.';
}

export default function CustomerAccountsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    businessCustomerId?: string;
    customerIdentityId?: string;
    businessId?: string;
    businessName?: string;
    displayName?: string;
    phone?: string;
  }>();
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

  const load = useCallback(() => {
    let active = true;
    setLoading(true);
    setError(null);
    void ibex
      .listCustomerAccounts({ businessCustomerId })
      .then((rows) => {
        if (active) setAccounts(rows);
      })
      .catch((loadError: unknown) => {
        if (active) setError(message(loadError));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [businessCustomerId]);

  useFocusEffect(load);

  if (!session) return <Redirect href="/sign-in" />;
  if (!businessCustomerId || !businessId || !customerIdentityId) return <Redirect href="/home" />;

  const openAccount = (currencyCode: string) => {
    if (opening) return;
    setOpening(currencyCode);
    setError(null);
    void ibex
      .openCustomerAccount(
        { businessCustomerId, currencyCode },
        `mobile-account-${Date.now().toString(36)}`,
      )
      .then(() => ibex.listCustomerAccounts({ businessCustomerId }))
      .then((rows) => setAccounts(rows))
      .catch((openError: unknown) => setError(message(openError)))
      .finally(() => setOpening(null));
  };

  const shareInvite = () => {
    if (sharing) return;
    setSharing(true);
    setError(null);
    void ibex
      .createCustomerInvite(
        { businessCustomerId, ttlHours: 168 },
        `mobile-invite-${Date.now().toString(36)}`,
      )
      .then((invite) =>
        Share.share({
          title: `دعوة IBEX HAD — ${displayName}`,
          message: `${businessName || 'نشاطك التجاري'} يدعوك لعرض حسابك مباشرة في IBEX HAD. افتح الرابط وسجل الدخول بنفس رقم الجوال المسجل لديك:\n\nibexhad://invite/${invite.token}\n\nتنتهي صلاحية الدعوة في ${new Date(invite.expiresAt).toLocaleDateString('en-GB')}.`,
        }),
      )
      .catch((shareError: unknown) => setError(message(shareError)))
      .finally(() => setSharing(false));
  };

  return (
    <AppScreen>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>رجوع</Text>
        </Pressable>
        <Heading title={displayName} subtitle={phone || businessName || 'حساب العميل'} />

        <View style={styles.inviteCard}>
          <View style={styles.inviteCopy}>
            <Text style={styles.inviteTitle}>دخول العميل إلى حسابه</Text>
            <Text style={styles.inviteBody}>
              أنشئ رابطًا آمنًا صالحًا لمدة 7 أيام. الرابط وحده لا يكفي؛ يجب أن يسجل العميل بنفس رقم الجوال الموثق.
            </Text>
          </View>
          <PrimaryButton loading={sharing} onPress={shareInvite}>مشاركة الدعوة</PrimaryButton>
        </View>

        <View style={styles.currencyActions}>
          {['YER', 'SAR', 'USD'].map((code) => (
            <Pressable
              key={code}
              disabled={opening !== null}
              onPress={() => openAccount(code)}
              style={({ pressed }) => [styles.currencyButton, pressed ? styles.pressed : null]}
            >
              <Text style={styles.currencyText}>{opening === code ? '...' : `+ ${code}`}</Text>
            </Pressable>
          ))}
        </View>

        <ErrorMessage message={error} />
        {loading ? <ActivityIndicator color={theme.colors.primary} style={styles.loader} /> : null}

        <View style={styles.list}>
          {accounts.map((account) => (
            <Pressable
              key={account.accountId}
              onPress={() =>
                router.push({
                  pathname: '/account/[accountId]',
                  params: {
                    accountId: account.accountId,
                    businessId,
                    customerIdentityId,
                    businessCustomerId,
                    displayName,
                    currencyCode: account.currencyCode,
                  },
                })
              }
              style={({ pressed }) => [styles.accountCard, pressed ? styles.pressed : null]}
            >
              <View>
                <Text style={styles.accountCurrency}>{account.currencyCode}</Text>
                <Text style={styles.accountStatus}>{account.status}</Text>
              </View>
              <Text style={styles.balance}>{formatMinorUnits(account.balanceMinor, account.currencyCode)}</Text>
            </Pressable>
          ))}
        </View>

        {!loading && accounts.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>افتح أول حساب عملة لهذا العميل من الأزرار أعلاه.</Text>
          </View>
        ) : null}

        <PrimaryButton
          onPress={() =>
            router.push({
              pathname: '/business/[businessId]/customers',
              params: { businessId, businessName },
            })
          }
        >
          العودة إلى العملاء
        </PrimaryButton>
      </ScrollView>
    </AppScreen>
  );
}

const styles = StyleSheet.create({
  content: { paddingBottom: theme.spacing.xl },
  backButton: { alignSelf: 'flex-start', paddingVertical: theme.spacing.sm, marginBottom: theme.spacing.md },
  backText: { color: theme.colors.textMuted, fontWeight: '700', writingDirection: 'rtl' },
  inviteCard: {
    padding: theme.spacing.lg,
    marginBottom: theme.spacing.lg,
    borderRadius: theme.radius.lg,
    backgroundColor: theme.colors.surfaceMuted,
  },
  inviteCopy: { gap: theme.spacing.xs, marginBottom: theme.spacing.sm },
  inviteTitle: { color: theme.colors.text, fontWeight: '800', fontSize: theme.typography.body, textAlign: 'right', writingDirection: 'rtl' },
  inviteBody: { color: theme.colors.textMuted, lineHeight: 23, textAlign: 'right', writingDirection: 'rtl' },
  currencyActions: { flexDirection: 'row-reverse', gap: theme.spacing.sm, marginBottom: theme.spacing.md },
  currencyButton: { flex: 1, minHeight: 48, borderRadius: theme.radius.md, backgroundColor: theme.colors.surfaceMuted, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center' },
  currencyText: { color: theme.colors.text, fontWeight: '700' },
  pressed: { opacity: 0.7 },
  loader: { marginVertical: theme.spacing.lg },
  list: { gap: theme.spacing.sm },
  accountCard: { minHeight: 84, borderRadius: theme.radius.lg, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface, padding: theme.spacing.lg, flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' },
  accountCurrency: { color: theme.colors.text, fontSize: theme.typography.heading, fontWeight: '800' },
  accountStatus: { color: theme.colors.textMuted, fontSize: theme.typography.caption, marginTop: theme.spacing.xs },
  balance: { color: theme.colors.text, fontSize: theme.typography.heading, fontWeight: '700', writingDirection: 'ltr' },
  emptyCard: { padding: theme.spacing.lg, backgroundColor: theme.colors.surfaceMuted, borderRadius: theme.radius.lg },
  emptyText: { color: theme.colors.textMuted, textAlign: 'right', writingDirection: 'rtl', lineHeight: 24 },
});
