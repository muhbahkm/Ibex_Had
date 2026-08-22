'use client';

import { useEffect, useState } from 'react';

import { ibex } from '../../../lib/ibex';

function messageOf(error: unknown): string {
  return error instanceof Error && error.message ? error.message : 'تعذر تحميل الإشعارات.';
}

function label(kind: string, disputeStatus?: string): string {
  if (kind === 'transaction_posted') return 'حركة مالية جديدة';
  if (kind === 'dispute_opened') return 'طلب مراجعة جديد';
  return disputeStatus === 'rejected' ? 'تم رفض طلب مراجعة' : 'تمت معالجة طلب مراجعة';
}

export function NotificationsClient() {
  const [rows, setRows] = useState<Awaited<ReturnType<typeof ibex.listNotifications>>>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    setRows(await ibex.listNotifications({ limit: 200 }));
  }

  useEffect(() => {
    let active = true;
    void load().catch((cause: unknown) => { if (active) setError(messageOf(cause)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, []);

  async function markRead(notificationId: string) {
    setBusyId(notificationId);
    setError(null);
    try {
      await ibex.markNotificationRead({ notificationId });
      await load();
    } catch (cause: unknown) {
      setError(messageOf(cause));
    } finally {
      setBusyId(null);
    }
  }

  return (
    <main className="shell narrow-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">IH</span><span>الإشعارات</span></div>
        <a className="button ghost" href="/dashboard">الرئيسية</a>
      </header>
      <section className="hero compact-hero"><h1>صندوق الإشعارات</h1><p>سجل دائم للأحداث المهمة. قنوات Push أو SMS المستقبلية ستكون وسيلة توصيل فقط وليست مصدر الحقيقة.</p></section>
      {error ? <div className="error page-message">{error}</div> : null}
      <section className="card">
        <div className="section-head"><div><h2 className="section-title">الأحداث</h2><p className="section-subtitle">الأحدث أولًا.</p></div><span className="badge">{rows.filter((row) => !row.readAt).length} غير مقروء</span></div>
        <div className="list">
          {loading ? <div className="row-card muted">جارٍ التحميل…</div> : null}
          {!loading && rows.map((row) => (
            <div className={row.readAt ? 'row-card notification-read' : 'row-card'} key={row.notificationId}>
              <div className="row-main">
                <div className="row-title-line"><p className="row-title">{label(row.kind, row.disputeStatus)}</p>{!row.readAt ? <span className="badge">جديد</span> : null}</div>
                <p className="row-meta">{row.businessName} · {new Date(row.createdAt).toLocaleString('en-GB', { hour12: false })}</p>
              </div>
              {!row.readAt ? <button className="button ghost compact-button" disabled={busyId === row.notificationId} onClick={() => void markRead(row.notificationId)}>{busyId === row.notificationId ? 'جارٍ الحفظ…' : 'تحديد كمقروء'}</button> : null}
            </div>
          ))}
          {!loading && rows.length === 0 ? <div className="row-card muted">لا توجد إشعارات حتى الآن.</div> : null}
        </div>
      </section>
    </main>
  );
}
