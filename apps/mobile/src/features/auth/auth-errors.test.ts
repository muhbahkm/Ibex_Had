import { describe, expect, it } from 'vitest';

import { phoneAuthErrorMessage } from './auth-errors';

describe('phoneAuthErrorMessage', () => {
  it('maps SMS rate limits without exposing provider internals', () => {
    expect(phoneAuthErrorMessage({ code: 'over_sms_send_rate_limit', status: 429 })).toContain('انتظر');
  });

  it('maps expired OTPs to an actionable message', () => {
    expect(phoneAuthErrorMessage({ code: 'otp_expired', status: 403 })).toContain('رمزًا جديدًا');
  });

  it('maps provider delivery failures safely', () => {
    expect(phoneAuthErrorMessage({ code: 'sms_send_failed', message: 'provider secret failure' })).toContain('تعذر إرسال');
    expect(phoneAuthErrorMessage({ code: 'sms_send_failed', message: 'provider secret failure' })).not.toContain('secret');
  });

  it('falls back safely for unknown errors', () => {
    expect(phoneAuthErrorMessage(new Error('internal detail'))).toBe('تعذر إكمال التحقق عبر رقم الجوال. حاول مرة أخرى.');
  });
});
