
'use client';

import { useMemo, useRef, useState } from 'react';
import { clearHistory, loadHistory } from '@/lib/history';
import { ThemeToggle } from '@/components/ThemeToggle';

export default function AnalysisPage() {
  const [items, setItems] = useState(() => loadHistory());
  const [range, setRange] = useState<'7d' | '30d' | 'all'>('7d');

  const stats = useMemo(() => {
    const now = Date.now();
    const windowMs =
      range === '7d' ? 7 * 24 * 60 * 60 * 1000 : range === '30d' ? 30 * 24 * 60 * 60 * 1000 : Number.POSITIVE_INFINITY;
    const filtered = items.filter((it) => {
      const t = Date.parse(it.created_at);
      if (!Number.isFinite(t)) return range === 'all';
      return now - t <= windowMs;
    });

    const byType = new Map<string, number>();
    const byVendor = new Map<string, number>();
    const byDay = new Map<string, number>();

    let totalPages = 0;
    let pagesKnown = 0;
    let usedOpenAI = 0;
    let withTextLayer = 0;

    for (const it of filtered) {
      byType.set(it.doc_type || 'Unbekannt', (byType.get(it.doc_type || 'Unbekannt') ?? 0) + 1);
      byVendor.set(it.vendor || 'UNK', (byVendor.get(it.vendor || 'UNK') ?? 0) + 1);

      const d = it.created_at ? it.created_at.slice(0, 10) : 'unknown';
      byDay.set(d, (byDay.get(d) ?? 0) + 1);

      if (typeof it.pages === 'number') {
        totalPages += it.pages;
        pagesKnown += 1;
      }
      if (it.used_openai) usedOpenAI += 1;
      if ((it.text_length ?? 0) > 200) withTextLayer += 1;
    }

    const topTypes = [...byType.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
    const topVendors = [...byVendor.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);

    const dayKey = (t: number) => new Date(t).toISOString().slice(0, 10);
    const utcStartOfDay = (t: number) => {
      const d = new Date(t);
      return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    };

    const end = utcStartOfDay(now);
    let start = end;
    if (range === '7d') start = end - 6 * 24 * 60 * 60 * 1000;
    if (range === '30d') start = end - 29 * 24 * 60 * 60 * 1000;
    if (range === 'all') {
      const times = filtered
        .map((it) => Date.parse(it.created_at))
        .filter((t) => Number.isFinite(t))
        .map((t) => utcStartOfDay(t));
      start = times.length ? Math.min(...times) : end;
      start = Math.max(start, end - 59 * 24 * 60 * 60 * 1000);
    }

    const series: [string, number][] = [];
    for (let t = start; t <= end; t += 24 * 60 * 60 * 1000) {
      const k = dayKey(t);
      series.push([k, byDay.get(k) ?? 0]);
    }

    const recent = filtered.slice(0, 15);

    return {
      count: filtered.length,
      totalPages,
      pagesKnown,
      usedOpenAI,
      withTextLayer,
      topTypes,
      topVendors,
      series,
      recent
    };
  }, [items, range]);

  return (
    <main style={{ maxWidth: 980, margin: '0 auto', padding: '28px 18px 80px' }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800 }}>Analyse</div>
          <div style={{ fontSize: 13, opacity: 0.75 }}>
            Dashboard über deine zuletzt verarbeiteten Dateien (lokal im Browser gespeichert).
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <select
            value={range}
            onChange={(e) => setRange(e.target.value as any)}
            style={{
              padding: '8px 10px',
              borderRadius: 10,
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'inherit',
              fontSize: 12
            }}
          >
            <option value="7d">Letzte 7 Tage</option>
            <option value="30d">Letzte 30 Tage</option>
            <option value="all">Alles</option>
          </select>
          <a
            href="/"
            style={{
              textDecoration: 'none',
              padding: '8px 10px',
              borderRadius: 10,
              border: '1px solid var(--border)',
              background: 'transparent',
              color: 'inherit',
              fontSize: 12
            }}
          >
            Zurück
          </a>
          <ThemeToggle />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.6fr 1fr', gap: 12 }}>
        <div style={{ border: '1px solid var(--border_soft)', borderRadius: 14, background: 'var(--panel)', padding: 14 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
            <div>
              <div style={{ fontSize: 12, opacity: 0.75 }}>Verarbeitete Dateien</div>
              <div style={{ marginTop: 4, fontSize: 16, fontWeight: 800 }}>Zeitverlauf</div>
            </div>
            <div style={{ fontSize: 12, opacity: 0.75 }}>{range === 'all' ? 'Letzte 60 Tage' : range}</div>
          </div>
          <div style={{ marginTop: 12 }}>
            <MiniLineChart series={stats.series} />
          </div>
        </div>

        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Kpi title="Dateien" value={String(stats.count)} />
            <Kpi title="Seiten" value={stats.pagesKnown ? String(stats.totalPages) : '—'} />
            <Kpi title="OCR" value={String(stats.usedOpenAI)} />
            <Kpi title="Textlayer" value={String(stats.withTextLayer)} />
          </div>

          <div style={{ border: '1px solid var(--border_soft)', borderRadius: 14, background: 'var(--panel)', padding: 14 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
              <div style={{ fontWeight: 800 }}>Aktionen</div>
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
                  cursor: 'pointer',
                  fontSize: 12
                }}
              >
                Verlauf löschen
              </button>
            </div>
            <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
              Hinweis: Analyse basiert auf lokalem Browser-Speicher. Anderer Rechner/Browser hat eigene Daten.
            </div>
          </div>
        </div>
      </div>

      <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 12 }}>
        <Panel title="Dokumenttypen">
          {stats.topTypes.length ? (
            <div style={{ display: 'grid', gap: 8 }}>
              {stats.topTypes.map(([k, v]) => (
                <Row key={k} k={k} v={v} />
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 13, opacity: 0.75 }}>Noch keine Daten.</div>
          )}
        </Panel>

        <Panel title="Lieferanten">
          {stats.topVendors.length ? (
            <div style={{ display: 'grid', gap: 8 }}>
              {stats.topVendors.map(([k, v]) => (
                <Row key={k} k={k} v={v} />
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 13, opacity: 0.75 }}>Noch keine Daten.</div>
          )}
        </Panel>
      </div>

      <div style={{ marginTop: 12, border: '1px solid var(--border_soft)', borderRadius: 14, background: 'var(--panel)', padding: 14 }}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>Letzte Dateien</div>
        {stats.recent.length ? (
          <div style={{ display: 'grid', gap: 8 }}>
            {stats.recent.map((it) => (
              <div
                key={it.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 150px 110px 70px',
                  gap: 10,
                  alignItems: 'baseline',
                  padding: '8px 10px',
                  borderRadius: 12,
                  border: '1px solid var(--border_soft)',
                  background: 'var(--panel2)'
                }}
              >
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13, fontWeight: 650 }}>
                  {it.suggested_filename}
                </div>
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 12, opacity: 0.75 }}>
                  {it.vendor || 'UNK'}
                </div>
                <div style={{ fontSize: 12, opacity: 0.75 }}>{it.doc_type || 'Unbekannt'}</div>
                <div style={{ fontSize: 12, opacity: 0.75, textAlign: 'right' }}>{typeof it.pages === 'number' ? it.pages : '—'}</div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ fontSize: 13, opacity: 0.75 }}>Noch keine Daten.</div>
        )}
      </div>
    </main>
  );
}

