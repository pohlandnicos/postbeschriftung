'use client';

import { useMemo, useState } from 'react';
import { clearHistory, loadHistory } from '@/lib/history';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function AnalysisPage() {
  const [items, setItems] = useState(() => loadHistory());

  const stats = useMemo(() => {
    const byType = new Map<string, number>();
    const byVendor = new Map<string, number>();

    let totalPages = 0;
    let pagesKnown = 0;
    let usedOpenAI = 0;
    let withTextLayer = 0;

    for (const it of items) {
      byType.set(it.doc_type || 'Unbekannt', (byType.get(it.doc_type || 'Unbekannt') ?? 0) + 1);
      byVendor.set(it.vendor || 'UNK', (byVendor.get(it.vendor || 'UNK') ?? 0) + 1);

      if (typeof it.pages === 'number') {
        totalPages += it.pages;
        pagesKnown += 1;
      }
      if (it.used_openai) usedOpenAI += 1;
      if ((it.text_length ?? 0) > 200) withTextLayer += 1;
    }

    const topTypes = [...byType.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
    const topVendors = [...byVendor.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);

    return {
      count: items.length,
      totalPages,
      pagesKnown,
      usedOpenAI,
      withTextLayer,
      topTypes,
      topVendors
    };
  }, [items]);

  return (
    <main style={{ maxWidth: 980, margin: '0 auto', padding: '28px 18px 80px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>Analyse</div>
          <div style={{ fontSize: 13, opacity: 0.75 }}>Auswertung deiner zuletzt verarbeiteten Dateien (lokal im Browser gespeichert).</div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <a
            href="/"
            style={{
              textDecoration: 'none',
              padding: '8px 10px',
              borderRadius: 10,
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'inherit'
            }}
          >
            Zurück
          </a>
          <ThemeToggle />
        </div>
      </div>

      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: 12,
          marginBottom: 18
        }}
      >
        <Card title="Dateien" value={String(stats.count)} />
        <Card title="Seiten (Summe)" value={stats.pagesKnown ? String(stats.totalPages) : '—'} />
        <Card title="OCR genutzt" value={String(stats.usedOpenAI)} />
        <Card title="Textlayer" value={String(stats.withTextLayer)} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 12 }}>
        <div style={{ border: '1px solid var(--border_soft)', borderRadius: 14, background: 'var(--panel)', padding: 14 }}>
          <div style={{ fontWeight: 800, marginBottom: 10 }}>Dokumenttypen</div>
          {stats.topTypes.length ? (
            <div style={{ display: 'grid', gap: 8 }}>
              {stats.topTypes.map(([k, v]) => (
                <Row key={k} k={k} v={v} />
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 13, opacity: 0.75 }}>Noch keine Daten.</div>
          )}
        </div>

        <div style={{ border: '1px solid var(--border_soft)', borderRadius: 14, background: 'var(--panel)', padding: 14 }}>
          <div style={{ fontWeight: 800, marginBottom: 10 }}>Lieferanten</div>
          {stats.topVendors.length ? (
            <div style={{ display: 'grid', gap: 8 }}>
              {stats.topVendors.map(([k, v]) => (
                <Row key={k} k={k} v={v} />
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 13, opacity: 0.75 }}>Noch keine Daten.</div>
          )}
        </div>
      </div>

      <div style={{ marginTop: 18, display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'center' }}>
        <div style={{ fontSize: 12, opacity: 0.75 }}>
          Hinweis: Die Analyse basiert auf lokalem Browser-Speicher. Anderer Rechner/Browser hat eigene Daten.
        </div>
        <button
          type="button"
          onClick={() => {
            clearHistory();
            setItems([]);
          }}
          style={{
            padding: '8px 10px',
            borderRadius: 10,
            border: '1px solid rgba(255, 120, 120, 0.35)',
            background: 'rgba(255, 120, 120, 0.08)',
            color: 'inherit',
            cursor: 'pointer'
          }}
        >
          Verlauf löschen
        </button>
      </div>
    </main>
  );
}

function Card({ title, value }: { title: string; value: string }) {
  return (
    <div style={{ border: '1px solid var(--border_soft)', borderRadius: 14, background: 'var(--panel)', padding: 14 }}>
      <div style={{ fontSize: 12, opacity: 0.75 }}>{title}</div>
      <div style={{ marginTop: 6, fontSize: 22, fontWeight: 800 }}>{value}</div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: number }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
      <div style={{ fontSize: 13, opacity: 0.85, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {k}
      </div>
      <div style={{ fontSize: 13, fontWeight: 800 }}>{v}</div>
    </div>
  );
}
