'use client';

import type { BusinessCustomerSummaryRecord, BusinessSummaryRecord } from '../../../../../../packages/application/src/ports';
import { useEffect, useMemo, useState } from 'react';

import { ibex } from '../../../../lib/ibex';

function messageOf(error: unknown): string {
  return error instanceof Error && error.message ? error.message : 'تعذر تنفيذ العملية.';
}

export function BusinessWorkspaceClient({ businessId }: { readonly businessId: string }) {
  const [business, setBusiness] = useState<BusinessSummaryRecord | null>(null);
  const [customers, setCustomers] = useState<readonly BusinessCustomerSummaryRecord[]>([]);
  const [search, setSearch] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(query?: string) {
    setError(null);
    const [businessRows, customerRows] = await Promise.all([
      ibex.listBusinesses(),
      ibex.listBusinessCustomers({ businessId, limit: 200, ...(query?.trim() ? { search: query.trim() } : {}) }),
    ]);
    setBusiness(businessRows.find((row) => row.businessId === businessId) ?? null);
    setCustomers(customerRows);
  }

  useEffect(() => {
    let active = true;
    void load()
      .catch((cause: unknown) => { if (active) setError(messageOf(cause)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [businessId]);

  const title = useMemo(() => business?.name ?? 'مساحة النشاط', [business]);

  async function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    try { await load(search); } catch (cause: unknown) { setError(messageOf(cause)); } finally { setLoading(false); }
  }

  async function createCustomer(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await ibex.createCustomer({ businessId, displayName: name, ...(phone.trim() ? { phone } : {}) }, crypto.randomUUID());
      setName('');
      setPhone('');
      await load(search);
    } catch (cause: unknown) {
      setError(messageOf(cause));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">IH</span><span>{title}</span></div>
        <div className="actions"><a className="button ghost" href={`/dashboard/business/${businessId}/disputes`}>طلبات المراجعة</a><a className="button ghost" href="/dashboard">لوحة التحكم</a></div>
      </header>

      <section className="hero compact-hero">
        <h1>العملاء والحسابات</h1>
        <p>ابحث عن العميل أو أنشئ علاقة جديدة، ثم افتح حساب العملة وتابع الحركات من نفس النواة المالية.</p>
      </section>

      {error ? <div className="error page-message">{error}</div> : null}

      <div className="grid">
        <section className="card span-8">
          <div className="section-head">
            <div><h2 className="section-title">العملاء</h2><p className="section-subtitle">{customers.length} نتيجة</p></div>
            <form className="inline-form" onSubmit={(event) => void submitSearch(event)}>
              <input aria-label="بحث العملاء" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="الاسم أو رقم الجوال" />
              <button className="button secondary compact-button" disabled={loading}>بحث</button>
            </form>
          </div>
          <div className="list">
            {loading ? <div className="row-card muted">جارٍ التحميل…</div> : null}
            {!loading && customers.map((customer) => (
              <a className="row-card interactive-row" key={customer.businessCustomerId} href={`/dashboard/business/${businessId}/customer/${customer.businessCustomerId}/${customer.customerIdentityId}`}>
                <div className="row-main">
                  <p className="row-title">{customer.displayName}</p>
                  <p className="row-meta">{customer.phoneE164 ?? 'بدون رقم جوال'} · {customer.accountCount} حساب</p>
                </div>
                <span className="badge">فتح الحساب</span>
              </a>
            ))}
            {!loading && customers.length === 0 ? <div className="row-card muted">لا توجد نتائج مطابقة.</div> : null}
          </div>
        </section>

        <aside className="card span-4">
          <h2 className="section-title">عميل جديد</h2>
          <p className="section-subtitle">رقم الجوال اختياري الآن، ويمكن استخدامه لاحقًا لدعوة العميل إلى حسابه المشترك.</p>
          <form className="stack form-space" onSubmit={(event) => void createCustomer(event)}>
            <div className="field"><label htmlFor="customer-name">الاسم</label><input id="customer-name" value={name} onChange={(event) => setName(event.target.value)} required /></div>
            <div className="field"><label htmlFor="customer-phone">رقم الجوال</label><input className="ltr" id="customer-phone" value={phone} onChange={(event) => setPhone(event.target.value)} placeholder="+967..." /></div>
            <button className="button" disabled={saving || !name.trim()}>{saving ? 'جارٍ الحفظ…' : 'إنشاء العميل'}</button>
          </form>
        </aside>
      </div>
    </main>
  );
}
