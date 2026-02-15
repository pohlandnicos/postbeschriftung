'use client';

import { useCallback, useState } from 'react';
import { Dropzone } from '@/components/Dropzone';
import { ResultCard } from '@/components/ResultCard';
import { processPdf } from '@/lib/apiClient';
import { renderFirstPagePng } from '@/lib/pdfRender';
import type { ProcessResult } from '@/lib/types';

type QueueItem = {
  id: string;
  file: File;
  status: 'queued' | 'processing' | 'done' | 'error';
  result: ProcessResult | null;
  error: string | null;
};

export default function Page() {
  const [items, setItems] = useState<QueueItem[]>([]);

  const processOne = useCallback(async (itemId: string, file: File) => {
    setItems((prev) =>
      prev.map((it) => (it.id === itemId ? { ...it, status: 'processing', error: null } : it))
    );
    try {
      const page1 = await renderFirstPagePng(file);
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
        status: 'queued',
        result: null,
        error: null
      }));
      setItems((prev) => [...newItems, ...prev]);

      for (const it of newItems) {
        await processOne(it.id, it.file);
      }
    },
    [processOne]
  );

  return (
    <main style={{ maxWidth: 980, margin: '0 auto', padding: '28px 18px 80px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
        <div style={{ fontSize: 22, fontWeight: 800 }}>Postbeschriftung</div>
        <div style={{ fontSize: 13, opacity: 0.75 }}>
          Upload PDF, automatische Erkennung (Dokumenttyp/Lieferant/Betrag/Gebäude), Vorschlag Dateiname, Download.
        </div>
      </div>

      <div style={{ display: 'grid', gap: 18 }}>
        <Dropzone onFiles={onFiles} />

        {items.map((it) => (
          <div key={it.id} style={{ display: 'grid', gap: 10 }}>
            <div style={{ fontSize: 13, opacity: 0.8 }}>
              {it.file.name} — {it.status}
            </div>

            {it.error ? (
              <div
                style={{
                  border: '1px solid rgba(255, 120, 120, 0.35)',
                  background: 'rgba(255, 120, 120, 0.08)',
                  padding: 14,
                  borderRadius: 14
                }}
              >
                <div style={{ fontWeight: 800 }}>Fehler</div>
                <div style={{ marginTop: 6, fontSize: 13, opacity: 0.9 }}>{it.error}</div>
              </div>
            ) : null}

            {it.result ? <ResultCard result={it.result} /> : null}
          </div>
        ))}
      </div>
    </main>
  );
}
