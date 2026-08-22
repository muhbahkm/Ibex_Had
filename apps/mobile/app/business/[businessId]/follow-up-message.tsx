import { createCollectionMessageDraft, type CollectionMessageChannel, type CollectionMessageTone, type CollectionRecommendedAction } from '../../../../../packages/application/src/index';
import { Redirect, useLocalSearchParams, useRouter } from 'expo-router';
import { useMemo, useState } from 'react';
import { Share, ScrollView, StyleSheet, Text, View } from 'react-native';

import { useAuth } from '../../../src/features/auth/auth-context';
import { Button, InlineFeedback, Surface } from '../../../src/ui/primitives';
import { SectionHeading, StatusBadge } from '../../../src/ui/operational-primitives';
import { SecondaryShell } from '../../../src/ui/secondary-shell';
import { theme } from '../../../src/ui/theme';

function param(value: string | string[] | undefined): string { return Array.isArray(value) ? (value[0] ?? '') : (value ?? ''); }
function numberParam(value: string | string[] | undefined): number { const parsed = Number(param(value)); return Number.isFinite(parsed) && parsed >= 0 ? Math.trunc(parsed) : 0; }
function isAction(value: string): value is CollectionRecommendedAction {
  return ['follow_up_broken_promise','confirm_payment_promise','execute_scheduled_follow_up','contact_customer','review_recent_contact','send_due_today_reminder','prepare_due_soon_reminder'].includes(value);
}

export default function FollowUpMessageScreen() {
  const router = useRouter();
  const { session, isPreviewMode } = useAuth();
  const params = useLocalSearchParams<{
    businessId?: string; businessName?: string; displayName?: string; currencyCode?: string; balanceDisplay?: string;
    dueDateDisplay?: string; daysOverdue?: string; recommendedAction?: string; reasonCode?: string;
    promisedForDisplay?: string; promisedAmountDisplay?: string;
  }>();
  const businessId = param(params.businessId);
  const businessName = param(params.businessName) || 'النشاط';
  const displayName = param(params.displayName) || 'العميل';
  const currencyCode = param(params.currencyCode);
  const balanceDisplay = param(params.balanceDisplay);
  const dueDateDisplay = param(params.dueDateDisplay);
  const recommendedActionValue = param(params.recommendedAction);
  const reasonCode = param(params.reasonCode) || 'follow_up';
  const promisedForDisplay = param(params.promisedForDisplay);
  const promisedAmountDisplay = param(params.promisedAmountDisplay);
  const [channel, setChannel] = useState<CollectionMessageChannel>('whatsapp');
  const [tone, setTone] = useState<CollectionMessageTone>(reasonCode === 'broken_promise' ? 'firm' : 'cordial');
  const [sharing, setSharing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!session) return <Redirect href="/sign-in" />;
  if (!businessId || !currencyCode || !balanceDisplay || !dueDateDisplay || !isAction(recommendedActionValue)) return <Redirect href="/home" />;

  const draft = useMemo(() => createCollectionMessageDraft({
    displayName,
    businessName,
    currencyCode,
    balanceDisplay,
    dueDateDisplay,
    daysOverdue: numberParam(params.daysOverdue),
    recommendedAction: recommendedActionValue,
    reasonCode,
    channel,
    tone,
    ...(promisedForDisplay ? { promisedForDisplay } : {}),
    ...(promisedAmountDisplay ? { promisedAmountDisplay } : {}),
  }), [displayName, businessName, currencyCode, balanceDisplay, dueDateDisplay, params.daysOverdue, recommendedActionValue, reasonCode, channel, tone, promisedForDisplay, promisedAmountDisplay]);

  const share = () => {
    if (sharing) return;
    setSharing(true); setError(null);
    void Share.share({ message: draft.body })
      .catch((cause: unknown) => setError(cause instanceof Error && cause.message ? cause.message : 'تعذر فتح المشاركة.'))
      .finally(() => setSharing(false));
  };

  return (
    <SecondaryShell title="مسودة متابعة" subtitle={`${displayName} · ${businessName}`} onBack={() => router.back()}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Surface variant="tinted">
          <Text style={styles.title}>مسودة مبنية على حقائق الحساب فقط</Text>
          <Text style={styles.body}>هذه المسودة لا تُرسل تلقائيًا. راجع النص أولًا، ثم استخدم المشاركة إذا قررت اعتماده. إنشاء المسودة لا يغيّر الرصيد ولا يسجل قبضًا ولا وعدًا جديدًا.</Text>
        </Surface>
        {isPreviewMode ? <InlineFeedback tone="info">Preview يولد النص محليًا فقط ولا يرسل أي رسالة خارج التطبيق.</InlineFeedback> : null}

        <View style={styles.section}>
          <SectionHeading title="قناة الرسالة" caption="القناة هنا تضبط صيغة المسودة فقط؛ الإرسال يبقى يدويًا بعد الموافقة." />
          <View style={styles.actions}>
            <View style={styles.actionItem}><Button variant={channel === 'whatsapp' ? 'primary' : 'secondary'} onPress={() => setChannel('whatsapp')}>واتساب</Button></View>
            <View style={styles.actionItem}><Button variant={channel === 'sms' ? 'primary' : 'secondary'} onPress={() => setChannel('sms')}>SMS</Button></View>
          </View>
        </View>

        <View style={styles.section}>
          <SectionHeading title="نبرة الرسالة" caption="النبرة لا تغير الحقائق أو الأرقام أو تاريخ الاستحقاق." />
          <View style={styles.actions}>
            <View style={styles.actionItem}><Button variant={tone === 'cordial' ? 'primary' : 'secondary'} onPress={() => setTone('cordial')}>ودية</Button></View>
            <View style={styles.actionItem}><Button variant={tone === 'firm' ? 'primary' : 'secondary'} onPress={() => setTone('firm')}>حازمة باحترام</Button></View>
          </View>
        </View>

        <Surface variant="outlined">
          <View style={styles.draftHead}>
            <Text style={styles.draftTitle}>النص المقترح</Text>
            <StatusBadge tone="warning">يتطلب موافقة</StatusBadge>
          </View>
          <Text selectable style={styles.draftBody}>{draft.body}</Text>
        </Surface>

        <Surface variant="outlined">
          <SectionHeading title="مصدر الحقائق" caption="للتدقيق: هذه هي البيانات التي سمح للمسودة باستخدامها." />
          <View style={styles.facts}>{draft.facts.map((fact) => <Text key={fact} style={styles.fact}>{fact}</Text>)}</View>
        </Surface>

        {error ? <InlineFeedback tone="danger">{error}</InlineFeedback> : null}
        <Button loading={sharing} onPress={share}>مشاركة بعد المراجعة</Button>
        <Text style={styles.note}>فتح نافذة المشاركة لا يعني أن الرسالة أُرسلت. الإرسال الفعلي يظل قرارًا صريحًا من المستخدم داخل التطبيق المستهدف.</Text>
      </ScrollView>
    </SecondaryShell>
  );
}

