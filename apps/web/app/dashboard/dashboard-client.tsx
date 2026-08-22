'use client';

import type { BusinessSummaryRecord, MyCustomerAccountRecord, NotificationRecord } from '../../../../packages/application/src/ports';
import { formatMinorUnits } from '../../../../packages/core/src/money-presentation';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { ibex } from '../../lib/ibex';
import { createClient } from '../../lib/supabase/client';

function errorMessage(error: unknown): string {
  return error instanceof Error && error.message ? error.message : 'تعذر تحميل مساحة العمل.';
}

function notificationLabel(notification: NotificationRecord): string {
  if (notification.kind === 'transaction_posted') return 'حركة مالية جديدة';
  if (notification.kind === 'dispute_opened') return 'طلب مراجعة جديد';
  return notification.disputeStatus === 'rejected' ? 'تم رفض طلب مراجعة' : 'تمت معالجة طلب مراجعة';
}

export function DashboardClient() {
  const router = useRouter();
  const [businesses, setBusinesses] = useState<readonly BusinessSummaryRecord[]>([]);
  const [accounts, setAccounts] = useState<readonly MyCustomerAccountRecord[]>([]);
  const [notifications, setNotifications] = useState<readonly NotificationRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void Promise.all([
      ibex.listBusinesses(),
      ibex.listMyCustomerAccounts(),
      ibex.listNotifications({ unreadOnly: true, limit: 8 }),
    ])
      .then(([businessRows, accountRows, notificationRows]) => {
        if (!active) return;
        setBusinesses(businessRows);
        setAccounts(accountRows);
        setNotifications(notificationRows);
      })
      .catch((cause: unknown) => {
        if (active) setError(errorMessage(cause));
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => { active = false; };
  }, []);

  async function signOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.replace('/login');
    router.refresh();
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">IH</span><span>IBEX HAD</span></div>
        <div className="actions">
          <span className="badge">Merchant Web</span>
          <button className="button ghost" onClick={() => void signOut()}>تسجيل الخروج</button>
        </div>
      </header>

      <section className="hero">
        <h1>مساحة العمل التجارية</h1>
        <p>واجهة أوسع لإدارة علاقات العملاء والحسابات، مع نفس النواة المالية والصلاحيات المستخدمة في تطبيق الهاتف.</p>
      </section>

      {error ? <div className="error" style={{ marginBottom: 16 }}>{error}</div> : null}
      {loading ? <div className="card muted">جارٍ تحميل بياناتك…</div> : null}

      {!loading ? (
        <div className="grid">
          <section className="card span-8">
            <h2 className="section-title">أنشطتي التجارية</h2>
            <p className="section-subtitle">الأنشطة التي تملكها أو لديك عضوية فعالة فيها.</p>
            <div className="list">
              {businesses.map((business) => (
                <a className="row-card interactive-row" key={business.businessId} href={`/dashboard/business/${business.businessId}`}>
                  <div className="row-main">
                    <p className="row-title">{business.name}</p>
                    <p className="row-meta">{business.defaultCurrencyCode ?? 'بدون عملة افتراضية'} · {business.role}</p>
                  </div>
                  <span className="badge">فتح النشاط</span>
                </a>
              ))}
              {businesses.length === 0 ? <div className="row-card muted">لا يوجد نشاط تجاري مرتبط بهذه الهوية بعد.</div> : null}
            </div>
          </section>

          <aside className="card span-4">
            <h2 className="section-title">الإشعارات</h2>
            <p className="section-subtitle">أهم الأحداث غير المقروءة فقط.</p>
            <div className="list">
              {notifications.map((notification) => (
                <div className="row-card" key={notification.notificationId}>
                  <div className="row-main">
                    <p className="row-title">{notificationLabel(notification)}</p>
                    <p className="row-meta">{notification.businessName}</p>
                  </div>
                </div>
              ))}
              {notifications.length === 0 ? <div className="row-card muted">لا توجد إشعارات غير مقروءة.</div> : null}
            </div>
          </aside>

          <section className="card span-12" style={{ gridColumn: '1 / -1' }}>
            <h2 className="section-title">حساباتي كعميل</h2>
            <p className="section-subtitle">نفس الهوية قد تكون تاجرًا وعميلًا في الوقت نفسه؛ هذه العلاقات تبقى منفصلة بالصلاحيات.</p>
            <div className="list">
              {accounts.map((account) => (
                <div className="row-card" key={account.accountId}>
                  <div className="row-main">
                    <p className="row-title">{account.businessName}</p>
                    <p className="row-meta">{account.currencyCode} · {account.accountStatus}</p>
                  </div>
                  <div className="amount">{formatMinorUnits(account.balanceMinor, account.currencyCode)}</div>
                </div>
              ))}
              {accounts.length === 0 ? <div className="row-card muted">لا توجد حسابات عميل مرتبطة بهويتك حتى الآن.</div> : null}
            </div>
          </section>
        </div>
      ) : null}
    </main>
  );
}
