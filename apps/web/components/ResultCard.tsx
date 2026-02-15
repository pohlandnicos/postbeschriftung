'use client';

import type { ProcessResult } from '@/lib/types';

export function ResultCard({ result }: { result: ProcessResult }) {
  const score = result.building_match?.score ?? null;
  const lowBuilding = score !== null && score < 90;
  const textLen = typeof result.debug?.text_length === 'number' ? result.debug.text_length : null;
  const buildSha = typeof result.debug?.build_sha === 'string' ? result.debug.build_sha : '';
  const head = typeof result.debug?.head === 'string' ? result.debug.head : '';
  const usedOpenAI = typeof result.debug?.used_openai === 'boolean' ? result.debug.used_openai : false;
  const openaiAvailable =
    typeof result.debug?.openai_available === 'boolean' ? result.debug.openai_available : false;
  const page1Received =
    typeof result.debug?.page1_received === 'boolean' ? result.debug.page1_received : false;
  const page1Size = typeof result.debug?.page1_size === 'number' ? result.debug.page1_size : null;
  const page1Error = typeof result.debug?.page1_error === 'string' ? result.debug.page1_error : '';
  const page1Ms = typeof result.debug?.page1_ms === 'number' ? result.debug.page1_ms : null;

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
        <Row k="text_length" v={textLen === null ? '' : String(textLen)} />
        <Row k="openai_available" v={openaiAvailable ? 'true' : 'false'} />
        <Row k="page1_received" v={page1Received ? 'true' : 'false'} />
        <Row k="page1_size" v={page1Size === null ? '' : String(page1Size)} />
        <Row k="page1_error" v={page1Error} />
        <Row k="page1_ms" v={page1Ms === null ? '' : String(page1Ms)} />
        <Row k="used_openai" v={usedOpenAI ? 'true' : 'false'} />
        <Row k="build_sha" v={buildSha} />
        <Row
          k="building"
          v={
            result.building_match?.object_number
              ? `${result.building_match.object_number} (${result.building_match.matched_label ?? ''}) score=${result.building_match.score ?? ''}`
              : `kein Match (score=${result.building_match?.score ?? ''})`
          }
        />
        <Row k="suggested_filename" v={result.suggested_filename} />
        <Row k="head" v={head} />
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
