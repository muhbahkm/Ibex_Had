import type { CollectionRecommendedAction } from './collection-engagement.js';

export type CollectionMessageChannel = 'whatsapp' | 'sms';
export type CollectionMessageTone = 'cordial' | 'firm';

export interface CollectionMessageDraftInput {
  readonly displayName: string;
  readonly businessName: string;
  readonly currencyCode: string;
  readonly balanceDisplay: string;
  readonly dueDateDisplay: string;
  readonly daysOverdue: number;
  readonly recommendedAction: CollectionRecommendedAction;
  readonly reasonCode: string;
  readonly promisedForDisplay?: string;
  readonly promisedAmountDisplay?: string;
  readonly channel?: CollectionMessageChannel;
  readonly tone?: CollectionMessageTone;
}

export interface CollectionMessageDraft {
  readonly channel: CollectionMessageChannel;
  readonly tone: CollectionMessageTone;
  readonly body: string;
  readonly reasonCode: string;
  readonly recommendedAction: CollectionRecommendedAction;
  readonly requiresApproval: true;
  readonly autoSendAllowed: false;
  readonly facts: readonly string[];
}

function text(value: string, field: string): string {
  const normalized = value.trim().replace(/\s+/g, ' ');
  if (!normalized) throw new Error(`${field} is required`);
  return normalized;
}

function nonNegativeInteger(value: number, field: string): number {
  if (!Number.isInteger(value) || value < 0) throw new Error(`${field} must be a non-negative integer`);
  return value;
}

function opening(name: string): string {
  return `السلام عليكم ${name}،`;
}

function closing(businessName: string, tone: CollectionMessageTone): string {
  return tone === 'firm'
    ? `نرجو إفادتنا بحالة السداد أو موعد واضح للتسوية. شكرًا لتعاونكم — ${businessName}`
    : `يسعدنا تأكيد الموعد المناسب لكم، وشكرًا لتعاونكم — ${businessName}`;
}

function actionSentence(input: {
  readonly action: CollectionRecommendedAction;
  readonly balanceDisplay: string;
  readonly currencyCode: string;
  readonly dueDateDisplay: string;
  readonly daysOverdue: number;
  readonly promisedForDisplay?: string;
  readonly promisedAmountDisplay?: string;
}): string {
  const balance = `${input.balanceDisplay} ${input.currencyCode}`;
  switch (input.action) {
    case 'follow_up_broken_promise':
      return input.promisedForDisplay
        ? `نتابع معكم بخصوص الرصيد المستحق ${balance}. كان موعد السداد المتفق عليه ${input.promisedForDisplay} ولم يظهر لدينا تسجيل قبض حتى الآن.`
        : `نتابع معكم بخصوص الرصيد المستحق ${balance}. يوجد وعد سداد سابق لم يظهر مقابله تسجيل قبض حتى الآن.`;
    case 'confirm_payment_promise':
      return input.promisedAmountDisplay
        ? `تذكير ودي بأن وعد السداد اليوم يتعلق بمبلغ ${input.promisedAmountDisplay} ${input.currencyCode} من الرصيد المستحق ${balance}.`
        : `تذكير ودي بموعد السداد المتفق عليه اليوم للرصيد المستحق ${balance}.`;
    case 'execute_scheduled_follow_up':
      return `هذه متابعة مجدولة بخصوص الرصيد المستحق ${balance}، وتاريخ الاستحقاق المسجل هو ${input.dueDateDisplay}.`;
    case 'contact_customer':
      return input.daysOverdue > 0
        ? `نود المتابعة بخصوص الرصيد المستحق ${balance}، وقد تجاوز تاريخ الاستحقاق المسجل منذ ${String(input.daysOverdue)} يوم.`
        : `نود المتابعة بخصوص الرصيد المستحق ${balance} وتأكيد خطة السداد المناسبة.`;
    case 'review_recent_contact':
      return `نعود إليكم لمتابعة التواصل الأخير بخصوص الرصيد المستحق ${balance} واستكمال ما تم الاتفاق عليه.`;
    case 'send_due_today_reminder':
      return `تذكير ودي بأن تاريخ استحقاق الرصيد ${balance} هو اليوم.`;
    case 'prepare_due_soon_reminder':
      return `تذكير مبكر بأن الرصيد ${balance} يستحق بتاريخ ${input.dueDateDisplay}.`;
  }
}

export function createCollectionMessageDraft(input: CollectionMessageDraftInput): CollectionMessageDraft {
  const displayName = text(input.displayName, 'displayName');
  const businessName = text(input.businessName, 'businessName');
  const currencyCode = text(input.currencyCode, 'currencyCode').toUpperCase();
  const balanceDisplay = text(input.balanceDisplay, 'balanceDisplay');
  const dueDateDisplay = text(input.dueDateDisplay, 'dueDateDisplay');
  const daysOverdue = nonNegativeInteger(input.daysOverdue, 'daysOverdue');
  const channel = input.channel ?? 'whatsapp';
  const tone = input.tone ?? (input.reasonCode === 'broken_promise' ? 'firm' : 'cordial');
  const promisedForDisplay = input.promisedForDisplay?.trim() || undefined;
  const promisedAmountDisplay = input.promisedAmountDisplay?.trim() || undefined;

  const sentence = actionSentence({
    action: input.recommendedAction,
    balanceDisplay,
    currencyCode,
    dueDateDisplay,
    daysOverdue,
    ...(promisedForDisplay ? { promisedForDisplay } : {}),
    ...(promisedAmountDisplay ? { promisedAmountDisplay } : {}),
  });

  const body = `${opening(displayName)}\n\n${sentence}\n\n${closing(businessName, tone)}`;
  const facts = [
    `currency:${currencyCode}`,
    `balance:${balanceDisplay}`,
    `due:${dueDateDisplay}`,
    `daysOverdue:${String(daysOverdue)}`,
    `reason:${input.reasonCode}`,
    ...(promisedForDisplay ? [`promiseDate:${promisedForDisplay}`] : []),
    ...(promisedAmountDisplay ? [`promiseAmount:${promisedAmountDisplay}`] : []),
  ];

  return {
    channel,
    tone,
    body,
    reasonCode: input.reasonCode,
    recommendedAction: input.recommendedAction,
    requiresApproval: true,
    autoSendAllowed: false,
    facts,
  };
}
