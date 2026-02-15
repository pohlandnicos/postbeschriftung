'use client';

import { useCallback, useMemo, useState } from 'react';
import { Dropzone } from '@/components/Dropzone';
import { ResultCard } from '@/components/ResultCard';
import { ThemeToggle } from '@/components/ThemeToggle';
import { processPdf } from '@/lib/apiClient';
import { renderFirstPagePng } from '@/lib/pdfRender';
import type { ProcessResult } from '@/lib/types';
import JSZip from 'jszip';
import { appendHistory } from '@/lib/history';

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
      appendHistory({ result: r, originalName: file.name, pages: page1.pages });
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
      <main style={{ display: 'flex', height: '100%' }}>
        <div style={{ flex: '0 0 400px', padding: '24px', display: 'flex', flexDirection: 'column', gap: 24, borderRight: '1px solid var(--border_soft)' }}>
          <div style={{ fontSize: 13, opacity: 0.75 }}>
            Upload PDF, automatische Erkennung (Dokumenttyp/Lieferant/Betrag/Gebäude), Vorschlag Dateiname, Download.
          </div>

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
                    style={{
                      marginTop: 12,
                      border: '1px solid var(--border_soft)',
                      borderRadius: 14,
                      overflow: 'hidden',
                      background: 'var(--panel2)'
                    }}
                  >
                    <div style={{ padding: 12 }}>
                      <ResultCard result={it.result} embedded />
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

      {previewItem && (
        <div style={{ borderLeft: '1px solid var(--border_soft)', height: '100vh', display: 'flex', flexDirection: 'column', minWidth: 600 }}>
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontSize: 15, fontWeight: 500 }}>{previewItem.file.name}</div>
            <button
              type="button"
              onClick={() => setPreviewId(null)}
              style={{ padding: 4, background: 'none', border: 'none', color: 'inherit', cursor: 'pointer', opacity: 0.7, transition: 'opacity 0.2s ease' }}
              onMouseEnter={(e) => e.currentTarget.style.opacity = '1'}
              onMouseLeave={(e) => e.currentTarget.style.opacity = '0.7'}
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M18 6L6 18M6 6l12 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </button>
          </div>
          <iframe
            title="PDF Preview"
            src={previewItem.pdfUrl}
            style={{ flex: 1, width: '100%', border: 'none', background: 'white' }}
          />
        </div>
      )}
    </main>
  );
}