function Kpi({ title, value }: { title: string; value: string }) {
  return (
    <div style={{ border: '1px solid var(--border_soft)', borderRadius: 14, background: 'var(--panel)', padding: 14 }}>
      <div style={{ fontSize: 12, opacity: 0.75 }}>{title}</div>
      <div style={{ marginTop: 6, fontSize: 22, fontWeight: 800 }}>{value}</div>
    </div>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ border: '1px solid var(--border_soft)', borderRadius: 14, background: 'var(--panel)', padding: 14 }}>
      <div style={{ fontWeight: 800, marginBottom: 10 }}>{title}</div>
      {children}
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

function MiniLineChart({ series }: { series: [string, number][] }) {
  const w = 640;
  const h = 180;
  const pad = 14;
  const yTicks = 4;

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  if (!series.length) {
    return (
      <div style={{ width: '100%', overflow: 'hidden' }}>
        <div style={{ height: h, borderRadius: 12, background: 'var(--panel2)', border: '1px solid var(--border_soft)' }} />
        <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12, opacity: 0.75 }}>
          <div>—</div>
          <div>—</div>
        </div>
      </div>
    );
  }

  const values = series.map(([, v]) => v);
  const max = Math.max(1, ...values);

  const coords = series.map(([, v], i) => {
    const x = pad + (i * (w - pad * 2)) / Math.max(1, series.length - 1);
    const y = h - pad - (v * (h - pad * 2)) / max;
    return { x, y };
  });
  const points = coords.map((p) => `${p.x},${p.y}`).join(' ');
  const lineD = coords.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaD = `${lineD} L ${coords.at(-1)?.x ?? pad} ${h - pad} L ${coords[0]?.x ?? pad} ${h - pad} Z`;

  const hovered = hoverIdx !== null ? { idx: hoverIdx, x: coords[hoverIdx]?.x, y: coords[hoverIdx]?.y } : null;

  return (
    <div ref={wrapRef} style={{ width: '100%', overflow: 'hidden', position: 'relative' }}>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        width="100%"
        height={h}
        style={{ display: 'block' }}
        onMouseLeave={() => setHoverIdx(null)}
        onMouseMove={(e) => {
          const rect = wrapRef.current?.getBoundingClientRect();
          if (!rect) return;
          const relX = ((e.clientX - rect.left) / rect.width) * w;
          const t = (relX - pad) / Math.max(1, w - pad * 2);
          const idx = Math.round(t * (series.length - 1));
          const clamped = Math.max(0, Math.min(series.length - 1, idx));
          setHoverIdx(clamped);
        }}
      >
        <defs>
          <linearGradient id="lineFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="rgba(37, 99, 235, 0.35)" />
            <stop offset="100%" stopColor="rgba(37, 99, 235, 0.00)" />
          </linearGradient>
        </defs>
        <rect x="0" y="0" width={w} height={h} fill="transparent" />

        {Array.from({ length: yTicks + 1 }).map((_, i) => {
          const v = Math.round((max * (yTicks - i)) / yTicks);
          const y = pad + ((h - pad * 2) * i) / yTicks;
          return (
            <g key={i}>
              <line x1={pad} y1={y} x2={w - pad} y2={y} stroke="var(--border_soft)" strokeWidth="1" />
              <text x={2} y={y + 3} fontSize="10" fill="currentColor" opacity="0.55">
                {v}
              </text>
            </g>
          );
        })}
        <path d={areaD} fill="url(#lineFill)" />
        <path d={lineD} fill="none" stroke="rgba(37, 99, 235, 0.9)" strokeWidth="2" />

        {hovered && typeof hovered.x === 'number' ? (
          <line
            x1={hovered.x}
            y1={pad}
            x2={hovered.x}
            y2={h - pad}
            stroke="rgba(37, 99, 235, 0.25)"
            strokeWidth="1"
          />
        ) : null}

        {coords.map((p, idx) => (
          <circle
            key={idx}
            cx={p.x}
            cy={p.y}
            r={hoverIdx === idx ? 4 : 2.5}
            fill={hoverIdx === idx ? 'rgba(37, 99, 235, 1)' : 'rgba(37, 99, 235, 0.95)'}
          />
        ))}
      </svg>

      {hovered && typeof hovered.x === 'number' && typeof hovered.y === 'number' ? (() => {
        const leftPct = (hovered.x / w) * 100;
        const topPct = (hovered.y / h) * 100;
        const clampedLeft = Math.max(14, Math.min(86, leftPct));
        const v = series[hovered.idx]?.[1] ?? 0;
        const d = series[hovered.idx]?.[0] ?? '';
        return (
          <div
            style={{
              position: 'absolute',
              left: `${clampedLeft}%`,
              top: `${topPct}%`,
              transform: 'translate(-50%, -120%)',
              pointerEvents: 'none',
              border: '1px solid var(--border_soft)',
              background: 'var(--panel)',
              borderRadius: 12,
              padding: '8px 10px',
              fontSize: 12,
              boxShadow: '0 12px 32px rgba(0,0,0,0.18)',
              minWidth: 160
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: '50%',
                bottom: -6,
                width: 10,
                height: 10,
                transform: 'translateX(-50%) rotate(45deg)',
                background: 'var(--panel)',
                borderRight: '1px solid var(--border_soft)',
                borderBottom: '1px solid var(--border_soft)'
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
              <div style={{ fontWeight: 800, fontSize: 14 }}>{v}</div>
              <div style={{ opacity: 0.75 }}>{d}</div>
            </div>
            <div style={{ marginTop: 2, opacity: 0.75 }}>Verarbeitete Dateien</div>
          </div>
        );
      })() : null}

      <div style={{ marginTop: 6, display: 'flex', justifyContent: 'space-between', gap: 10, fontSize: 12, opacity: 0.75 }}>
        <div>{series[0]?.[0] ?? '—'}</div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          <div style={{ padding: '2px 8px', borderRadius: 999, border: '1px solid var(--border_soft)', background: 'var(--panel2)' }}>
            Heute: {series.at(-1)?.[1] ?? 0}
          </div>
          <div>{series.at(-1)?.[0] ?? '—'}</div>
        </div>
      </div>
    </div>
  );
}