const styles = StyleSheet.create({
  content: { gap: theme.spacing.lg, paddingTop: theme.spacing.lg, paddingBottom: theme.spacing.xl },
  title: { color: theme.colors.text, fontSize: theme.typography.styles.heading.fontSize, fontWeight: '800', textAlign: 'right', writingDirection: 'rtl' },
  body: { color: theme.colors.textMuted, marginTop: theme.spacing.sm, lineHeight: 24, textAlign: 'right', writingDirection: 'rtl' },
  section: { gap: theme.spacing.md },
  actions: { flexDirection: 'row-reverse', gap: theme.spacing.sm },
  actionItem: { flex: 1 },
  draftHead: { flexDirection: 'row-reverse', alignItems: 'center', justifyContent: 'space-between', gap: theme.spacing.sm },
  draftTitle: { color: theme.colors.text, fontWeight: '800', textAlign: 'right', writingDirection: 'rtl' },
  draftBody: { color: theme.colors.text, marginTop: theme.spacing.md, lineHeight: 27, textAlign: 'right', writingDirection: 'rtl' },
  facts: { gap: theme.spacing.xs, marginTop: theme.spacing.md },
  fact: { color: theme.colors.textMuted, fontSize: theme.typography.caption, textAlign: 'left', writingDirection: 'ltr' },
  note: { color: theme.colors.textMuted, fontSize: theme.typography.caption, textAlign: 'right', writingDirection: 'rtl' },
});
