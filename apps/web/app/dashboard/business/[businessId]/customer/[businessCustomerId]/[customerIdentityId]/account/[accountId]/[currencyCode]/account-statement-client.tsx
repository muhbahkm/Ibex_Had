'use client';

import { useEffect, useMemo, useState } from 'react';

import { ibex } from '../../../../../../../../../../lib/ibex';
import { formatMinorUnits, majorUnitsToMinor } from '../../../../../../../../../../lib/money';

function messageOf(error: unknown): string {
  return error instanceof Error && error.message ? error.message : 'تعذر تنفيذ العملية.';
}

function movementLabel(type: string): string {
  if (type === 'sale_on_account') return 'بيع آجل';
  if (type === 'receipt') return 'قبض';
  if (type === 'reversal') return 'عكس حركة';
  if (type === 'opening_balance') return 'رصيد افتتاحي';
  if (type === 'return') return 'مرتجع';
  if (type === 'discount') return 'خصم';
  if (type === 'adjustment') return 'تسوية';
  if (type === 'disbursement') return 'صرف';
  return type;
}

function formatOccurredAt(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat('en-GB', {
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false,
  }).format(date);
}

type MovementMode = 'sale' | 'receipt';

export function AccountStatementClient({
  businessId,
  businessCustomerId,
  customerIdentityId,
  accountId,
  currencyCode,
}: {
  readonly businessId: string;
  readonly businessCustomerId: string;
  readonly customerIdentityId: string;
  readonly accountId: string;
  readonly currencyCode: string;
}) {
  const [statement, setStatement] = useState<Awaited<ReturnType<typeof ibex.getStatement>>>([]);
  const [accounts, setAccounts] = useState<Awaited<ReturnType<typeof ibex.listCustomerAccounts>>>([]);
  const [customerName, setCustomerName] = useState('العميل');
  const [mode, setMode] = useState<MovementMode>('sale');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [reversingId, setReversingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  async function load() {
    setError(null);
    const [statementRows, accountRows, customerRows] = await Promise.all([
      ibex.getStatement({ accountId, limit: 100 }),
      ibex.listCustomerAccounts({ businessCustomerId }),
      ibex.listBusinessCustomers({ businessId, limit: 200 }),
    ]);
    setStatement(statementRows);
    setAccounts(accountRows);
    setCustomerName(customerRows.find((row) => row.businessCustomerId === businessCustomerId)?.displayName ?? 'العميل');
  }

  useEffect(() => {
    let active = true;
    void load()
      .catch((cause: unknown) => { if (active) setError(messageOf(cause)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [accountId, businessCustomerId, businessId]);

  const currentAccount = useMemo(() => accounts.find((account) => account.accountId === accountId), [accounts, accountId]);
  const currentBalance = currentAccount?.balanceMinor ?? statement[0]?.balanceAfterMinor ?? 0n;

  async function postMovement(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      const amountMinor = majorUnitsToMinor(amount, currencyCode);
      const command = {
        businessId,
        customerIdentityId,
        accountId,
        amountMinor,
        currencyCode,
        idempotencyKey: crypto.randomUUID(),
        ...(description.trim() ? { description: description.trim() } : {}),
      };
      if (mode === 'sale') await ibex.postSale(command);
      else await ibex.postReceipt(command);
      setAmount('');
      setDescription('');
      setSuccess(mode === 'sale' ? 'تم اعتماد البيع وتحديث الرصيد.' : 'تم اعتماد القبض وتحديث الرصيد.');
      await load();
    } catch (cause: unknown) {
      setError(messageOf(cause));
    } finally {
      setSaving(false);
    }
  }

  async function reverse(transactionId: string) {
    setReversingId(transactionId);
    setError(null);
    setSuccess(null);
    try {
      await ibex.reverseTransaction({
        transactionId,
        idempotencyKey: crypto.randomUUID(),
        reason: 'تصحيح من Merchant Web',
      });
      setSuccess('تم إنشاء حركة عكس مستقلة دون تعديل السجل الأصلي.');
      await load();
    } catch (cause: unknown) {
      setError(messageOf(cause));
    } finally {
      setReversingId(null);
    }
  }

  return (
    <main className="shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">IH</span><span>{customerName}</span></div>
        <div className="actions">
          <a className="button ghost" href={`/dashboard/business/${businessId}/customer/${businessCustomerId}/${customerIdentityId}`}>الحسابات</a>
          <a className="button ghost" href={`/dashboard/business/${businessId}`}>العملاء</a>
        </div>
      </header>

      <section className="account-hero card">
        <div>
          <span className="badge">{currencyCode}</span>
          <h1>كشف الحساب</h1>
          <p>السجل المالي المعتمد لهذا الحساب. التصحيح يتم بعكس الحركة ولا يعدّل التاريخ.</p>
        </div>
        <div className="balance-block">
          <span>الرصيد الحالي</span>
          <strong className="amount">{formatMinorUnits(currentBalance, currencyCode)}</strong>
        </div>
      </section>

      {error ? <div className="error page-message">{error}</div> : null}
      {success ? <div className="success page-message">{success}</div> : null}

      <div className="grid">
        <section className="card span-8">
          <div className="section-head">
            <div><h2 className="section-title">الحركات</h2><p className="section-subtitle">أحدث 100 حركة مرتبة من الأحدث.</p></div>
          </div>
          <div className="list">
            {loading ? <div className="row-card muted">جارٍ تحميل الكشف…</div> : null}
            {!loading && statement.map((entry) => (
              <div className="row-card statement-row" key={entry.transactionId}>
                <div className="row-main">
                  <div className="row-title-line"><p className="row-title">{movementLabel(entry.transactionType)}</p><span className="badge">{entry.transactionStatus}</span></div>
                  <p className="row-meta">{formatOccurredAt(entry.occurredAt)}{entry.description ? ` · ${entry.description}` : ''}</p>
                  <p className="row-meta">الرصيد بعد الحركة: <span className="amount inline-amount">{formatMinorUnits(entry.balanceAfterMinor, entry.currencyCode)}</span></p>
                </div>
                <div className="statement-actions">
                  <div className={`amount ${entry.effectMinor < 0n ? 'amount-credit' : 'amount-debit'}`}>{formatMinorUnits(entry.effectMinor, entry.currencyCode)}</div>
                  <a className="button ghost compact-button" href={`/dashboard/documents/${entry.transactionId}`}>المستندات</a>
                  {entry.canReverse ? <button className="button ghost compact-button" disabled={reversingId === entry.transactionId} onClick={() => void reverse(entry.transactionId)}>{reversingId === entry.transactionId ? 'جارٍ العكس…' : 'عكس الحركة'}</button> : null}
                </div>
              </div>
            ))}
            {!loading && statement.length === 0 ? <div className="row-card muted">لا توجد حركات في هذا الحساب بعد.</div> : null}
          </div>
        </section>

        <aside className="card span-4 sticky-card">
          <h2 className="section-title">حركة جديدة</h2>
          <p className="section-subtitle">البيع يزيد ما على العميل، والقبض يخفضه.</p>
          <div className="segmented form-space" role="group" aria-label="نوع الحركة">
            <button type="button" className={mode === 'sale' ? 'segment active' : 'segment'} onClick={() => setMode('sale')}>بيع آجل</button>
            <button type="button" className={mode === 'receipt' ? 'segment active' : 'segment'} onClick={() => setMode('receipt')}>قبض</button>
          </div>
          <form className="stack form-space" onSubmit={(event) => void postMovement(event)}>
            <div className="field"><label htmlFor="amount">المبلغ — {currencyCode}</label><input className="ltr" id="amount" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder={currencyCode === 'YER' ? '50000' : '500.00'} required /></div>
            <div className="field"><label htmlFor="description">البيان</label><input id="description" value={description} onChange={(event) => setDescription(event.target.value)} placeholder="اختياري" /></div>
            <button className="button" disabled={saving || !amount.trim()}>{saving ? 'جارٍ الاعتماد…' : mode === 'sale' ? 'اعتماد البيع' : 'اعتماد القبض'}</button>
          </form>
        </aside>
      </div>
    </main>
  );
}
