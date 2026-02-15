'use client';

import { useCallback, useMemo, useState } from 'react';
import { Dropzone } from '@/components/Dropzone';
import { ResultCard } from '@/components/ResultCard';
import { ThemeToggle } from '@/components/ThemeToggle';
import { processPdf } from '@/lib/apiClient';
import { renderFirstPagePng } from '@/lib/pdfRender';
import type { ProcessResult } from '@/lib/types';
import JSZip from 'jszip';

type QueueItem = {
  id: string;
  file: File;
  pdfUrl: string;
  thumbUrl: string | null;
  pages: number | null;
  status: 'queued' | 'processing' | 'done' | 'error';
  result: ProcessResult | null;
  error: string | null;
  expanded: boolean;
};

export default function Page() {
  const [items, setItems] = useState<QueueItem[]>([]);
  const [view, setView] = useState<'grid' | 'list'>('grid');
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [concurrency, setConcurrency] = useState(2);

  const doneItems = useMemo(() => items.filter((i) => i.status === 'done' && i.result), [items]);

  const previewItem = previewId ? items.find((i) => i.id === previewId) ?? null : null;

  const removeItem = useCallback((id: string) => {
    setItems((prev) => {
      const it = prev.find((p) => p.id === id);
      if (it?.pdfUrl) URL.revokeObjectURL(it.pdfUrl);
      if (it?.thumbUrl) URL.revokeObjectURL(it.thumbUrl);
      return prev.filter((p) => p.id !== id);
    });
    setPreviewId((p) => (p === id ? null : p));
  }, []);

  const downloadAllIndividually = useCallback(() => {
    for (const it of doneItems) {
      const id = it.result?.file_id;
      if (!id) continue;
      const a = document.createElement('a');
      a.href = `/api/download/${encodeURIComponent(id)}`;
      a.rel = 'noopener';
      a.click();
    }
  }, [doneItems]);

  const downloadAllAsZip = useCallback(async () => {
    if (!doneItems.length) return;
    const zip = new JSZip();

    for (const it of doneItems) {
      const id = it.result?.file_id;
      if (!id) continue;
      const res = await fetch(`/api/download/${encodeURIComponent(id)}`);
      if (!res.ok) continue;
      const blob = await res.blob();
      const name = it.result?.suggested_filename || `${id}.pdf`;
      zip.file(name, blob);
    }

    const out = await zip.generateAsync({ type: 'blob' });
    const url = URL.createObjectURL(out);
    try {
      const a = document.createElement('a');
      a.href = url;
      a.download = `postbeschriftung_${new Date().toISOString().slice(0, 10)}.zip`;
      a.click();
    } finally {
      URL.revokeObjectURL(url);
    }
  }, [doneItems]);

  const clearAll = useCallback(() => {
    setItems((prev) => {
      for (const it of prev) {
        if (it.pdfUrl) URL.revokeObjectURL(it.pdfUrl);
        if (it.thumbUrl) URL.revokeObjectURL(it.thumbUrl);
      }
      return [];
    });
    setPreviewId(null);
  }, []);

  const processOne = useCallback(async (itemId: string, file: File) => {
    setItems((prev) =>
      prev.map((it) => (it.id === itemId ? { ...it, status: 'processing', error: null } : it))
    );
    try {
      const page1 = await renderFirstPagePng(file);
      const thumbUrl = page1.blob ? URL.createObjectURL(page1.blob) : null;
      setItems((prev) =>
        prev.map((it) => (it.id === itemId ? { ...it, thumbUrl, pages: page1.pages } : it))
      );
      const r = await processPdf(file, page1.blob, page1.error, page1.ms);
      setItems((prev) =>
        prev.map((it) => (it.id === itemId ? { ...it, status: 'done', result: r } : it))
      );
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Unbekannter Fehler';
      setItems((prev) =>
        prev.map((it) => (it.id === itemId ? { ...it, status: 'error', error: msg } : it))
      );
    }
  }, []);

  const onFiles = useCallback(
    async (files: File[]) => {
      const newItems: QueueItem[] = files.map((f) => ({
        id: crypto.randomUUID(),
        file: f,
        pdfUrl: URL.createObjectURL(f),
        thumbUrl: null,
        pages: null,
        status: 'queued',
        result: null,
        error: null,
        expanded: false
      }));
      setItems((prev) => [...newItems, ...prev]);

      const limit = Math.max(1, Math.min(5, concurrency));
      let idx = 0;

      const runNext = async (): Promise<void> => {
        const current = newItems[idx++];
        if (!current) return;
        await processOne(current.id, current.file);
        await runNext();
      };

      const starters: Promise<void>[] = [];
      for (let i = 0; i < Math.min(limit, newItems.length); i++) starters.push(runNext());
      await Promise.all(starters);
    },
    [processOne, concurrency]
  );

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <main style={{ maxWidth: 980, margin: '0 auto', padding: '28px 18px 80px', height: '100%', overflow: 'auto', flex: '0 0 980px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ fontSize: 22, fontWeight: 800 }}>Postbeschriftung</div>
          <ThemeToggle />
        </div>
        <div style={{ fontSize: 13, opacity: 0.75 }}>
          Upload PDF, automatische Erkennung (Dokumenttyp/Lieferant/Betrag/Gebäude), Vorschlag Dateiname, Download.
        </div>
      </div>

      <div style={{ display: 'grid', gap: 18 }}>
        <Dropzone onFiles={onFiles} />

        {items.length ? (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <div style={{ fontSize: 13, opacity: 0.85 }}>
              {items.length} Dateien
            </div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <div style={{ fontSize: 12, opacity: 0.75 }}>Parallel</div>
                <select
                  value={concurrency}
                  onChange={(e) => setConcurrency(Number(e.target.value) || 1)}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 10,
                    border: '1px solid rgba(231, 238, 252, 0.18)',
                    background: 'transparent',
                    color: 'inherit'
                  }}
                >
                  <option value={1}>1</option>
                  <option value={2}>2</option>
                  <option value={3}>3</option>
                </select>
              </div>

              <button
                type="button"
                onClick={() => setView('grid')}
                style={{
                  padding: '8px 10px',
                  borderRadius: 10,
                  border: '1px solid var(--border)',
                  background: view === 'grid' ? 'rgba(37, 99, 235, 0.25)' : 'transparent',
                  color: 'inherit',
                  cursor: 'pointer'
                }}
              >
                Raster
              </button>
              <button
                type="button"
                onClick={() => setView('list')}
                style={{
                  padding: '8px 10px',
                  borderRadius: 10,
                  border: '1px solid var(--border)',
                  background: view === 'list' ? 'rgba(37, 99, 235, 0.25)' : 'transparent',
                  color: 'inherit',
                  cursor: 'pointer'
                }}
              >
                Liste
              </button>
              <button
                type="button"
                onClick={clearAll}
                style={{
                  padding: '8px 10px',
                  borderRadius: 10,
                  border: '1px solid var(--border)',
                  background: 'transparent',
                  color: 'inherit',
                  cursor: 'pointer'
                }}
              >
                Alle entfernen
              </button>

              {doneItems.length ? (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <button
                    type="button"
                    onClick={downloadAllIndividually}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 10,
                      border: '1px solid var(--border)',
                      background: 'transparent',
                      color: 'inherit',
                      cursor: 'pointer'
                    }}
                  >
                    Alle einzeln
                  </button>
                  <button
                    type="button"
                    onClick={downloadAllAsZip}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 10,
                      border: '1px solid var(--border)',
                      background: 'transparent',
                      color: 'inherit',
                      cursor: 'pointer'
                    }}
                  >
                    Alle als ZIP
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        ) : null}

        <div
          style={
            view === 'grid'
              ? {
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fill, minmax(420px, 1fr))',
                  gap: 12
                }
              : { display: 'grid', gap: 8 }
          }
        >
          {items.map((it) => {
            const name = it.result?.suggested_filename || it.file.name;
            const downloadHref = it.result ? `/api/download/${encodeURIComponent(it.result.file_id)}` : null;
            const docType = it.result?.doc_type || '';
            const pagesLabel = typeof it.pages === 'number' ? `${it.pages} Seite${it.pages === 1 ? '' : 'n'}` : '';

            const badgeColor = (() => {
              const t = docType.toLowerCase();
              if (t.includes('rechnung')) return { bg: 'rgba(37, 99, 235, 0.18)', bd: 'var(--border)' };
              if (t.includes('angebot')) return { bg: 'rgba(34, 197, 94, 0.14)', bd: 'var(--border)' };
              if (t.includes('lieferschein')) return { bg: 'rgba(245, 158, 11, 0.14)', bd: 'var(--border)' };
              return { bg: 'var(--panel2)', bd: 'var(--border)' };
            })();

            const statusLabel =
              it.status === 'processing' || it.status === 'queued'
                ? 'Wird verarbeitet…'
                : it.status === 'error'
                  ? 'Fehler'
                  : '';

            const card = (
              <div
                style={{
                  border: '1px solid var(--border_soft)',
                  borderRadius: 14,
                  padding: 12,
                  background: 'var(--panel)',
                  minHeight: view === 'grid' ? 168 : undefined,
                  display: 'grid',
                  gridTemplateRows: '1fr auto'
                }}
              >
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <div
                    style={{
                      width: view === 'grid' ? 64 : 48,
                      height: view === 'grid' ? 84 : 64,
                      borderRadius: 10,
                      overflow: 'hidden',
                      background: 'var(--panel2)',
                      border: '1px solid var(--border_soft)',
                      flex: '0 0 auto',
                      cursor: 'pointer'
                    }}
                    role="button"
                    tabIndex={0}
                    onClick={() => setPreviewId(it.id)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') setPreviewId(it.id);
                    }}
                  >
                    {it.thumbUrl ? (
                      <img
                        src={it.thumbUrl}
                        alt="preview"
                        style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
                      />
                    ) : null}
                  </div>

                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div
                      style={{
                        fontSize: 12,
                        opacity: 0.7,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                      }}
                    >
                      {it.file.name}
                    </div>

                    <div style={{ marginTop: 6, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                      {docType ? (
                        <div
                          style={{
                            fontSize: 12,
                            padding: '3px 8px',
                            borderRadius: 999,
                            border: `1px solid ${badgeColor.bd}`,
                            background: badgeColor.bg
                          }}
                        >
                          {docType}
                        </div>
                      ) : null}
                      {pagesLabel ? <div style={{ fontSize: 12, opacity: 0.75 }}>{pagesLabel}</div> : null}
                    </div>

                    <div
                      style={{
                        marginTop: 6,
                        fontSize: 13,
                        fontWeight: 650,
                        display: '-webkit-box',
                        WebkitLineClamp: 2,
                        WebkitBoxOrient: 'vertical',
                        overflow: 'hidden'
                      }}
                    >
                      {name}
                    </div>
                    <div style={{ marginTop: 6, fontSize: 12, opacity: 0.8 }}>
                      {statusLabel}
                      {it.error ? ` — ${it.error}` : ''}
                    </div>
                  </div>
                </div>

                <div style={{ marginTop: 10, display: 'flex', gap: 8, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
                  <button
                    type="button"
                    onClick={() => setPreviewId(it.id)}
                    aria-label="Vorschau"
                    style={{
                      width: 34,
                      height: 32,
                      borderRadius: 10,
                      border: '1px solid var(--border)',
                      background: 'transparent',
                      color: 'inherit',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path
                        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
                        stroke="currentColor"
                        strokeWidth="2"
                      />
                    </svg>
                  </button>

                  {downloadHref ? (
                    <a
                      href={downloadHref}
                      aria-label="Download"
                      style={{
                        textDecoration: 'none',
                        width: 34,
                        height: 32,
                        borderRadius: 10,
                        border: '1px solid rgba(37, 99, 235, 0.35)',
                        background: 'rgba(37, 99, 235, 0.14)',
                        color: 'inherit',
                        cursor: 'pointer',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center'
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M12 3v10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        <path d="M8 11l4 4 4-4" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                        <path d="M4 21h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    </a>
                  ) : null}

                  <button
                    type="button"
                    onClick={() =>
                      setItems((prev) =>
                        prev.map((p) => (p.id === it.id ? { ...p, expanded: !p.expanded } : p))
                      )
                    }
                    aria-label="Details"
                    style={{
                      width: 34,
                      height: 32,
                      borderRadius: 10,
                      border: '1px solid var(--border)',
                      background: 'transparent',
                      color: 'inherit',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M7 7h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      <path d="M7 12h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      <path d="M7 17h10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </button>

                  <button
                    type="button"
                    onClick={() => removeItem(it.id)}
                    aria-label="Entfernen"
                    style={{
                      width: 34,
                      height: 32,
                      borderRadius: 10,
                      border: '1px solid rgba(255, 120, 120, 0.35)',
                      background: 'rgba(255, 120, 120, 0.08)',
                      color: 'inherit',
                      cursor: 'pointer',
                      display: 'inline-flex',
                      alignItems: 'center',
                      justifyContent: 'center'
                    }}
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M3 6h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      <path d="M8 6v-2h8v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      <path d="M6 6l1 16h10l1-16" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
                    </svg>
                  </button>
                </div>

                {it.expanded && it.result ? (
                  <div
                    style={{
                      marginTop: 12,
                      border: '1px solid var(--border_soft)',
                      borderRadius: 14,
                      overflow: 'hidden',
                      background: 'var(--panel2)'
                    }}
                  >
                    <div style={{ padding: 12 }}>
                      <ResultCard result={it.result} />
                    </div>
                  </div>
                ) : null}
              </div>
            );

            if (view === 'grid') return <div key={it.id}>{card}</div>;

            return (
              <div key={it.id} style={{ display: 'grid' }}>
                {card}
              </div>
            );
          })}
        </div>
      </div>

      </main>

      {previewItem ? (
        <div
          style={{
            flex: 1,
            height: '100%',
            display: 'flex',
            flexDirection: 'column',
            borderLeft: '1px solid var(--border_soft)',
            background: 'var(--bg)'
          }}
        >
          <div
            style={{
              padding: '12px 16px',
              borderBottom: '1px solid var(--border_soft)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              background: 'var(--panel)'
            }}
          >
            <div
              style={{
                fontSize: 13,
                opacity: 0.85,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              {previewItem.file.name}
            </div>
            <button
              type="button"
              onClick={() => setPreviewId(null)}
              aria-label="Vorschau schließen"
              style={{
                padding: 4,
                background: 'transparent',
                border: '1px solid rgba(231, 238, 252, 0.18)',
                borderRadius: 10,
                color: 'inherit',
                cursor: 'pointer',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            </button>
          </div>

          <iframe
            title="PDF Preview"
            src={previewItem.pdfUrl}
            style={{ flex: 1, width: '100%', border: 0, background: 'white' }}
          />
        </div>
      ) : null}
    </div>
  );
}
