'use client';

import type { ProcessResult } from '@/lib/types';

export function ResultCard({ result }: { result: ProcessResult }) {
  const score = result.building_match?.score ?? null;
  const lowBuilding = score !== null && score < 90;

  return (
    <div
      style={{
        border: '1px solid rgba(231, 238, 252, 0.12)',
        borderRadius: 14,
        padding: 18,
        background: 'rgba(255,255,255,0.02)'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12 }}>
        <div style={{ fontSize: 16, fontWeight: 700 }}>Ergebnis</div>
        {lowBuilding ? (
          <div
            style={{
              fontSize: 12,
              color: '#ffdd66',
              border: '1px solid rgba(255,221,102,0.35)',
              padding: '4px 8px',
              borderRadius: 999
            }}
          >
            Building Match &lt; 90
          </div>
        ) : null}
      </div>

      <div style={{ marginTop: 14, display: 'grid', gap: 10 }}>
        <Row k="file_id" v={result.file_id} />
        <Row k="doc_type" v={result.doc_type} />
        <Row k="vendor" v={result.vendor} />
        <Row k="amount" v={result.amount === null ? '' : String(result.amount)} />
        <Row k="currency" v={result.currency} />
        <Row k="date" v={result.date ?? ''} />
        <Row
          k="building"
          v={
            result.building_match?.object_number
              ? `${result.building_match.object_number} (${result.building_match.matched_label ?? ''}) score=${result.building_match.score ?? ''}`
              : `kein Match (score=${result.building_match?.score ?? ''})`
          }
        />
        <Row k="suggested_filename" v={result.suggested_filename} />
      </div>

      <div style={{ marginTop: 14, display: 'flex', gap: 10 }}>
        <a
          href={`/api/download/${encodeURIComponent(result.file_id)}`}
          style={{
            textDecoration: 'none',
            padding: '10px 12px',
            borderRadius: 12,
            background: '#2563eb',
            color: 'white',
            fontWeight: 700,
            fontSize: 14
          }}
        >
          PDF herunterladen
        </a>
        <div style={{ fontSize: 12, opacity: 0.75, alignSelf: 'center' }}>
          Download nutzt den vorgeschlagenen Dateinamen.
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: '170px 1fr',
        gap: 10,
        alignItems: 'baseline'
      }}
    >
      <div style={{ fontSize: 12, opacity: 0.7 }}>{k}</div>
      <div style={{ fontSize: 13, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas' }}>
        {v}
      </div>
    </div>
  );
}
