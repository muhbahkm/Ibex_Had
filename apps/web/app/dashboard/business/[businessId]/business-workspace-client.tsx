'use client';

import type { BusinessCollectionOverview } from '../../../../../../packages/application/src/collection-read-model';
import type { BusinessCustomerSummaryRecord, BusinessSummaryRecord } from '../../../../../../packages/application/src/ports';
import { useEffect, useMemo, useState } from 'react';

import { ibex } from '../../../../lib/ibex';
import { formatMinorUnits } from '../../../../lib/money';

function messageOf(error: unknown): string {
  return error instanceof Error && error.message ? error.message : 'تعذر تنفيذ العملية.';
}

export function BusinessWorkspaceClient({ businessId }: { readonly businessId: string }) {
  const [business, setBusiness] = useState<BusinessSummaryRecord | null>(null);
  const [customers, setCustomers] = useState<readonly BusinessCustomerSummaryRecord[]>([]);
  const [collection, setCollection] = useState<BusinessCollectionOverview | null>(null);
  const [search, setSearch] = useState('');
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load(query?: string) {
    setError(null);
    const [businessRows, customerRows, collectionOverview] = await Promise.all([
      ibex.listBusinesses(),
      ibex.listBusinessCustomers({ businessId, limit: 200, ...(query?.trim() ? { search: query.trim() } : {}) }),
      ibex.getBusinessCollectionOverview({ businessId, limit: 200, staleAfterDays: 30 }),
    ]);
    setBusiness(businessRows.find((row) => row.businessId === businessId) ?? null);
    setCustomers(customerRows);
    setCollection(collectionOverview);
  }

  useEffect(() => {
    let active = true;
    void load()
      .catch((cause: unknown) => { if (active) setError(messageOf(cause)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [businessId]);

  const title = useMemo(() => business?.name ?? 'مساحة النشاط', [business]);
  const attentionCustomers = useMemo(() => collection?.customers.filter((customer) => customer.followUpState === 'stale_debt').slice(0, 5) ?? [], [collection]);

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
        <p>ابحث عن العميل أو أنشئ علاقة جديدة، وتابع الذمم من Read Model خلفي واحد يحافظ على فصل العملات.</p>
      </section>

      {error ? <div className="error page-message">{error}</div> : null}

      {collection ? (
        <div className="grid">
          <section className="card span-4">
            <p className="section-subtitle">عملاء لديهم ذمة</p>
            <h2 className="section-title">{String(collection.debtorCustomerCount)}</h2>
            <p className="row-meta">من أصل {String(collection.customerCount)} عميل</p>
          </section>
          <section className="card span-4">
            <p className="section-subtitle">تحتاج متابعة</p>
            <h2 className="section-title">{String(collection.staleDebtorCustomerCount)}</h2>
            <p className="row-meta">رصيد موجب بلا حركة خلال {String(collection.staleAfterDays)} يومًا</p>
          </section>
          <section className="card span-4">
            <p className="section-subtitle">العملات النشطة</p>
            <h2 className="section-title">{String(collection.currencies.length)}</h2>
            <p className="row-meta">لا يتم جمع العملات المختلفة في رقم واحد</p>
          </section>

          <section className="card span-8">
            <div className="section-head"><div><h2 className="section-title">ملخص الذمم حسب العملة</h2><p className="section-subtitle">أرقام مستقلة لكل عملة</p></div></div>
            <div className="list">
              {collection.currencies.map((currency) => (
                <div className="row-card" key={currency.currencyCode}>
                  <div className="row-main">
                    <p className="row-title">{currency.currencyCode}</p>
                    <p className="row-meta">{String(currency.debtorAccountCount)} حساب مدين · {String(currency.creditAccountCount)} حساب دائن</p>
                  </div>
                  <div>
                    <p className="row-title ltr">{formatMinorUnits(currency.receivableMinor, currency.currencyCode)}</p>
                    {currency.payableMinor > 0n ? <p className="row-meta ltr">للعملاء: {formatMinorUnits(currency.payableMinor, currency.currencyCode)}</p> : null}
                  </div>
                </div>
              ))}
              {collection.currencies.length === 0 ? <div className="row-card muted">لا توجد أرصدة نشطة بعد.</div> : null}
            </div>
          </section>

          <aside className="card span-4">
            <h2 className="section-title">أولوية المتابعة</h2>
            <p className="section-subtitle">هذه إشارة تشغيلية وليست حكمًا بأن الدين متأخر تعاقديًا.</p>
            <div className="list form-space">
              {attentionCustomers.map((customer) => (
                <a className="row-card interactive-row" key={customer.businessCustomerId} href={`/dashboard/business/${businessId}/customer/${customer.businessCustomerId}/${customer.customerIdentityId}`}>
                  <div className="row-main">
                    <p className="row-title">{customer.displayName}</p>
                    <p className="row-meta">{customer.lastMovementAt ? new Date(customer.lastMovementAt).toLocaleDateString('en-GB') : 'لا توجد حركة مسجلة'}</p>
                  </div>
                  <span className="badge">متابعة</span>
                </a>
              ))}
              {attentionCustomers.length === 0 ? <div className="row-card muted">لا توجد متابعة راكدة حاليًا.</div> : null}
            </div>
          </aside>
        </div>
      ) : null}

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
