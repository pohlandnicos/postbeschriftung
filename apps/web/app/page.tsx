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
    <main style={{ maxWidth: 980, margin: '0 auto', padding: '28px 18px 80px' }}>
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
                  border: '1px solid rgba(231, 238, 252, 0.18)',
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
                  border: '1px solid rgba(231, 238, 252, 0.18)',
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
                  border: '1px solid rgba(231, 238, 252, 0.18)',
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
                      border: '1px solid rgba(231, 238, 252, 0.18)',
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
                      border: '1px solid rgba(231, 238, 252, 0.18)',
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
                  gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
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
              if (t.includes('rechnung')) return { bg: 'rgba(37, 99, 235, 0.18)', bd: 'rgba(37, 99, 235, 0.35)' };
              if (t.includes('angebot')) return { bg: 'rgba(34, 197, 94, 0.14)', bd: 'rgba(34, 197, 94, 0.35)' };
              if (t.includes('lieferschein')) return { bg: 'rgba(245, 158, 11, 0.14)', bd: 'rgba(245, 158, 11, 0.35)' };
              return { bg: 'rgba(231, 238, 252, 0.06)', bd: 'rgba(231, 238, 252, 0.18)' };
            })();

            const card = (
              <div
                style={{
                  border: '1px solid rgba(231, 238, 252, 0.12)',
                  borderRadius: 14,
                  padding: 12,
                  background: 'rgba(255,255,255,0.02)'
                }}
              >
                <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                  <div
                    style={{
                      width: view === 'grid' ? 64 : 48,
                      height: view === 'grid' ? 84 : 64,
                      borderRadius: 10,
                      overflow: 'hidden',
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid rgba(231, 238, 252, 0.12)',
                      flex: '0 0 auto'
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
                      {it.status}
                      {it.error ? ` — ${it.error}` : ''}
                    </div>

                    <div style={{ marginTop: 10, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                      <button
                        type="button"
                        onClick={() => setPreviewId(it.id)}
                        style={{
                          padding: view === 'grid' ? '6px 8px' : '8px 10px',
                          borderRadius: 12,
                          border: '1px solid rgba(231, 238, 252, 0.18)',
                          background: 'transparent',
                          color: 'inherit',
                          cursor: 'pointer'
                        }}
                      >
                        Vorschau
                      </button>

                      {downloadHref ? (
                        <a
                          href={downloadHref}
                          style={{
                            textDecoration: 'none',
                            padding: view === 'grid' ? '6px 8px' : '8px 10px',
                            borderRadius: 12,
                            background: '#2563eb',
                            color: 'white',
                            fontWeight: 700
                          }}
                        >
                          Download
                        </a>
                      ) : null}

                      <button
                        type="button"
                        onClick={() =>
                          setItems((prev) =>
                            prev.map((p) => (p.id === it.id ? { ...p, expanded: !p.expanded } : p))
                          )
                        }
                        style={{
                          padding: view === 'grid' ? '6px 8px' : '8px 10px',
                          borderRadius: 12,
                          border: '1px solid rgba(231, 238, 252, 0.18)',
                          background: 'transparent',
                          color: 'inherit',
                          cursor: 'pointer'
                        }}
                      >
                        Details
                      </button>

                      <button
                        type="button"
                        onClick={() => removeItem(it.id)}
                        style={{
                          padding: view === 'grid' ? '6px 8px' : '8px 10px',
                          borderRadius: 12,
                          border: '1px solid rgba(255, 120, 120, 0.35)',
                          background: 'rgba(255, 120, 120, 0.08)',
                          color: 'inherit',
                          cursor: 'pointer'
                        }}
                      >
                        Entfernen
                      </button>
                    </div>
                  </div>
                </div>

                {it.expanded && it.result ? (
                  <div style={{ marginTop: 12 }}>
                    <ResultCard result={it.result} />
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

      {previewItem ? (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => setPreviewId(null)}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.65)',
            display: 'grid',
            placeItems: 'center',
            padding: 18,
            zIndex: 50
          }}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: 'min(1000px, 96vw)',
              height: 'min(820px, 86vh)',
              background: '#0b1220',
              border: '1px solid rgba(231, 238, 252, 0.12)',
              borderRadius: 16,
              overflow: 'hidden',
              display: 'grid',
              gridTemplateRows: 'auto 1fr'
            }}
          >
            <div
              style={{
                padding: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: 12,
                borderBottom: '1px solid rgba(231, 238, 252, 0.12)'
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
                style={{
                  padding: '8px 10px',
                  borderRadius: 12,
                  border: '1px solid rgba(231, 238, 252, 0.18)',
                  background: 'transparent',
                  color: 'inherit',
                  cursor: 'pointer'
                }}
              >
                Schließen
              </button>
            </div>

            <iframe
              title="PDF Preview"
              src={previewItem.pdfUrl}
              style={{ width: '100%', height: '100%', border: 0, background: 'white' }}
            />
          </div>
        </div>
      ) : null}
    </main>
  );
}
