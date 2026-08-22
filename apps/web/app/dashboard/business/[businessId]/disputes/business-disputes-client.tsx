'use client';

import { useEffect, useState } from 'react';

import { ibex } from '../../../../../lib/ibex';

function messageOf(error: unknown): string {
  return error instanceof Error && error.message ? error.message : 'تعذر تنفيذ عملية المراجعة.';
}

function statusLabel(status: string): string {
  if (status === 'open') return 'جديد';
  if (status === 'under_review') return 'قيد المراجعة';
  if (status === 'resolved') return 'تمت المعالجة';
  if (status === 'rejected') return 'مرفوض';
  return status;
}

function DisputeCard({
  dispute,
  busyId,
  onUpdate,
}: {
  readonly dispute: Awaited<ReturnType<typeof ibex.listBusinessDisputes>>[number];
  readonly busyId: string | null;
  readonly onUpdate: (disputeId: string, status: 'under_review' | 'resolved' | 'rejected', note?: string) => Promise<void>;
}) {
  const [note, setNote] = useState('');
  const terminal = dispute.status === 'resolved' || dispute.status === 'rejected';
  const busy = busyId === dispute.disputeId;

  return (
    <article className="row-card statement-row">
      <div className="row-main">
        <div className="row-title-line"><p className="row-title">{dispute.customerName}</p><span className="badge">{statusLabel(dispute.status)}</span></div>
        <p className="row-meta">{dispute.reason}</p>
        <p className="row-meta ltr-meta">{new Date(dispute.createdAt).toLocaleString('en-GB', { hour12: false })}</p>
        {dispute.resolutionNote ? <p className="row-meta">النتيجة: {dispute.resolutionNote}</p> : null}
      </div>
      {!terminal ? (
        <div className="dispute-controls">
          <input value={note} onChange={(event) => setNote(event.target.value)} placeholder="ملاحظة المعالجة" aria-label="ملاحظة المعالجة" />
          <div className="actions">
            {dispute.status === 'open' ? <button className="button secondary compact-button" disabled={busy} onClick={() => void onUpdate(dispute.disputeId, 'under_review')}>بدء المراجعة</button> : null}
            <button className="button compact-button" disabled={busy || note.trim().length < 3} onClick={() => void onUpdate(dispute.disputeId, 'resolved', note)}>معالجة</button>
            <button className="button ghost compact-button" disabled={busy || note.trim().length < 3} onClick={() => void onUpdate(dispute.disputeId, 'rejected', note)}>رفض</button>
          </div>
        </div>
      ) : null}
    </article>
  );
}

export function BusinessDisputesClient({ businessId }: { readonly businessId: string }) {
  const [disputes, setDisputes] = useState<Awaited<ReturnType<typeof ibex.listBusinessDisputes>>>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    setDisputes(await ibex.listBusinessDisputes({ businessId, limit: 200 }));
  }

  useEffect(() => {
    let active = true;
    void load().catch((cause: unknown) => { if (active) setError(messageOf(cause)); }).finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [businessId]);

  async function update(disputeId: string, status: 'under_review' | 'resolved' | 'rejected', note?: string) {
    setBusyId(disputeId);
    setError(null);
    try {
      await ibex.updateDispute({ disputeId, status, ...(note?.trim() ? { resolutionNote: note.trim() } : {}) }, crypto.randomUUID());
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
        <div className="brand"><span className="brand-mark">IH</span><span>طلبات المراجعة</span></div>
        <div className="actions"><a className="button ghost" href={`/dashboard/business/${businessId}`}>النشاط</a><a className="button ghost" href="/dashboard">الرئيسية</a></div>
      </header>
      <section className="hero compact-hero"><h1>الاعتراضات والمراجعات</h1><p>تغيير حالة طلب المراجعة لا يغيّر الحركة المالية ولا الرصيد. أي تصحيح مالي يتم بعكس مستقل.</p></section>
      {error ? <div className="error page-message">{error}</div> : null}
      <section className="card">
        <div className="section-head"><div><h2 className="section-title">صندوق النشاط</h2><p className="section-subtitle">الأحدث أولًا.</p></div><span className="badge">{disputes.length}</span></div>
        <div className="list">
          {loading ? <div className="row-card muted">جارٍ التحميل…</div> : null}
          {!loading && disputes.map((dispute) => <DisputeCard key={dispute.disputeId} dispute={dispute} busyId={busyId} onUpdate={update} />)}
          {!loading && disputes.length === 0 ? <div className="row-card muted">لا توجد طلبات مراجعة لهذا النشاط.</div> : null}
        </div>
      </section>
    </main>
  );
}
