import { describe, expect, it } from 'vitest';

import {
  PhoneAuthOperationError,
  type PhoneAuthClient,
  requestPhoneOtp,
  resendPhoneOtp,
  verifyPhoneOtpAndCompleteProfile,
} from './phone-auth.js';

class RecordingPhoneClient implements PhoneAuthClient {
  readonly calls: Array<{ operation: string; payload: unknown }> = [];
  requestError: { message: string; code?: string } | null = null;
  verifyError: { message: string; code?: string } | null = null;
  profileError: { message: string; code?: string } | null = null;

  readonly auth = {
    signInWithOtp: (input: { readonly phone: string; readonly options: { readonly shouldCreateUser: boolean } }) => {
      this.calls.push({ operation: 'signInWithOtp', payload: input });
      return Promise.resolve({ error: this.requestError });
    },
    verifyOtp: (input: { readonly phone: string; readonly token: string; readonly type: 'sms' }) => {
      this.calls.push({ operation: 'verifyOtp', payload: input });
      return Promise.resolve({ error: this.verifyError });
    },
  };

  rpc(functionName: string, args?: Record<string, unknown>) {
    this.calls.push({ operation: functionName, payload: args });
    return Promise.resolve({ data: null, error: this.profileError });
  }
}

describe('shared phone auth runtime', () => {
  it('normalizes identity before requesting OTP', async () => {
    const client = new RecordingPhoneClient();
    const pending = await requestPhoneOtp(client, { fullName: '  محمد   علي ', phone: '0777 123 456' });
    expect(pending).toEqual({ fullName: 'محمد علي', phoneE164: '+967777123456' });
    expect(client.calls[0]).toEqual({ operation: 'signInWithOtp', payload: { phone: '+967777123456', options: { shouldCreateUser: true } } });
  });

  it('verifies six Latin/Unicode digits then completes the server-owned profile', async () => {
    const client = new RecordingPhoneClient();
    await verifyPhoneOtpAndCompleteProfile(client, { fullName: 'محمد علي', phoneE164: '+967777123456' }, '12 34 56');
    expect(client.calls[0]).toEqual({ operation: 'verifyOtp', payload: { phone: '+967777123456', token: '123456', type: 'sms' } });
    expect(client.calls[1]).toEqual({ operation: 'complete_profile', payload: { p_full_name: 'محمد علي' } });
  });

  it('does not complete the profile when OTP verification fails', async () => {
    const client = new RecordingPhoneClient();
    client.verifyError = { message: 'invalid token', code: 'otp_expired' };
    await expect(verifyPhoneOtpAndCompleteProfile(client, { fullName: 'محمد علي', phoneE164: '+967777123456' }, '123456')).rejects.toMatchObject({ name: 'PhoneAuthOperationError', operation: 'verify_otp' });
    expect(client.calls).toHaveLength(1);
  });

  it('resends without creating a new user', async () => {
    const client = new RecordingPhoneClient();
    await resendPhoneOtp(client, '0777123456');
    expect(client.calls[0]).toEqual({ operation: 'signInWithOtp', payload: { phone: '+967777123456', options: { shouldCreateUser: false } } });
  });

  it('preserves structured provider failures', async () => {
    const client = new RecordingPhoneClient();
    client.requestError = { message: 'rate limited', code: 'over_request_rate_limit' };
    await expect(requestPhoneOtp(client, { fullName: 'محمد علي', phone: '0777123456' })).rejects.toBeInstanceOf(PhoneAuthOperationError);
  });
});
