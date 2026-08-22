import { describe, expect, it } from 'vitest';

import { createCollectionMessageDraft } from './collection-message-draft.js';

describe('createCollectionMessageDraft', () => {
  it('creates an approval-only broken-promise draft from supplied facts', () => {
    const draft = createCollectionMessageDraft({
      displayName: 'أحمد',
      businessName: 'باحكم للعسل',
      currencyCode: 'yer',
      balanceDisplay: '125,000',
      dueDateDisplay: '20/08/2026',
      daysOverdue: 2,
      recommendedAction: 'follow_up_broken_promise',
      reasonCode: 'broken_promise',
      promisedForDisplay: '21/08/2026',
    });

    expect(draft.channel).toBe('whatsapp');
    expect(draft.tone).toBe('firm');
    expect(draft.requiresApproval).toBe(true);
    expect(draft.autoSendAllowed).toBe(false);
    expect(draft.body).toContain('125,000 YER');
    expect(draft.body).toContain('21/08/2026');
    expect(draft.facts).toContain('reason:broken_promise');
  });

  it('does not invent a promised amount when none was supplied', () => {
    const draft = createCollectionMessageDraft({
      displayName: 'علي',
      businessName: 'المتجر',
      currencyCode: 'SAR',
      balanceDisplay: '500.00',
      dueDateDisplay: '22/08/2026',
      daysOverdue: 0,
      recommendedAction: 'confirm_payment_promise',
      reasonCode: 'promise_due_today',
      promisedForDisplay: '22/08/2026',
    });

    expect(draft.body).toContain('موعد السداد المتفق عليه اليوم');
    expect(draft.body).not.toContain('مبلغ 0');
    expect(draft.facts.some((fact) => fact.startsWith('promiseAmount:'))).toBe(false);
  });

  it('keeps due-soon reminders cordial and factual', () => {
    const draft = createCollectionMessageDraft({
      displayName: 'سالم',
      businessName: 'النشاط',
      currencyCode: 'USD',
      balanceDisplay: '120.00',
      dueDateDisplay: '29/08/2026',
      daysOverdue: 0,
      recommendedAction: 'prepare_due_soon_reminder',
      reasonCode: 'due_soon',
      channel: 'sms',
    });

    expect(draft.channel).toBe('sms');
    expect(draft.tone).toBe('cordial');
    expect(draft.body).toContain('تذكير مبكر');
    expect(draft.body).not.toContain('متأخر');
  });
});
