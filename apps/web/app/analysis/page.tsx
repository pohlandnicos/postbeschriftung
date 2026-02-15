
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

    const timeSeries: [string, number][] = [];
    for (let t = start; t <= end; t += 24 * 60 * 60 * 1000) {
      const k = dayKey(t);
      const docs = byDay.get(k) ?? 0;
      timeSeries.push([k, docs * 30]); // 30 seconds per doc
    }

    const totalTimeSaved = filtered.length * 30; // seconds
    const totalMinutes = Math.floor(totalTimeSaved / 60);
    const totalHours = Math.floor(totalMinutes / 60);
    const remainingMinutes = totalMinutes % 60;
    const timeLabel =
      totalHours > 0
        ? `${totalHours}h ${remainingMinutes}min`
        : totalMinutes > 0
        ? `${totalMinutes}min`
        : `${totalTimeSaved}s`;

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
      timeSeries,
      timeLabel,
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

      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, minHeight: 320 }}>
          <div style={{ border: '1px solid var(--border_soft)', borderRadius: 14, background: 'var(--panel)', padding: 14, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 12, opacity: 0.75 }}>Dateien</div>
                <div style={{ marginTop: 4, fontSize: 16, fontWeight: 800 }}>Zeitverlauf</div>
              </div>
              <div style={{ fontSize: 12, opacity: 0.75 }}>{range === 'all' ? 'Letzte 60 Tage' : range}</div>
            </div>
            <div style={{ marginTop: 12, flex: 1, minHeight: 0 }}>
              <MiniLineChart series={stats.series} />
            </div>
          </div>
          <div style={{ border: '1px solid var(--border_soft)', borderRadius: 14, background: 'var(--panel)', padding: 14, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 12, opacity: 0.75 }}>Minuten</div>
                <div style={{ marginTop: 4, fontSize: 16, fontWeight: 800 }}>Zeitersparnis</div>
              </div>
              <div style={{ fontSize: 12, opacity: 0.75 }}>Gesamt: {stats.timeLabel}</div>
            </div>
            <div style={{ marginTop: 12, flex: 1, minHeight: 0 }}>
              <MiniLineChart series={stats.timeSeries} />
            </div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <Kpi title="Dateien" value={String(stats.count)} />
          <Kpi title="Seiten" value={stats.pagesKnown ? String(stats.totalPages) : '—'} />
          <Kpi title="Zeitersparnis" value={stats.timeLabel} />

        </div>
      </div>

      <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 12 }}>
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
                <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', fontSize: 13, fontWeight: 400 }}>
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
  const w = 720;
  const h = 240;
  const padL = 28;
  const padR = 40;
  const padT = 14;
  const padB = 22;
  const yTicks = 3;

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [hover, setHover] = useState<{ idx: number; xPx: number; yPx: number; wPx: number; hPx: number } | null>(
    null
  );

  if (!series.length) {
    return (
      <div style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
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
    const x = padL + (i * (w - padL - padR)) / Math.max(1, series.length - 1);
    const y = h - padB - (v * (h - padT - padB)) / max;
    return { x, y };
  });
  const points = coords.map((p) => `${p.x},${p.y}`).join(' ');
  const lineD = coords.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
  const areaD = `${lineD} L ${coords.at(-1)?.x ?? padL} ${h - padB} L ${coords[0]?.x ?? padL} ${h - padB} Z`;

  const hovered =
    hover !== null
      ? {
          idx: hover.idx,
          x: coords[hover.idx]?.x,
          y: coords[hover.idx]?.y,
          xPx: hover.xPx,
          yPx: hover.yPx,
          wPx: hover.wPx,
          hPx: hover.hPx
        }
      : null;

  return (
    <div ref={wrapRef} style={{ width: '100%', overflow: 'hidden', position: 'relative' }}>
      <svg
        viewBox={`0 0 ${w} ${h}`}
        width="100%"
        height={h}
        style={{ display: 'block' }}
        onMouseLeave={() => setHover(null)}
        onMouseMove={(e) => {
          const rect = wrapRef.current?.getBoundingClientRect();
          if (!rect) return;
          const relX = ((e.clientX - rect.left) / rect.width) * w;
          const t = (relX - padL) / Math.max(1, w - padL - padR);
          const idx = Math.round(t * (series.length - 1));
          const clamped = Math.max(0, Math.min(series.length - 1, idx));
          const xPx = e.clientX - rect.left;
          const yPx = e.clientY - rect.top;
          setHover({ idx: clamped, xPx, yPx, wPx: rect.width, hPx: rect.height });
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
          const rawV = (max * (yTicks - i)) / yTicks;
          const v = Math.ceil(rawV);
          const y = padT + ((h - padT - padB) * i) / yTicks;
          return (
            <g key={i}>
              <line x1={padL} y1={y} x2={w - padR} y2={y} stroke="var(--border_soft)" strokeWidth="1" strokeDasharray="4 4" />
              <text x={4} y={y + 4} fontSize="13" fill="currentColor" opacity="0.65" fontWeight="500">
                {v}
              </text>
            </g>
          );
        })}
        <path d={areaD} fill="url(#lineFill)" />
        <path d={lineD} fill="none" stroke="rgba(37, 99, 235, 0.95)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />

        {hovered && typeof hovered.x === 'number' ? (
          <line
            x1={hovered.x}
            y1={padT}
            x2={hovered.x}
            y2={h - padB}
            stroke="rgba(37, 99, 235, 0.25)"
            strokeWidth="1"
          />
        ) : null}

        {coords.map((p, idx) => (
          <circle
            key={idx}
            cx={p.x}
            cy={p.y}
            r={hovered?.idx === idx ? 4 : 2.5}
            fill={hovered?.idx === idx ? 'rgba(37, 99, 235, 1)' : 'rgba(37, 99, 235, 0.95)'}
          />
        ))}
      </svg>

      {hovered && typeof hovered.xPx === 'number' ? (() => {
        const tooltipW = 140;
        const tooltipH = 52;

        const left = Math.max(tooltipW / 2 + 8, Math.min(hovered.wPx - tooltipW / 2 - 8, hovered.xPx));

        const preferBelow = hovered.yPx < 54;
        const preferAbove = hovered.yPx > hovered.hPx - 54;
        const placeBelow = preferBelow && !preferAbove;

        const top = placeBelow
          ? Math.min(hovered.hPx - 8, hovered.yPx + 16)
          : Math.max(8, hovered.yPx - 16);

        const v = series[hovered.idx]?.[1] ?? 0;
        const d = series[hovered.idx]?.[0] ?? '';

        return (
          <div
            style={{
              position: 'absolute',
              left,
              top,
              transform: placeBelow ? 'translate(-50%, 0%)' : 'translate(-50%, -100%)',
              pointerEvents: 'none',
              border: '1px solid var(--border)',
              background: 'var(--bg)',
              borderRadius: 12,
              padding: '8px 10px',
              fontSize: 12,
              boxShadow: '0 12px 32px rgba(0,0,0,0.18)',
              width: tooltipW,
              minHeight: tooltipH,
              zIndex: 10
            }}
          >
            <div
              style={{
                position: 'absolute',
                left: '50%',
                top: placeBelow ? -6 : undefined,
                bottom: placeBelow ? undefined : -6,
                width: 10,
                height: 10,
                transform: 'translateX(-50%) rotate(45deg)',
                background: 'var(--bg)',
                borderLeft: placeBelow ? '1px solid var(--border)' : undefined,
                borderTop: placeBelow ? '1px solid var(--border)' : undefined,
                borderRight: placeBelow ? undefined : '1px solid var(--border)',
                borderBottom: placeBelow ? undefined : '1px solid var(--border)'
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
