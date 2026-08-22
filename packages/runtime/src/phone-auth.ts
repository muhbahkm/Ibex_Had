import { normalizeFullName, normalizePhoneE164 } from '../../core/src/index.js';

export type PendingPhoneOnboarding = {
  readonly fullName: string;
  readonly phoneE164: string;
};

export interface PhoneAuthErrorLike {
  readonly message: string;
  readonly code?: string | undefined;
  readonly status?: number | undefined;
}

export interface PhoneAuthClient {
  readonly auth: {
    signInWithOtp(input: {
      readonly phone: string;
      readonly options: { readonly shouldCreateUser: boolean };
    }): PromiseLike<{ readonly error: PhoneAuthErrorLike | null }>;
    verifyOtp(input: {
      readonly phone: string;
      readonly token: string;
      readonly type: 'sms';
    }): PromiseLike<{ readonly error: PhoneAuthErrorLike | null }>;
  };
  rpc(functionName: string, args?: Record<string, unknown>): PromiseLike<{
    readonly data: unknown;
    readonly error: PhoneAuthErrorLike | null;
  }>;
}

export type PhoneAuthOperation = 'request_otp' | 'verify_otp' | 'complete_profile' | 'resend_otp';

export class PhoneAuthOperationError extends Error {
  readonly operation: PhoneAuthOperation;
  readonly causeError: PhoneAuthErrorLike;

  constructor(operation: PhoneAuthOperation, error: PhoneAuthErrorLike) {
    super(error.message);
    this.name = 'PhoneAuthOperationError';
    this.operation = operation;
    this.causeError = error;
  }
}

export function normalizePhoneOtpToken(token: string): string {
  const normalized = token.replace(/\D/g, '');
  if (normalized.length !== 6) throw new Error('OTP token must contain exactly 6 digits');
  return normalized;
}

export async function requestPhoneOtp(
  client: PhoneAuthClient,
  input: { readonly fullName: string; readonly phone: string },
): Promise<PendingPhoneOnboarding> {
  const fullName = normalizeFullName(input.fullName);
  const phoneE164 = normalizePhoneE164(input.phone);
  const { error } = await client.auth.signInWithOtp({
    phone: phoneE164,
    options: { shouldCreateUser: true },
  });
  if (error) throw new PhoneAuthOperationError('request_otp', error);
  return { fullName, phoneE164 };
}

export async function verifyPhoneOtpAndCompleteProfile(
  client: PhoneAuthClient,
  pending: PendingPhoneOnboarding,
  token: string,
): Promise<void> {
  const normalizedToken = normalizePhoneOtpToken(token);
  const { error: verifyError } = await client.auth.verifyOtp({
    phone: pending.phoneE164,
    token: normalizedToken,
    type: 'sms',
  });
  if (verifyError) throw new PhoneAuthOperationError('verify_otp', verifyError);

  const { error: profileError } = await client.rpc('complete_profile', {
    p_full_name: pending.fullName,
  });
  if (profileError) throw new PhoneAuthOperationError('complete_profile', profileError);
}

export async function resendPhoneOtp(client: PhoneAuthClient, phone: string): Promise<void> {
  const phoneE164 = normalizePhoneE164(phone);
  const { error } = await client.auth.signInWithOtp({
    phone: phoneE164,
    options: { shouldCreateUser: false },
  });
  if (error) throw new PhoneAuthOperationError('resend_otp', error);
}
