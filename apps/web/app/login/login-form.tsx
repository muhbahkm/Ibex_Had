'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';

import {
  PhoneAuthOperationError,
  type PendingPhoneOnboarding,
  requestPhoneOtp,
  resendPhoneOtp,
  verifyPhoneOtpAndCompleteProfile,
} from '../../../../packages/runtime/src/phone-auth';
import { createClient } from '../../lib/supabase/client';

function message(error: unknown): string {
  if (error instanceof PhoneAuthOperationError) {
    if (error.operation === 'request_otp' || error.operation === 'resend_otp') {
      return 'تعذر إرسال رمز التحقق. تحقق من الرقم أو حاول لاحقًا.';
    }
    if (error.operation === 'verify_otp') return 'رمز التحقق غير صحيح أو انتهت صلاحيته.';
    return 'تم التحقق من الرقم لكن تعذر إكمال الملف الشخصي.';
  }
  if (error instanceof Error && error.message === 'OTP token must contain exactly 6 digits') {
    return 'رمز التحقق يجب أن يتكون من 6 أرقام.';
  }
  return error instanceof Error ? error.message : 'تعذر إكمال تسجيل الدخول.';
}

export function LoginForm() {
  const router = useRouter();
  const supabase = createClient();
  const [fullName, setFullName] = useState('');
  const [phone, setPhone] = useState('');
  const [token, setToken] = useState('');
  const [pending, setPending] = useState<PendingPhoneOnboarding | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  async function sendOtp() {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const nextPending = await requestPhoneOtp(supabase, { fullName, phone });
      setPending(nextPending);
      setPhone(nextPending.phoneE164);
      setNotice('تم إرسال رمز التحقق إلى رقم الجوال.');
    } catch (cause) {
      setError(message(cause));
    } finally {
      setBusy(false);
    }
  }

  async function verifyOtp() {
    if (!pending) return;
    setBusy(true);
    setError(null);
    try {
      await verifyPhoneOtpAndCompleteProfile(supabase, pending, token);
      router.replace('/dashboard');
      router.refresh();
    } catch (cause) {
      setError(message(cause));
    } finally {
      setBusy(false);
    }
  }

  async function resend() {
    if (!pending) return;
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      await resendPhoneOtp(supabase, pending.phoneE164);
      setNotice('أعيد إرسال رمز التحقق.');
    } catch (cause) {
      setError(message(cause));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      {!pending ? (
        <>
          <div className="field">
            <label htmlFor="full-name">الاسم</label>
            <input id="full-name" autoComplete="name" value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="محمد عبدالله" />
          </div>
          <div className="field">
            <label htmlFor="phone">رقم الجوال</label>
            <input id="phone" className="ltr" inputMode="tel" autoComplete="tel" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="0777 123 456" />
          </div>
          <button className="button" disabled={busy || fullName.trim().length < 2 || phone.trim().length < 7} onClick={() => void sendOtp()}>
            {busy ? 'جارٍ الإرسال…' : 'إرسال رمز التحقق'}
          </button>
        </>
      ) : (
        <>
          <div className="field">
            <label htmlFor="otp">رمز التحقق</label>
            <input id="otp" className="ltr" inputMode="numeric" autoComplete="one-time-code" maxLength={6} value={token} onChange={(event) => setToken(event.target.value.replace(/\D/g, '').slice(0, 6))} placeholder="000000" />
          </div>
          <button className="button" disabled={busy || token.length !== 6} onClick={() => void verifyOtp()}>
            {busy ? 'جارٍ التحقق…' : 'دخول'}
          </button>
          <div className="actions">
            <button className="button secondary" disabled={busy} onClick={() => void resend()}>إعادة الإرسال</button>
            <button className="button ghost" disabled={busy} onClick={() => { setPending(null); setToken(''); setNotice(null); setError(null); }}>تغيير الرقم</button>
          </div>
        </>
      )}
      {notice ? <div className="success">{notice}</div> : null}
      {error ? <div className="error">{error}</div> : null}
    </div>
  );
}
