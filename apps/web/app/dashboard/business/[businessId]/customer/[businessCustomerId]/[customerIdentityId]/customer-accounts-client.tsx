'use client';

import { formatMinorUnits } from '../../../../../../../../../packages/core/src/money-presentation';
import { useEffect, useMemo, useState } from 'react';

import { ibex } from '../../../../../../../lib/ibex';

function messageOf(error: unknown): string {
  return error instanceof Error && error.message ? error.message : 'تعذر تنفيذ العملية.';
}

const SUPPORTED_CURRENCIES = ['YER', 'SAR', 'USD'] as const;

export function CustomerAccountsClient({
  businessId,
  businessCustomerId,
  customerIdentityId,
}: {
  readonly businessId: string;
  readonly businessCustomerId: string;
  readonly customerIdentityId: string;
}) {
  const [accounts, setAccounts] = useState<Awaited<ReturnType<typeof ibex.listCustomerAccounts>>>([]);
  const [customerName, setCustomerName] = useState('العميل');
  const [businessName, setBusinessName] = useState('النشاط');
  const [currencyCode, setCurrencyCode] = useState<(typeof SUPPORTED_CURRENCIES)[number]>('YER');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    const [accountRows, customerRows, businessRows] = await Promise.all([
      ibex.listCustomerAccounts({ businessCustomerId }),
      ibex.listBusinessCustomers({ businessId, limit: 200 }),
      ibex.listBusinesses(),
    ]);
    setAccounts(accountRows);
    setCustomerName(customerRows.find((row) => row.businessCustomerId === businessCustomerId)?.displayName ?? 'العميل');
    setBusinessName(businessRows.find((row) => row.businessId === businessId)?.name ?? 'النشاط');
  }

  useEffect(() => {
    let active = true;
    void load()
      .catch((cause: unknown) => { if (active) setError(messageOf(cause)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [businessCustomerId, businessId]);

  const existingCurrencies = useMemo(() => new Set(accounts.map((account) => account.currencyCode)), [accounts]);

  async function openAccount(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    try {
      await ibex.openCustomerAccount({ businessCustomerId, currencyCode }, crypto.randomUUID());
      await load();
    } catch (cause: unknown) {
      setError(messageOf(cause));
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">IH</span><span>{businessName}</span></div>
        <div className="actions"><a className="button ghost" href={`/dashboard/business/${businessId}`}>العملاء</a><a className="button ghost" href="/dashboard">الرئيسية</a></div>
      </header>

      <section className="hero compact-hero">
        <h1>{customerName}</h1>
        <p>كل عملة لها حساب مستقل ورصيد مشتق من الـLedger. افتح الحساب ثم ادخل إلى كشفه لتسجيل البيع أو القبض.</p>
      </section>

      {error ? <div className="error page-message">{error}</div> : null}

      <div className="grid">
        <section className="card span-8">
          <h2 className="section-title">حسابات العميل</h2>
          <p className="section-subtitle">الرصيد الموجب يعني أن على العميل مبلغًا للنشاط.</p>
          <div className="list">
            {loading ? <div className="row-card muted">جارٍ التحميل…</div> : null}
            {!loading && accounts.map((account) => (
              <a
                className="row-card interactive-row"
                key={account.accountId}
                href={`/dashboard/business/${businessId}/customer/${businessCustomerId}/${customerIdentityId}/account/${account.accountId}/${account.currencyCode}`}
              >
                <div className="row-main">
                  <p className="row-title">حساب {account.currencyCode}</p>
                  <p className="row-meta">الحالة: {account.status}</p>
                </div>
                <div className="amount">{formatMinorUnits(account.balanceMinor, account.currencyCode)}</div>
              </a>
            ))}
            {!loading && accounts.length === 0 ? <div className="row-card muted">لا توجد حسابات لهذا العميل بعد.</div> : null}
          </div>
        </section>

        <aside className="card span-4">
          <h2 className="section-title">فتح حساب عملة</h2>
          <p className="section-subtitle">لا يُنشأ حساب مكرر لنفس العلاقة والعملة.</p>
          <form className="stack form-space" onSubmit={(event) => void openAccount(event)}>
            <div className="field">
              <label htmlFor="currency">العملة</label>
              <select id="currency" value={currencyCode} onChange={(event) => setCurrencyCode(event.target.value as (typeof SUPPORTED_CURRENCIES)[number])}>
                {SUPPORTED_CURRENCIES.map((code) => <option key={code} value={code} disabled={existingCurrencies.has(code)}>{code}</option>)}
              </select>
            </div>
            <button className="button" disabled={saving || existingCurrencies.has(currencyCode)}>{saving ? 'جارٍ الفتح…' : 'فتح الحساب'}</button>
          </form>
        </aside>
      </div>
    </main>
  );
}
