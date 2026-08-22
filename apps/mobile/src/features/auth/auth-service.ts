import {
  PhoneAuthOperationError,
  type PendingPhoneOnboarding,
  requestPhoneOtp as requestPhoneOtpCore,
  resendPhoneOtp as resendPhoneOtpCore,
  verifyPhoneOtpAndCompleteProfile as verifyPhoneOtpAndCompleteProfileCore,
} from '../../../../../packages/runtime/src/phone-auth';

import { supabase } from '../../lib/supabase';
import { phoneAuthErrorMessage } from './auth-errors';

export type { PendingPhoneOnboarding };

function localizedError(error: unknown, fallback: string): Error {
  if (error instanceof PhoneAuthOperationError) {
    if (error.operation === 'complete_profile') {
      return new Error('تم التحقق من رقم الجوال، لكن تعذر إكمال الملف الشخصي. حاول الدخول مرة أخرى.');
    }
    return new Error(phoneAuthErrorMessage(error.causeError, fallback));
  }
  if (error instanceof Error && error.message === 'OTP token must contain exactly 6 digits') {
    return new Error('رمز التحقق يجب أن يتكون من 6 أرقام.');
  }
  return error instanceof Error ? error : new Error(fallback);
}

export async function requestPhoneOtp(input: {
  readonly fullName: string;
  readonly phone: string;
}): Promise<PendingPhoneOnboarding> {
  try {
    return await requestPhoneOtpCore(supabase, input);
  } catch (error) {
    throw localizedError(error, 'تعذر إرسال رمز التحقق. حاول مرة أخرى.');
  }
}

export async function verifyPhoneOtpAndCompleteProfile(
  pending: PendingPhoneOnboarding,
  token: string,
): Promise<void> {
  try {
    await verifyPhoneOtpAndCompleteProfileCore(supabase, pending, token);
  } catch (error) {
    throw localizedError(error, 'تعذر التحقق من الرمز. تأكد منه وحاول مرة أخرى.');
  }
}

export async function resendPhoneOtp(phoneE164: string): Promise<void> {
  try {
    await resendPhoneOtpCore(supabase, phoneE164);
  } catch (error) {
    throw localizedError(error, 'تعذر إعادة إرسال رمز التحقق. حاول مرة أخرى.');
  }
}
