'use client';

import { useEffect, useRef, useState } from 'react';

import { createTransactionDocumentUrl, uploadTransactionDocument } from '../../../../lib/documents';
import { ibex } from '../../../../lib/ibex';

function messageOf(error: unknown): string {
  return error instanceof Error && error.message ? error.message : 'تعذر تنفيذ عملية المستند.';
}

function formatFileSize(sizeBytes: number): string {
  if (sizeBytes < 1024) return `${sizeBytes} B`;
  if (sizeBytes < 1024 * 1024) return `${(sizeBytes / 1024).toFixed(1)} KB`;
  return `${(sizeBytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function TransactionDocumentsClient({ transactionId }: { readonly transactionId: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [documents, setDocuments] = useState<Awaited<ReturnType<typeof ibex.listTransactionDocuments>>>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [openingId, setOpeningId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    setDocuments(await ibex.listTransactionDocuments({ transactionId }));
  }

  useEffect(() => {
    let active = true;
    void load()
      .catch((cause: unknown) => { if (active) setError(messageOf(cause)); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; };
  }, [transactionId]);

  async function chooseFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      await uploadTransactionDocument(transactionId, file);
      await load();
    } catch (cause: unknown) {
      setError(messageOf(cause));
    } finally {
      setUploading(false);
    }
  }

  async function openDocument(document: (typeof documents)[number]) {
    setOpeningId(document.documentId);
    setError(null);
    try {
      const signedUrl = await createTransactionDocumentUrl(document);
      window.open(signedUrl, '_blank', 'noopener,noreferrer');
    } catch (cause: unknown) {
      setError(messageOf(cause));
    } finally {
      setOpeningId(null);
    }
  }

  return (
    <main className="shell narrow-shell">
      <header className="topbar">
        <div className="brand"><span className="brand-mark">IH</span><span>مستندات الحركة</span></div>
        <a className="button ghost" href="/dashboard">الرئيسية</a>
      </header>

      <section className="hero compact-hero">
        <h1>المستندات</h1>
        <p>ملفات خاصة مرتبطة بالحركة فقط. مسار التخزين يحدده الخادم، والفتح يتم عبر رابط مؤقت.</p>
      </section>

      {error ? <div className="error page-message">{error}</div> : null}

      <section className="card">
        <div className="section-head">
          <div><h2 className="section-title">الملفات المرتبطة</h2><p className="section-subtitle">PDF أو JPG أو PNG أو WEBP، بحد أقصى 10 MB.</p></div>
          <div>
            <input ref={inputRef} className="sr-only" type="file" accept="application/pdf,image/jpeg,image/png,image/webp" onChange={(event) => void chooseFile(event)} />
            <button className="button compact-button" disabled={uploading} onClick={() => inputRef.current?.click()}>{uploading ? 'جارٍ الرفع…' : 'إرفاق مستند'}</button>
          </div>
        </div>

        <div className="list">
          {loading ? <div className="row-card muted">جارٍ تحميل المستندات…</div> : null}
          {!loading && documents.map((document) => (
            <div className="row-card" key={document.documentId}>
              <div className="row-main">
                <p className="row-title">{document.fileName}</p>
                <p className="row-meta ltr-meta">{document.mimeType} · {formatFileSize(document.sizeBytes)} · {new Date(document.createdAt).toLocaleDateString('en-GB')}</p>
              </div>
              <button className="button ghost compact-button" disabled={openingId !== null} onClick={() => void openDocument(document)}>{openingId === document.documentId ? 'جارٍ الفتح…' : 'فتح'}</button>
            </div>
          ))}
          {!loading && documents.length === 0 ? <div className="row-card muted">لا توجد مستندات مرتبطة بهذه الحركة.</div> : null}
        </div>
      </section>
    </main>
  );
}
