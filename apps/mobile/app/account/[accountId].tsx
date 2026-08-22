import type { StatementEntryRecord } from '../../../../packages/application/src/ports';
import { Redirect, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../../src/features/auth/auth-context';
import { ibex } from '../../src/lib/ibex';
import { formatMinorUnits } from '../../src/lib/money-display';
import { Button, EmptyState, ErrorState, LoadingState, Surface } from '../../src/ui/primitives';
import { SecondaryShell } from '../../src/ui/secondary-shell';
import { theme } from '../../src/ui/theme';

function param(value: string | string[] | undefined): string { return Array.isArray(value) ? (value[0] ?? '') : (value ?? ''); }
function message(error: unknown): string { return error instanceof Error && error.message ? error.message : 'تعذر تحميل كشف الحساب.'; }
function movementLabel(type: StatementEntryRecord['transactionType']): string {
  const labels: Partial<Record<StatementEntryRecord['transactionType'], string>> = { sale_on_account: 'بيع آجل', receipt: 'قبض', reversal: 'عكس حركة', opening_balance: 'رصيد افتتاحي', return: 'مرتجع', discount: 'خصم', disbursement: 'صرف', adjustment: 'تسوية' };
  return labels[type] ?? type;
}

export default function AccountScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ accountId?: string; businessId?: string; customerIdentityId?: string; businessCustomerId?: string; displayName?: string; currencyCode?: string; mode?: string }>();
  const accountId = param(params.accountId);
  const businessId = param(params.businessId);
  const customerIdentityId = param(params.customerIdentityId);
  const businessCustomerId = param(params.businessCustomerId);
  const displayName = param(params.displayName) || 'العميل';
  const currencyCode = param(params.currencyCode);
  const customerMode = param(params.mode) === 'customer';
  const { session } = useAuth();
  const [entries, setEntries] = useState<readonly StatementEntryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);

  useFocusEffect(useCallback(() => {
    let active = true;
    setLoading(true);
    setError(null);
    void ibex.getStatement({ accountId, limit: 100 }).then((rows) => { if (active) setEntries(rows); }).catch((loadError: unknown) => { if (active) setError(message(loadError)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [accountId, refreshNonce]));

  if (!session) return <Redirect href="/sign-in" />;
  if (!accountId || !businessId || !customerIdentityId || !currencyCode) return <Redirect href="/home" />;

  const balance = entries[0]?.balanceAfterMinor ?? 0n;
  const movementParams = { accountId, businessId, customerIdentityId, businessCustomerId, displayName, currencyCode };

  return (
    <SecondaryShell title={displayName} subtitle={customerMode ? `حسابي · ${currencyCode}` : `كشف حساب · ${currencyCode}`} onBack={() => router.back()}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Surface variant="tinted">
          <Text style={styles.balanceLabel}>الرصيد الحالي</Text>
          <Text style={styles.balanceValue}>{formatMinorUnits(balance, currencyCode)}</Text>
          <Text style={styles.balanceHint}>الموجب = على العميل للنشاط · العملة مستقلة عن أي حساب آخر</Text>
        </Surface>

        {!customerMode ? (
          <View style={styles.actions}>
            <View style={styles.actionItem}><Button onPress={() => router.push({ pathname: '/account/[accountId]/movement', params: { ...movementParams, kind: 'sale' } })}>بيع آجل</Button></View>
            <View style={styles.actionItem}><Button variant="secondary" onPress={() => router.push({ pathname: '/account/[accountId]/movement', params: { ...movementParams, kind: 'receipt' } })}>تسجيل قبض</Button></View>
          </View>
        ) : null}

        {error ? <ErrorState message={error} onRetry={() => setRefreshNonce((value) => value + 1)} /> : null}
        {loading ? <LoadingState label="جارٍ تحميل كشف الحساب" /> : null}

        {!loading && !error ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}><Text style={styles.sectionTitle}>الحركات</Text><Text style={styles.sectionCount}>{String(entries.length)}</Text></View>
            {entries.length === 0 ? <EmptyState title="لا توجد حركات" message={customerMode ? 'لا توجد حركات في هذا الحساب بعد.' : 'ابدأ ببيع آجل أو تسجيل قبض.'} /> : null}
            <View style={styles.list}>
              {entries.map((entry) => {
                const label = movementLabel(entry.transactionType);
                const amount = formatMinorUnits(entry.effectMinor, entry.currencyCode);
                return (
                  <Surface key={entry.transactionId} variant="outlined">
                    <View style={styles.entryTop}>
                      <View style={styles.entryTitleWrap}><Text style={styles.entryType}>{label}</Text>{entry.transactionStatus === 'reversed' ? <Text style={styles.reversedBadge}>معكوسة</Text> : null}</View>
                      <Text style={[styles.effect, entry.effectMinor < 0n ? styles.credit : null]}>{amount}</Text>
                    </View>
                    {entry.description ? <Text style={styles.description}>{entry.description}</Text> : null}
                    <View style={styles.entryBottom}><Text style={styles.dateText}>{new Date(entry.occurredAt).toLocaleDateString('en-GB')}</Text><Text style={styles.runningBalance}>الرصيد: {formatMinorUnits(entry.balanceAfterMinor, entry.currencyCode)}</Text></View>
                    <View style={styles.entryActions}>
                      <Pressable onPress={() => router.push({ pathname: '/account/[accountId]/documents', params: { accountId, transactionId: entry.transactionId, mode: customerMode ? 'customer' : 'merchant', movementLabel: label } })} style={styles.actionChip}><Text style={styles.actionChipText}>المستندات</Text></Pressable>
                      {!customerMode && entry.canReverse ? <Pressable onPress={() => router.push({ pathname: '/account/[accountId]/reverse', params: { ...movementParams, transactionId: entry.transactionId, movementLabel: label, amount } })} style={styles.actionChip}><Text style={styles.actionChipText}>عكس الحركة</Text></Pressable> : null}
                      {customerMode ? <Pressable onPress={() => router.push({ pathname: '/account/[accountId]/review', params: { accountId, transactionId: entry.transactionId, movementLabel: label, amount } })} style={styles.actionChip}><Text style={styles.actionChipText}>طلب مراجعة</Text></Pressable> : null}
                    </View>
                  </Surface>
                );
              })}
            </View>
          </View>
        ) : null}
      </ScrollView>
    </SecondaryShell>
  );
}

const styles = StyleSheet.create({
  content: { gap: theme.spacing.lg, paddingTop: theme.spacing.lg, paddingBottom: theme.spacing.xl },
  balanceLabel: { color: theme.colors.accent, fontSize: theme.typography.styles.label.fontSize, fontWeight: '700', textAlign: 'right', writingDirection: 'rtl' },
  balanceValue: { color: theme.colors.text, fontSize: theme.typography.styles.display.fontSize, lineHeight: theme.typography.styles.display.lineHeight, fontWeight: '800', marginTop: theme.spacing.xs, textAlign: 'right', writingDirection: 'ltr' },
  balanceHint: { color: theme.colors.textMuted, fontSize: theme.typography.caption, marginTop: theme.spacing.xs, textAlign: 'right', writingDirection: 'rtl' },
  actions: { flexDirection: 'row-reverse', gap: theme.spacing.sm },
  actionItem: { flex: 1 },
  section: { gap: theme.spacing.md },
  sectionHeader: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between' },
  sectionTitle: { color: theme.colors.text, fontSize: theme.typography.styles.heading.fontSize, fontWeight: '700', writingDirection: 'rtl' },
  sectionCount: { color: theme.colors.textMuted, fontSize: theme.typography.caption, writingDirection: 'ltr' },
  list: { gap: theme.spacing.sm },
  entryTop: { flexDirection: 'row-reverse', justifyContent: 'space-between', alignItems: 'center', gap: theme.spacing.md },
  entryTitleWrap: { flexDirection: 'row-reverse', alignItems: 'center', gap: theme.spacing.sm },
  entryType: { color: theme.colors.text, fontWeight: '700', writingDirection: 'rtl' },
  reversedBadge: { color: theme.colors.textMuted, fontSize: theme.typography.caption, backgroundColor: theme.colors.surfaceMuted, paddingHorizontal: theme.spacing.sm, paddingVertical: 3, borderRadius: theme.radius.full, writingDirection: 'rtl' },
  effect: { color: theme.colors.text, fontWeight: '800', writingDirection: 'ltr' },
  credit: { color: theme.colors.success },
  description: { color: theme.colors.textMuted, marginTop: theme.spacing.sm, textAlign: 'right', writingDirection: 'rtl' },
  entryBottom: { flexDirection: 'row-reverse', justifyContent: 'space-between', gap: theme.spacing.sm, marginTop: theme.spacing.md },
  dateText: { color: theme.colors.textMuted, fontSize: theme.typography.caption, writingDirection: 'ltr' },
  runningBalance: { color: theme.colors.textMuted, fontSize: theme.typography.caption, writingDirection: 'rtl' },
  entryActions: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: theme.spacing.sm, marginTop: theme.spacing.md },
  actionChip: { minHeight: theme.layout.minTouchTarget, paddingHorizontal: theme.spacing.md, borderRadius: theme.radius.md, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center' },
  actionChipText: { color: theme.colors.accent, fontWeight: '700', fontSize: theme.typography.caption, writingDirection: 'rtl' },
});
