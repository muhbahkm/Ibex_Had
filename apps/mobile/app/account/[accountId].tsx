import type { StatementEntryRecord } from '../../../packages/application/src/ports';
import { Redirect, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../../src/features/auth/auth-context';
import { ibex } from '../../src/lib/ibex';
import { formatMinorUnits } from '../../src/lib/money-display';
import { AppScreen, ErrorMessage, Heading } from '../../src/ui/primitives';
import { theme } from '../../src/ui/theme';

function param(value: string | string[] | undefined): string {
  return Array.isArray(value) ? (value[0] ?? '') : (value ?? '');
}

function message(error: unknown): string {
  return error instanceof Error && error.message ? error.message : 'تعذر تحميل كشف الحساب.';
}

function movementLabel(type: StatementEntryRecord['transactionType']): string {
  const labels: Partial<Record<StatementEntryRecord['transactionType'], string>> = {
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

export default function AccountScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{
    accountId?: string;
    businessId?: string;
    customerIdentityId?: string;
    businessCustomerId?: string;
    displayName?: string;
    currencyCode?: string;
  }>();
  const accountId = param(params.accountId);
  const businessId = param(params.businessId);
  const customerIdentityId = param(params.customerIdentityId);
  const businessCustomerId = param(params.businessCustomerId);
  const displayName = param(params.displayName) || 'العميل';
  const currencyCode = param(params.currencyCode);
  const { session } = useAuth();
  const [entries, setEntries] = useState<readonly StatementEntryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useFocusEffect(
    useCallback(() => {
      let active = true;
      setLoading(true);
      setError(null);
      void ibex
        .getStatement({ accountId, limit: 100 })
        .then((rows) => {
          if (active) setEntries(rows);
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
    }, [accountId]),
  );

  if (!session) return <Redirect href="/sign-in" />;
  if (!accountId || !businessId || !customerIdentityId || !currencyCode) return <Redirect href="/home" />;

  const balance = entries[0]?.balanceAfterMinor ?? 0n;
  const movementParams = {
    accountId,
    businessId,
    customerIdentityId,
    businessCustomerId,
    displayName,
    currencyCode,
  };

  return (
    <AppScreen>
      <ScrollView contentContainerStyle={styles.content}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <Text style={styles.backText}>رجوع</Text>
        </Pressable>
        <Heading title={displayName} subtitle={`كشف حساب ${currencyCode}`} />

        <View style={styles.balanceCard}>
          <Text style={styles.balanceLabel}>الرصيد الحالي</Text>
          <Text style={styles.balanceValue}>{formatMinorUnits(balance, currencyCode)}</Text>
          <Text style={styles.balanceHint}>الموجب = على العميل للنشاط</Text>
        </View>

        <View style={styles.actions}>
          <Pressable
            onPress={() => router.push({ pathname: '/account/[accountId]/movement', params: { ...movementParams, kind: 'sale' } })}
            style={[styles.actionButton, styles.primaryAction]}
          >
            <Text style={styles.primaryActionText}>بيع آجل</Text>
          </Pressable>
          <Pressable
            onPress={() => router.push({ pathname: '/account/[accountId]/movement', params: { ...movementParams, kind: 'receipt' } })}
            style={styles.actionButton}
          >
            <Text style={styles.actionText}>تسجيل قبض</Text>
          </Pressable>
        </View>

        <ErrorMessage message={error} />
        {loading ? <ActivityIndicator color={theme.colors.primary} style={styles.loader} /> : null}

        <View style={styles.statementHeader}>
          <Text style={styles.statementTitle}>الحركات</Text>
          <Text style={styles.statementCount}>{entries.length}</Text>
        </View>
        <View style={styles.list}>
          {entries.map((entry) => (
            <View key={entry.transactionId} style={styles.entryCard}>
              <View style={styles.entryTop}>
                <Text style={styles.entryType}>{movementLabel(entry.transactionType)}</Text>
                <Text style={[styles.effect, entry.effectMinor < 0n ? styles.credit : styles.debit]}>
                  {formatMinorUnits(entry.effectMinor, entry.currencyCode)}
                </Text>
              </View>
              {entry.description ? <Text style={styles.description}>{entry.description}</Text> : null}
              <View style={styles.entryBottom}>
                <Text style={styles.dateText}>{new Date(entry.occurredAt).toLocaleDateString('en-GB')}</Text>
                <Text style={styles.runningBalance}>الرصيد: {formatMinorUnits(entry.balanceAfterMinor, entry.currencyCode)}</Text>
              </View>
            </View>
          ))}
        </View>

        {!loading && entries.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>لا توجد حركات بعد. ابدأ ببيع آجل أو تسجيل قبض.</Text>
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
  balanceCard: { padding: theme.spacing.xl, backgroundColor: theme.colors.primary, borderRadius: theme.radius.lg, marginBottom: theme.spacing.lg },
  balanceLabel: { color: theme.colors.primaryText, opacity: 0.8, textAlign: 'right', writingDirection: 'rtl' },
  balanceValue: { color: theme.colors.primaryText, fontSize: 30, fontWeight: '800', marginTop: theme.spacing.sm, textAlign: 'right', writingDirection: 'ltr' },
  balanceHint: { color: theme.colors.primaryText, opacity: 0.7, marginTop: theme.spacing.sm, textAlign: 'right', writingDirection: 'rtl' },
  actions: { flexDirection: 'row-reverse', gap: theme.spacing.sm, marginBottom: theme.spacing.lg },
  actionButton: { flex: 1, minHeight: 54, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.surface, alignItems: 'center', justifyContent: 'center' },
  primaryAction: { backgroundColor: theme.colors.primary, borderColor: theme.colors.primary },
  actionText: { color: theme.colors.text, fontWeight: '700', writingDirection: 'rtl' },
  primaryActionText: { color: theme.colors.primaryText, fontWeight: '700', writingDirection: 'rtl' },
  loader: { marginVertical: theme.spacing.lg },
  statementHeader: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', marginBottom: theme.spacing.sm },
  statementTitle: { color: theme.colors.text, fontSize: theme.typography.heading, fontWeight: '700', writingDirection: 'rtl' },
  statementCount: { color: theme.colors.textMuted, fontSize: theme.typography.caption },
  list: { gap: theme.spacing.sm },
  entryCard: { padding: theme.spacing.lg, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.lg, backgroundColor: theme.colors.surface },
  entryTop: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center' },
  entryType: { color: theme.colors.text, fontWeight: '700', writingDirection: 'rtl' },
  effect: { fontWeight: '800', writingDirection: 'ltr' },
  debit: { color: theme.colors.text },
  credit: { color: theme.colors.success },
  description: { color: theme.colors.textMuted, marginTop: theme.spacing.sm, textAlign: 'right', writingDirection: 'rtl' },
  entryBottom: { flexDirection: 'row-reverse', justifyContent: 'space-between', marginTop: theme.spacing.md },
  dateText: { color: theme.colors.textMuted, fontSize: theme.typography.caption, writingDirection: 'ltr' },
  runningBalance: { color: theme.colors.textMuted, fontSize: theme.typography.caption, writingDirection: 'rtl' },
  emptyCard: { padding: theme.spacing.lg, backgroundColor: theme.colors.surfaceMuted, borderRadius: theme.radius.lg },
  emptyText: { color: theme.colors.textMuted, textAlign: 'right', writingDirection: 'rtl' },
});
