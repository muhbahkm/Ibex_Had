import type { CollectionChannel, CollectionEventKind, CollectionFollowUpEventRecord, CollectionOutcome } from '../../../../../packages/application/src/collection-engagement';
import { Redirect, useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../../../src/features/auth/auth-context';
import { listCollectionFollowUpHistory, recordCollectionFollowUpEvent } from '../../../src/lib/collection-engagement';
import { majorUnitsToMinor } from '../../../src/lib/money-display';
import { Button, EmptyState, ErrorState, InlineFeedback, LoadingState, Surface, TextField } from '../../../src/ui/primitives';
import { SectionHeading, StatusBadge } from '../../../src/ui/operational-primitives';
import { SecondaryShell } from '../../../src/ui/secondary-shell';
import { theme } from '../../../src/ui/theme';

function param(value: string | string[] | undefined): string { return Array.isArray(value) ? (value[0] ?? '') : (value ?? ''); }
function message(error: unknown): string { return error instanceof Error && error.message ? error.message : 'تعذر تنفيذ المتابعة.'; }
function localDateToIso(date: string): string | undefined { if (!date.trim()) return undefined; if (!/^\d{4}-\d{2}-\d{2}$/.test(date.trim())) throw new Error('استخدم التاريخ بصيغة YYYY-MM-DD'); const value = new Date(`${date.trim()}T09:00:00`); if (Number.isNaN(value.getTime())) throw new Error('تاريخ الإجراء التالي غير صالح'); return value.toISOString(); }

const kinds: readonly { key: CollectionEventKind; label: string }[] = [
  { key: 'contact_attempt', label: 'محاولة اتصال' },
  { key: 'contact_reached', label: 'تم التواصل' },
  { key: 'promise_to_pay', label: 'وعد بالسداد' },
  { key: 'note', label: 'ملاحظة' },
  { key: 'escalation', label: 'تصعيد' },
];
const channels: readonly { key: CollectionChannel; label: string }[] = [
  { key: 'call', label: 'اتصال' }, { key: 'whatsapp', label: 'واتساب' }, { key: 'sms', label: 'SMS' }, { key: 'in_person', label: 'حضوري' }, { key: 'other', label: 'أخرى' },
];
const outcomes: readonly { key: CollectionOutcome; label: string }[] = [
  { key: 'no_answer', label: 'لم يرد' }, { key: 'reached', label: 'تم الوصول' }, { key: 'promised', label: 'وعد' }, { key: 'callback_requested', label: 'طلب معاودة' }, { key: 'refused', label: 'رفض' },
];

function eventLabel(kind: CollectionEventKind): string { return kinds.find((row) => row.key === kind)?.label ?? kind; }

export default function CollectionContactScreen() {
  const router = useRouter();
  const { session, isPreviewMode } = useAuth();
  const params = useLocalSearchParams<{ businessId?: string; businessName?: string; businessCustomerId?: string; accountId?: string; displayName?: string; currencyCode?: string }>();
  const businessId = param(params.businessId);
  const businessName = param(params.businessName) || 'النشاط';
  const businessCustomerId = param(params.businessCustomerId);
  const accountId = param(params.accountId);
  const displayName = param(params.displayName) || 'العميل';
  const currencyCode = param(params.currencyCode);
  const [history, setHistory] = useState<readonly CollectionFollowUpEventRecord[]>([]);
  const [kind, setKind] = useState<CollectionEventKind>('contact_attempt');
  const [channel, setChannel] = useState<CollectionChannel>('call');
  const [outcome, setOutcome] = useState<CollectionOutcome>('no_answer');
  const [note, setNote] = useState('');
  const [promiseDate, setPromiseDate] = useState('');
  const [promiseAmount, setPromiseAmount] = useState('');
  const [nextActionDate, setNextActionDate] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [refreshNonce, setRefreshNonce] = useState(0);

  useFocusEffect(useCallback(() => {
    if (!businessCustomerId) return undefined;
    let active = true;
    setLoading(true);
    void listCollectionFollowUpHistory({ businessCustomerId, limit: 50 })
      .then((rows) => { if (active) setHistory(rows); })
      .catch((cause: unknown) => { if (active) setError(message(cause)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [businessCustomerId, refreshNonce]));

  if (!session) return <Redirect href="/sign-in" />;
  if (!businessId || !businessCustomerId) return <Redirect href="/home" />;

  const save = () => {
    if (saving) return;
    setError(null); setSuccess(null);
    let promisedAmountMinor: string | undefined;
    let nextActionAt: string | undefined;
    try {
      if (kind === 'promise_to_pay' && promiseAmount.trim()) promisedAmountMinor = majorUnitsToMinor(promiseAmount, currencyCode);
      nextActionAt = localDateToIso(nextActionDate);
      if (kind === 'promise_to_pay' && !promiseDate.trim()) throw new Error('حدد تاريخ الوعد بالسداد.');
    } catch (cause) { setError(message(cause)); return; }

    setSaving(true);
    void recordCollectionFollowUpEvent({
      businessCustomerId,
      ...(accountId ? { accountId } : {}),
      eventKind: kind,
      ...(kind !== 'note' ? { channel } : {}),
      ...(kind === 'contact_attempt' || kind === 'contact_reached' || kind === 'promise_to_pay' ? { outcome: kind === 'promise_to_pay' ? 'promised' : outcome } : {}),
      ...(note.trim() ? { note: note.trim() } : {}),
      ...(kind === 'promise_to_pay' && promisedAmountMinor ? { promisedAmountMinor, currencyCode } : {}),
      ...(kind === 'promise_to_pay' ? { promisedFor: promiseDate.trim() } : {}),
      ...(nextActionAt ? { nextActionAt } : {}),
    })
      .then(() => {
        setSuccess('تم حفظ المتابعة كسجل تشغيلي مستقل دون تعديل الرصيد.');
        setNote(''); setPromiseDate(''); setPromiseAmount(''); setNextActionDate('');
        setRefreshNonce((value) => value + 1);
      })
      .catch((cause: unknown) => setError(message(cause)))
      .finally(() => setSaving(false));
  };

  return (
    <SecondaryShell title="سجل المتابعة" subtitle={`${displayName} · ${businessName}`} onBack={() => router.back()}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
        <Surface variant="tinted">
          <Text style={styles.explainTitle}>المتابعة ليست حركة مالية</Text>
          <Text style={styles.explainBody}>محاولة الاتصال والوعد بالسداد والإجراء التالي تحفظ كسجل تشغيلي قابل للتدقيق. الرصيد لا يتغير إلا عبر حركة مالية صريحة في Ledger.</Text>
        </Surface>
        {isPreviewMode ? <InlineFeedback tone="info">في المعاينة تحفظ المتابعات داخل الذاكرة المحلية لهذه الجلسة فقط.</InlineFeedback> : null}

        <View style={styles.section}>
          <SectionHeading title="تسجيل متابعة" caption="اختر ما حدث فعليًا، ثم أضف النتيجة أو الوعد إن وجد." />
          <View style={styles.chips}>{kinds.map((item) => <Pressable key={item.key} onPress={() => setKind(item.key)} style={[styles.chip, kind === item.key ? styles.chipActive : null]}><Text style={[styles.chipText, kind === item.key ? styles.chipTextActive : null]}>{item.label}</Text></Pressable>)}</View>
          {kind !== 'note' ? <View style={styles.chips}>{channels.map((item) => <Pressable key={item.key} onPress={() => setChannel(item.key)} style={[styles.chip, channel === item.key ? styles.chipActive : null]}><Text style={[styles.chipText, channel === item.key ? styles.chipTextActive : null]}>{item.label}</Text></Pressable>)}</View> : null}
          {(kind === 'contact_attempt' || kind === 'contact_reached') ? <View style={styles.chips}>{outcomes.map((item) => <Pressable key={item.key} onPress={() => setOutcome(item.key)} style={[styles.chip, outcome === item.key ? styles.chipActive : null]}><Text style={[styles.chipText, outcome === item.key ? styles.chipTextActive : null]}>{item.label}</Text></Pressable>)}</View> : null}
          {kind === 'promise_to_pay' ? <>
            <TextField label="تاريخ الوعد" value={promiseDate} onChangeText={setPromiseDate} placeholder="2026-08-30" />
            <TextField label={`المبلغ الموعود — اختياري (${currencyCode || 'العملة'})`} value={promiseAmount} onChangeText={setPromiseAmount} keyboardType="decimal-pad" placeholder="50000" />
          </> : null}
          <TextField label="ملاحظة — اختياري" value={note} onChangeText={setNote} placeholder="خلاصة ما حدث مع العميل" multiline />
          <TextField label="الإجراء التالي — اختياري" value={nextActionDate} onChangeText={setNextActionDate} placeholder="YYYY-MM-DD" />
          {error ? <InlineFeedback tone="danger">{error}</InlineFeedback> : null}
          {success ? <InlineFeedback tone="success">{success}</InlineFeedback> : null}
          <Button loading={saving} onPress={save}>حفظ المتابعة</Button>
        </View>

        <View style={styles.section}>
          <SectionHeading title="سجل التواصل" caption="الأحدث أولًا؛ الوعود لا تعد إثبات قبض أو تسوية." />
          {loading ? <LoadingState label="جارٍ تحميل سجل المتابعة" /> : null}
          {!loading && error && history.length === 0 ? <ErrorState message={error} onRetry={() => setRefreshNonce((value) => value + 1)} /> : null}
          {!loading && history.length === 0 ? <EmptyState title="لا توجد متابعة مسجلة" message="ابدأ بتسجيل أول اتصال أو ملاحظة لهذا العميل." /> : null}
          <View style={styles.list}>{history.map((event) => (
            <Surface key={event.eventId} variant="outlined">
              <View style={styles.rowTop}><Text style={styles.rowTitle}>{eventLabel(event.eventKind)}</Text><StatusBadge tone={event.eventKind === 'promise_to_pay' ? 'warning' : 'neutral'}>{new Date(event.createdAt).toLocaleDateString('en-GB')}</StatusBadge></View>
              {event.note ? <Text style={styles.rowBody}>{event.note}</Text> : null}
              {event.promisedFor ? <Text style={styles.rowMeta}>وعد بالسداد: {new Date(`${event.promisedFor}T00:00:00`).toLocaleDateString('en-GB')}</Text> : null}
              {event.nextActionAt ? <Text style={styles.rowMeta}>الإجراء التالي: {new Date(event.nextActionAt).toLocaleDateString('en-GB')}</Text> : null}
            </Surface>
          ))}</View>
        </View>
      </ScrollView>
    </SecondaryShell>
  );
}

const styles = StyleSheet.create({
  content: { gap: theme.spacing.lg, paddingTop: theme.spacing.lg, paddingBottom: theme.spacing.xl },
  explainTitle: { color: theme.colors.text, fontSize: theme.typography.styles.heading.fontSize, fontWeight: '800', textAlign: 'right', writingDirection: 'rtl' },
  explainBody: { color: theme.colors.textMuted, marginTop: theme.spacing.sm, lineHeight: 24, textAlign: 'right', writingDirection: 'rtl' },
  section: { gap: theme.spacing.md },
  chips: { flexDirection: 'row-reverse', flexWrap: 'wrap', gap: theme.spacing.sm },
  chip: { minHeight: theme.layout.minTouchTarget, borderWidth: 1, borderColor: theme.colors.border, borderRadius: theme.radius.full, paddingHorizontal: theme.spacing.md, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.surface },
  chipActive: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  chipText: { color: theme.colors.textMuted, fontWeight: '700', writingDirection: 'rtl' },
  chipTextActive: { color: theme.colors.accentText },
  list: { gap: theme.spacing.sm },
  rowTop: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.sm },
  rowTitle: { color: theme.colors.text, fontWeight: '800', textAlign: 'right', writingDirection: 'rtl' },
  rowBody: { color: theme.colors.textMuted, marginTop: theme.spacing.sm, textAlign: 'right', writingDirection: 'rtl' },
  rowMeta: { color: theme.colors.textMuted, fontSize: theme.typography.caption, marginTop: theme.spacing.xs, textAlign: 'right', writingDirection: 'rtl' },
});
