'use client';

import { useCallback, useState } from 'react';
import { Dropzone } from '@/components/Dropzone';
import { ResultCard } from '@/components/ResultCard';
import { processPdf } from '@/lib/apiClient';
import { renderFirstPagePng } from '@/lib/pdfRender';
import type { ProcessResult } from '@/lib/types';

export default function Page() {
  const [result, setResult] = useState<ProcessResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const onFile = useCallback(async (file: File) => {
    setError(null);
    setResult(null);
    try {
      const page1 = await renderFirstPagePng(file);
      const r = await processPdf(file, page1.blob, page1.error, page1.ms);
      setResult(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unbekannter Fehler');
    }
  }, []);

  return (
    <main style={{ maxWidth: 980, margin: '0 auto', padding: '28px 18px 80px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 18 }}>
        <div style={{ fontSize: 22, fontWeight: 800 }}>Postbeschriftung</div>
        <div style={{ fontSize: 13, opacity: 0.75 }}>
          Upload PDF, automatische Erkennung (Dokumenttyp/Lieferant/Betrag/Gebäude), Vorschlag Dateiname, Download.
        </div>
      </div>

      <div style={{ display: 'grid', gap: 18 }}>
        <Dropzone onFile={onFile} />

        {error ? (
          <div
            style={{
              border: '1px solid rgba(255, 120, 120, 0.35)',
              background: 'rgba(255, 120, 120, 0.08)',
              padding: 14,
              borderRadius: 14
            }}
          >
            <div style={{ fontWeight: 800 }}>Fehler</div>
            <div style={{ marginTop: 6, fontSize: 13, opacity: 0.9 }}>{error}</div>
          </div>
        ) : null}

        {result ? <ResultCard result={result} /> : null}
      </div>
    </main>
  );
}
