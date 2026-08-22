import {
  normalizeFullName,
  normalizePhoneE164,
} from '../../../../../packages/core/src/index';

import { supabase } from '../../lib/supabase';
import { phoneAuthErrorMessage } from './auth-errors';

export type PendingPhoneOnboarding = {
  readonly fullName: string;
  readonly phoneE164: string;
};

export async function requestPhoneOtp(input: {
  readonly fullName: string;
  readonly phone: string;
}): Promise<PendingPhoneOnboarding> {
  const fullName = normalizeFullName(input.fullName);
  const phoneE164 = normalizePhoneE164(input.phone);

  const { error } = await supabase.auth.signInWithOtp({
    phone: phoneE164,
    options: {
      shouldCreateUser: true,
    },
  });

  if (error) throw new Error(phoneAuthErrorMessage(error, 'تعذر إرسال رمز التحقق. حاول مرة أخرى.'));
  return { fullName, phoneE164 };
}

export async function verifyPhoneOtpAndCompleteProfile(
  pending: PendingPhoneOnboarding,
  token: string,
): Promise<void> {
  const normalizedToken = token.replace(/\D/g, '');
  if (normalizedToken.length !== 6) {
    throw new Error('رمز التحقق يجب أن يتكون من 6 أرقام.');
  }

  const { error: verifyError } = await supabase.auth.verifyOtp({
    phone: pending.phoneE164,
    token: normalizedToken,
    type: 'sms',
  });
  if (verifyError) {
    throw new Error(phoneAuthErrorMessage(verifyError, 'تعذر التحقق من الرمز. تأكد منه وحاول مرة أخرى.'));
  }

  const { error: profileError } = await supabase.rpc('complete_profile', {
    p_full_name: pending.fullName,
  });
  if (profileError) throw new Error('تم التحقق من رقم الجوال، لكن تعذر إكمال الملف الشخصي. حاول الدخول مرة أخرى.');
}

export async function resendPhoneOtp(phoneE164: string): Promise<void> {
  const { error } = await supabase.auth.signInWithOtp({
    phone: normalizePhoneE164(phoneE164),
    options: {
      shouldCreateUser: false,
    },
  });
  if (error) throw new Error(phoneAuthErrorMessage(error, 'تعذر إعادة إرسال رمز التحقق. حاول مرة أخرى.'));
}
