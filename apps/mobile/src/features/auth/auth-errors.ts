type AuthErrorLike = {
  readonly code?: unknown;
  readonly status?: unknown;
  readonly message?: unknown;
};

function authCode(error: unknown): string | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const code = (error as AuthErrorLike).code;
  return typeof code === 'string' ? code : undefined;
}

function authStatus(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const status = (error as AuthErrorLike).status;
  return typeof status === 'number' ? status : undefined;
}

export function phoneAuthErrorMessage(
  error: unknown,
  fallback = 'تعذر إكمال التحقق عبر رقم الجوال. حاول مرة أخرى.',
): string {
  switch (authCode(error)) {
    case 'over_sms_send_rate_limit':
      return 'تم طلب عدة رموز خلال وقت قصير. انتظر قليلًا ثم حاول مرة أخرى.';
    case 'over_request_rate_limit':
      return 'تم إرسال عدد كبير من المحاولات من هذا الاتصال. انتظر بضع دقائق ثم حاول مرة أخرى.';
    case 'otp_expired':
      return 'انتهت صلاحية رمز التحقق أو أنه غير صحيح. اطلب رمزًا جديدًا وحاول مرة أخرى.';
    case 'sms_send_failed':
      return 'تعذر إرسال رسالة التحقق إلى هذا الرقم حاليًا. تحقق من الرقم وحاول مرة أخرى لاحقًا.';
    case 'phone_provider_disabled':
    case 'otp_disabled':
    case 'provider_disabled':
      return 'خدمة الدخول برقم الجوال غير متاحة حاليًا. يرجى المحاولة لاحقًا.';
    case 'validation_failed':
      return 'رقم الجوال أو بيانات التحقق غير صالحة. تحقق من البيانات وحاول مرة أخرى.';
    case 'request_timeout':
      return 'استغرق الاتصال وقتًا أطول من المتوقع. تحقق من الإنترنت وحاول مرة أخرى.';
    default:
      if (authStatus(error) === 429) {
        return 'تم تجاوز عدد المحاولات المسموح مؤقتًا. انتظر قليلًا ثم حاول مرة أخرى.';
      }
      return fallback;
  }
}
