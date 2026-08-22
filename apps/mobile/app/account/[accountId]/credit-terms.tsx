import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../../../src/features/auth/auth-context';
import { setCreditTerms } from '../../../src/lib/credit-followup';
import { Button, InlineFeedback, Surface, TextField } from '../../../src/ui/primitives';
import { SecondaryShell } from '../../../src/ui/secondary-shell';
import { theme } from '../../../src/ui/theme';

function param(value: string | string[] | undefined): string { return Array.isArray(value) ? (value[0] ?? '') : (value ?? ''); }
function asInteger(value: string, field: string, max: number): number {
  if (!/^\d+$/.test(value.trim())) throw new Error(`${field} يجب أن يكون رقمًا صحيحًا.`);
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0 || parsed > max) throw new Error(`${field} خارج النطاق المسموح.`);
  return parsed;
}

export default function CreditTermsScreen() {
  const router = useRouter();
  const { session, isPreviewMode } = useAuth();
  const params = useLocalSearchParams<{ accountId?: string; displayName?: string; currencyCode?: string }>();
  const accountId = param(params.accountId);
  const displayName = param(params.displayName) || 'العميل';
  const currencyCode = param(params.currencyCode) || '—';
  const [termsDays, setTermsDays] = useState('30');
  const [graceDays, setGraceDays] = useState('0');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'danger' | 'info'; message: string } | null>(null);

  if (!session) return <Redirect href="/sign-in" />;
  if (!accountId) return <Redirect href="/home" />;

  async function save() {
    setSaving(true);
    setFeedback(null);
    try {
      const result = await setCreditTerms({
        accountId,
        termsDays: asInteger(termsDays, 'مدة الائتمان', 3650),
        graceDays: asInteger(graceDays, 'فترة السماح', 365),
        enabled: true,
      });
      setFeedback({ tone: 'success', message: `تم حفظ الشروط: ${String(result.termsDays)} يوم + ${String(result.graceDays)} يوم سماح.` });
    } catch (error) {
      setFeedback({ tone: 'danger', message: error instanceof Error ? error.message : 'تعذر حفظ شروط الائتمان.' });
    } finally {
      setSaving(false);
    }
  }

  return (
    <SecondaryShell title="شروط الائتمان" subtitle={`${displayName} · ${currencyCode}`} onBack={() => router.back()}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <Surface variant="tinted">
          <Text style={styles.title}>حدد الاستحقاق مرة، واحفظه تاريخيًا مع كل بيع آجل.</Text>
          <Text style={styles.body}>أي بيع آجل جديد سيأخذ Snapshot للشروط الحالية لحظة اعتماده. تغيير الشروط لاحقًا لا يعيد كتابة تواريخ استحقاق المبيعات السابقة.</Text>
        </Surface>

        {isPreviewMode ? <InlineFeedback tone="info">في Preview سيتم اختبار الواجهة فقط ولن تُكتب شروط فعلية في Supabase.</InlineFeedback> : null}
        {feedback ? <InlineFeedback tone={feedback.tone}>{feedback.message}</InlineFeedback> : null}

        <View style={styles.form}>
          <TextField label="مدة الائتمان بالأيام" value={termsDays} onChangeText={setTermsDays} keyboardType="number-pad" placeholder="30" />
          <TextField label="فترة السماح بعد الاستحقاق" value={graceDays} onChangeText={setGraceDays} keyboardType="number-pad" placeholder="0" />
          <Button onPress={() => void save()} disabled={saving}>{saving ? 'جارٍ الحفظ…' : 'حفظ شروط الائتمان'}</Button>
        </View>

        <Surface variant="outlined">
          <Text style={styles.noteTitle}>كيف تُستخدم هذه البيانات؟</Text>
          <Text style={styles.body}>قائمة «متابعة اليوم» تضع الحساب في متأخر فقط بعد تجاوز تاريخ الاستحقاق وفترة السماح. المبلغ المعروض يبقى الرصيد الحالي للحساب ولا يُقدَّم على أنه رصيد فاتورة محددة ما لم نضيف نظام تخصيص تحصيل على الفواتير لاحقًا.</Text>
        </Surface>
      </ScrollView>
    </SecondaryShell>
  );
}

const styles = StyleSheet.create({
  content: { gap: theme.spacing.lg, paddingTop: theme.spacing.lg, paddingBottom: theme.spacing.xl },
  form: { gap: theme.spacing.md },
  title: { color: theme.colors.text, fontSize: theme.typography.styles.heading.fontSize, fontWeight: '800', textAlign: 'right', writingDirection: 'rtl' },
  noteTitle: { color: theme.colors.text, fontWeight: '800', textAlign: 'right', writingDirection: 'rtl' },
  body: { color: theme.colors.textMuted, marginTop: theme.spacing.sm, lineHeight: 24, textAlign: 'right', writingDirection: 'rtl' },
});
