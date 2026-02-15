
'use client';

import { useEffect, useMemo, useRef, useState } from 'react';

type AnalyticsResponse = {
  meta: {
    range: string;
    from: string | null;
    to: string | null;
    limited_to: number;
  };
  totals: {
    documents: number;
    total_pages: number;
    pages_known: number;
    unique_objects: number;
  };
  facets: {
    objects: { object_number: string | null; label: string; count: number }[];
    doc_types: string[];
    vendors: string[];
  };
  top: {
    by_type: { key: string; count: number }[];
    by_vendor: { key: string; count: number }[];
  };
  series: [string, number][];
  matrix: { object_number: string | null; label: string; total: number; by_type: Record<string, number> }[];
  recent: {
    id: string;
    created_at: string;
    suggested_filename: string;
    vendor: string;
    doc_type: string;
    pages: number | null;
    object_number: string | null;
  }[];
};

export default function AnalysisPage() {
  const [range, setRange] = useState<'7d' | '30d' | 'all'>('7d');
  const [objectNumber, setObjectNumber] = useState<string>('');
  const [docType, setDocType] = useState<string>('');
  const [vendor, setVendor] = useState<string>('');
  const [data, setData] = useState<AnalyticsResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const ctrl = new AbortController();
    const run = async () => {
      setBusy(true);
      setError(null);
      try {
        const qs = new URLSearchParams();
        qs.set('range', range);
        if (objectNumber) qs.set('object_number', objectNumber);
        if (docType) qs.set('doc_type', docType);
        if (vendor) qs.set('vendor', vendor);

        const res = await fetch(`/api/analytics?${qs.toString()}`, { signal: ctrl.signal });
        if (!res.ok) throw new Error(await res.text());
        const json = (await res.json()) as AnalyticsResponse;
        setData(json);
      } catch (e) {
        if ((e as any)?.name === 'AbortError') return;
        const msg = e instanceof Error ? e.message : 'Unknown error';
        setError(msg);
      } finally {
        setBusy(false);
      }
    };

    void run();
    return () => ctrl.abort();
  }, [range, objectNumber, docType, vendor]);

  const stats = useMemo(() => {
    const count = data?.totals.documents ?? 0;
    const totalPages = data?.totals.total_pages ?? 0;
    const pagesKnown = data?.totals.pages_known ?? 0;

    const totalTimeSaved = count * 30; // seconds
    const totalMinutes = Math.floor(totalTimeSaved / 60);
    const totalHours = Math.floor(totalMinutes / 60);
    const remainingMinutes = totalMinutes % 60;
    const timeLabel =
      totalHours > 0
        ? `${totalHours}h ${remainingMinutes}min`
        : totalMinutes > 0
        ? `${totalMinutes}min`
        : `${totalTimeSaved}s`;

    const timeSeries: [string, number][] = (data?.series ?? []).map(([d, docs]) => [d, docs * 30]);
    const topTypes = (data?.top.by_type ?? []).slice(0, 8).map((x) => [x.key, x.count] as [string, number]);
    const topVendors = (data?.top.by_vendor ?? []).slice(0, 8).map((x) => [x.key, x.count] as [string, number]);
    const recent = (data?.recent ?? []).slice(0, 15);

    return {
      count,
      totalPages,
      pagesKnown,
      topTypes,
      topVendors,
      series: data?.series ?? ([] as [string, number][]),
      timeSeries,
      timeLabel,
      recent
    };
  }, [data]);

  const filtersLabel = useMemo(() => {
    const parts: string[] = [];
    if (objectNumber) parts.push(`Objekt #${objectNumber}`);
    if (docType) parts.push(docType);
    if (vendor) parts.push(vendor);
    parts.push(range === 'all' ? 'Zeitraum: Alles' : range === '7d' ? 'Zeitraum: 7 Tage' : 'Zeitraum: 30 Tage');
    return parts.join(' · ');
  }, [docType, objectNumber, range, vendor]);

  const objectOptions = useMemo(() => {
    const opts = (data?.facets.objects ?? []).map((o) => ({
      value: o.object_number ?? '',
      label: o.object_number ? `#${o.object_number}` : 'Ohne Objekt',
      subLabel: o.label ? `${o.label} (${o.count})` : `(${o.count})`
    }));
    return [{ value: '', label: 'Alle Gebäude', subLabel: '' }, ...opts];
  }, [data?.facets.objects]);

  const docTypeOptions = useMemo(() => {
    const opts = (data?.facets.doc_types ?? []).map((t) => ({ value: t, label: t, subLabel: '' }));
    return [{ value: '', label: 'Alle Arten', subLabel: '' }, ...opts];
  }, [data?.facets.doc_types]);

  const vendorOptions = useMemo(() => {
    const opts = (data?.facets.vendors ?? []).map((v) => ({ value: v, label: v, subLabel: '' }));
    return [{ value: '', label: 'Alle Lieferanten', subLabel: '' }, ...opts];
  }, [data?.facets.vendors]);

  const rangeOptions = useMemo(
    () => [
      { value: '7d', label: 'Letzte 7 Tage', subLabel: '' },
      { value: '30d', label: 'Letzte 30 Tage', subLabel: '' },
      { value: 'all', label: 'Alles', subLabel: '' }
    ],
    []
  );

  const rangeLabel = useMemo(() => {
    return range === 'all' ? 'Alles' : range === '7d' ? 'Letzte 7 Tage' : 'Letzte 30 Tage';
  }, [range]);

  return (
    <main style={{ maxWidth: 980, margin: '0 auto', padding: '28px 18px 80px' }}>
      <div style={{ display: 'grid', gap: 12, marginBottom: 12 }}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800 }}>Analyse</div>
            <div style={{ fontSize: 13, opacity: 0.75 }}>Dashboard über deine verarbeiteten Dateien (Supabase).</div>
          </div>
          <div style={{ fontSize: 12, opacity: 0.7, textAlign: 'right' }}>{busy ? 'Lädt…' : filtersLabel}</div>
        </div>

        <div style={{ border: '1px solid var(--border_soft)', borderRadius: 14, background: 'var(--panel)', padding: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, marginBottom: 10 }}>
            <div style={{ fontWeight: 800 }}>Filter</div>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <HeaderComboBox
                value={range}
                options={rangeOptions}
                onChange={(v) => setRange(v as any)}
                leftIcon="calendar"
                ariaLabel="Zeitraum"
              />
              <button
                onClick={() => {
                  setObjectNumber('');
                  setDocType('');
                  setVendor('');
                  setRange('7d');
                }}
                style={{
                  padding: '7px 10px',
                  borderRadius: 10,
                  border: '1px solid var(--border_soft)',
                  background: 'var(--panel2)',
                  color: 'inherit',
                  fontSize: 12,
                  cursor: 'pointer'
                }}
              >
                Reset
              </button>
            </div>
          </div>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
              gap: 10
            }}
          >
            <LabeledComboBox label="Gebäude" value={objectNumber} options={objectOptions} onChange={setObjectNumber} placeholder="Gebäude suchen…" />
            <LabeledComboBox label="Dokument-Art" value={docType} options={docTypeOptions} onChange={setDocType} placeholder="Art suchen…" />
            <LabeledComboBox label="Lieferant" value={vendor} options={vendorOptions} onChange={setVendor} placeholder="Lieferant suchen…" />
          </div>

          <div style={{ marginTop: 10, fontSize: 12, opacity: 0.7 }}>
            Zeitraum: {rangeLabel}
          </div>
        </div>
      </div>

      {error ? (
        <div style={{ marginBottom: 12, padding: 12, borderRadius: 12, border: '1px solid rgba(239,68,68,0.35)', background: 'rgba(239,68,68,0.08)', fontSize: 13 }}>
          {error}
        </div>
      ) : null}

      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12, minHeight: 320 }}>
          <div style={{ border: '1px solid var(--border_soft)', borderRadius: 14, background: 'var(--panel)', padding: 14, display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, alignItems: 'center' }}>
              <div>
                <div style={{ fontSize: 12, opacity: 0.75 }}>Dateien</div>
                <div style={{ marginTop: 4, fontSize: 16, fontWeight: 800 }}>Zeitverlauf</div>
              </div>
              <div style={{ fontSize: 12, opacity: 0.75 }}>{range === 'all' ? 'Alle' : range}</div>
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

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 12 }}>
          <Kpi title="Dateien" value={String(stats.count)} />
          <Kpi title="Seiten" value={stats.pagesKnown ? String(stats.totalPages) : '—'} />
          <Kpi title="Zeitersparnis" value={stats.timeLabel} />

        </div>
      </div>

      <div style={{ marginTop: 12, display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12 }}>
        <Panel title="Dokumenttypen">
          {stats.topTypes.length ? (
            <div style={{ display: 'grid', gap: 8 }}>
              {stats.topTypes.map(([k, v]) => (
                <Row
                  key={k}
                  k={k}
                  v={v}
                  onClick={() => {
                    setDocType((prev) => (prev === k ? '' : k));
                  }}
                />
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
                <Row
                  key={k}
                  k={k}
                  v={v}
                  onClick={() => {
                    setVendor((prev) => (prev === k ? '' : k));
                  }}
                />
              ))}
            </div>
          ) : (
            <div style={{ fontSize: 13, opacity: 0.75 }}>Noch keine Daten.</div>
          )}
        </Panel>
      </div>

      <div style={{ marginTop: 12, border: '1px solid var(--border_soft)', borderRadius: 14, background: 'var(--panel)', padding: 14 }}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>Gebäude × Dokument-Art</div>

        {data?.matrix?.length ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'separate', borderSpacing: 0, fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--panel2)' }}>
                  <th style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid var(--border_soft)', whiteSpace: 'nowrap' }}>Gebäude</th>
                  <th style={{ textAlign: 'right', padding: 10, borderBottom: '1px solid var(--border_soft)', whiteSpace: 'nowrap' }}>Gesamt</th>
                  {(data?.facets.doc_types ?? []).slice(0, 8).map((t) => (
                    <th key={t} style={{ textAlign: 'right', padding: 10, borderBottom: '1px solid var(--border_soft)', whiteSpace: 'nowrap' }}>
                      {t}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.matrix
                  .slice()
                  .sort((a, b) => (b.total ?? 0) - (a.total ?? 0))
                  .slice(0, 25)
                  .map((row) => {
                    const key = row.object_number ?? 'none';
                    return (
                      <tr key={key} style={{ background: 'transparent' }}>
                        <td style={{ padding: 10, verticalAlign: 'top', maxWidth: 420, borderBottom: '1px solid var(--border_soft)' }}>
                          <div style={{ fontWeight: 700 }}>
                            {row.object_number ? `#${row.object_number}` : 'Ohne Objekt'}
                          </div>
                          {row.label ? <div style={{ fontSize: 12, opacity: 0.75 }}>{row.label}</div> : null}
                        </td>
                        <td style={{ padding: 10, textAlign: 'right', fontWeight: 800, borderBottom: '1px solid var(--border_soft)' }}>{row.total}</td>
                        {(data?.facets.doc_types ?? []).slice(0, 8).map((t) => {
                          const v = row.by_type?.[t] ?? 0;
                          return (
                            <td key={t} style={{ padding: 10, textAlign: 'right', borderBottom: '1px solid var(--border_soft)' }}>
                              <button
                                disabled={!v}
                                onClick={() => {
                                  setObjectNumber(row.object_number ?? '');
                                  setDocType(t);
                                }}
                                style={{
                                  padding: '2px 8px',
                                  borderRadius: 999,
                                  border: '1px solid var(--border_soft)',
                                  background: v ? 'var(--panel2)' : 'transparent',
                                  color: 'inherit',
                                  cursor: v ? 'pointer' : 'default',
                                  opacity: v ? 1 : 0.35,
                                  fontSize: 12
                                }}
                              >
                                {v || '—'}
                              </button>
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ fontSize: 13, opacity: 0.75 }}>Noch keine Daten.</div>
        )}
      </div>

      <div style={{ marginTop: 12, border: '1px solid var(--border_soft)', borderRadius: 14, background: 'var(--panel)', padding: 14 }}>
        <div style={{ fontWeight: 800, marginBottom: 10 }}>Letzte Dateien</div>
        {stats.recent.length ? (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--panel2)' }}>
                  <th style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid var(--border_soft)' }}>Datei</th>
                  <th style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid var(--border_soft)', whiteSpace: 'nowrap' }}>Gebäude</th>
                  <th style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid var(--border_soft)' }}>Lieferant</th>
                  <th style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid var(--border_soft)', whiteSpace: 'nowrap' }}>Art</th>
                  <th style={{ textAlign: 'right', padding: 10, borderBottom: '1px solid var(--border_soft)', whiteSpace: 'nowrap' }}>Seiten</th>
                </tr>
              </thead>
              <tbody>
                {stats.recent.map((it) => (
                  <tr key={it.id} style={{ borderBottom: '1px solid var(--border_soft)' }}>
                    <td style={{ padding: 10, maxWidth: 420 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.suggested_filename}</div>
                      <div style={{ marginTop: 2, fontSize: 12, opacity: 0.65 }}>{new Date(it.created_at).toLocaleString()}</div>
                    </td>
                    <td style={{ padding: 10, whiteSpace: 'nowrap' }}>{it.object_number ? `#${it.object_number}` : '—'}</td>
                    <td style={{ padding: 10, maxWidth: 260 }}>
                      <div style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{it.vendor || 'UNK'}</div>
                    </td>
                    <td style={{ padding: 10, whiteSpace: 'nowrap' }}>{it.doc_type || 'Unbekannt'}</td>
                    <td style={{ padding: 10, textAlign: 'right' }}>{typeof it.pages === 'number' ? it.pages : '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
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

type ComboOption = { value: string; label: string; subLabel?: string };

function LabeledComboBox(props: {
  label: string;
  value: string;
  options: ComboOption[];
  onChange: (v: string) => void;
  placeholder: string;
  searchable?: boolean;
}) {
  const { label, value, options, onChange, placeholder, searchable = true } = props;

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);
  const [q, setQ] = useState('');

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const el = wrapRef.current;
      if (!el) return;
      if (e.target instanceof Node && el.contains(e.target)) return;
      setOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    // focus handled by the input itself
  }, [open, searchable]);

  const current = useMemo(() => options.find((o) => o.value === value) ?? options[0], [options, value]);
  const filtered = useMemo(() => {
    const qq = q.trim().toLowerCase();
    if (!qq || !searchable) return options;
    return options.filter((o) => {
      const a = (o.label ?? '').toLowerCase();
      const b = (o.subLabel ?? '').toLowerCase();
      return a.includes(qq) || b.includes(qq) || String(o.value).toLowerCase().includes(qq);
    });
  }, [options, q, searchable]);

  return (
    <div ref={wrapRef} style={{ display: 'grid', gap: 6, position: 'relative' }}>
      <div style={{ fontSize: 12, opacity: 0.75 }}>{label}</div>

      <div style={{ position: 'relative' }}>
        <input
          value={open && searchable ? q : current?.label ?? ''}
          onChange={(e) => {
            setQ(e.target.value);
            if (!open) setOpen(true);
          }}
          onFocus={() => {
            setOpen(true);
            if (!searchable) setQ('');
          }}
          placeholder={placeholder}
          readOnly={!searchable}
          style={{
            width: '100%',
            padding: '9px 38px 9px 10px',
            borderRadius: 12,
            border: open ? '1px solid rgba(37, 99, 235, 0.55)' : '1px solid var(--border_soft)',
            background: 'var(--panel2)',
            color: 'inherit',
            fontSize: 12,
            outline: 'none'
          }}
        />
        <button
          type="button"
          onClick={() => {
            setOpen((v) => !v);
            setQ('');
          }}
          aria-label={`${label} öffnen`}
          style={{
            position: 'absolute',
            right: 8,
            top: '50%',
            transform: 'translateY(-50%)',
            width: 26,
            height: 26,
            borderRadius: 10,
            border: '1px solid transparent',
            background: 'transparent',
            cursor: 'pointer',
            display: 'grid',
            placeItems: 'center',
            opacity: 0.8
          }}
        >
          <span
            aria-hidden
            style={{
              width: 18,
              height: 18,
              backgroundRepeat: 'no-repeat',
              backgroundPosition: 'center',
              backgroundSize: '18px 18px',
              backgroundImage:
                'url("data:image/svg+xml,%3Csvg xmlns=\"http://www.w3.org/2000/svg\" width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"%239CA3AF\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"%3E%3Cpolyline points=\"6 9 12 15 18 9\"/%3E%3C/svg%3E")'
            }}
          />
        </button>
      </div>

      {open ? (
        <div
          style={{
            position: 'absolute',
            top: 'calc(100% + 8px)',
            left: 0,
            right: 0,
            zIndex: 50,
            border: '1px solid var(--border)',
            background: 'var(--bg)',
            borderRadius: 14,
            boxShadow: '0 18px 46px rgba(0,0,0,0.18)',
            overflow: 'hidden'
          }}
        >
          <div style={{ maxHeight: 280, overflow: 'auto', padding: 6 }}>
            {filtered.length ? (
              filtered.map((o) => {
                const active = o.value === value;
                return (
                  <button
                    key={`${o.value}-${o.label}`}
                    type="button"
                    onClick={() => {
                      onChange(o.value);
                      setOpen(false);
                      setQ('');
                    }}
                    style={{
                      width: '100%',
                      textAlign: 'left',
                      padding: '9px 10px',
                      borderRadius: 12,
                      border: '1px solid transparent',
                      background: active ? 'rgba(37, 99, 235, 0.10)' : 'transparent',
                      color: 'inherit',
                      cursor: 'pointer'
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
                      <div style={{ fontSize: 13, fontWeight: active ? 800 : 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {o.label}
                      </div>
                      {active ? <div style={{ fontSize: 12, opacity: 0.7 }}>aktiv</div> : null}
                    </div>
                    {o.subLabel ? <div style={{ marginTop: 2, fontSize: 12, opacity: 0.7, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{o.subLabel}</div> : null}
                  </button>
                );
              })
            ) : (
              <div style={{ padding: 10, fontSize: 13, opacity: 0.75 }}>Keine Treffer.</div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function HeaderComboBox(props: {
  value: string;
  options: ComboOption[];
  onChange: (v: string) => void;
  leftIcon?: 'calendar';
  ariaLabel: string;
}) {
  const { value, options, onChange, leftIcon, ariaLabel } = props;
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const el = wrapRef.current;
      if (!el) return;
      if (e.target instanceof Node && el.contains(e.target)) return;
      setOpen(false);
    };
    window.addEventListener('mousedown', onDown);
    return () => window.removeEventListener('mousedown', onDown);
  }, [open]);

  const current = useMemo(() => options.find((o) => o.value === value) ?? options[0], [options, value]);
  const iconSvg =
    leftIcon === 'calendar'
      ? 'url("data:image/svg+xml,%3Csvg xmlns=\"http://www.w3.org/2000/svg\" width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"%239CA3AF\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"%3E%3Crect x=\"3\" y=\"4\" width=\"18\" height=\"18\" rx=\"2\" ry=\"2\"/%3E%3Cline x1=\"16\" y1=\"2\" x2=\"16\" y2=\"6\"/%3E%3Cline x1=\"8\" y1=\"2\" x2=\"8\" y2=\"6\"/%3E%3Cline x1=\"3\" y1=\"10\" x2=\"21\" y2=\"10\"/%3E%3C/svg%3E")'
      : null;

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button
        type="button"
        aria-label={ariaLabel}
        onClick={() => setOpen((v) => !v)}
        style={{
          padding: '7px 10px',
          borderRadius: 10,
          border: '1px solid var(--border_soft)',
          background: 'var(--panel2)',
          color: 'inherit',
          fontSize: 12,
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          gap: 8
        }}
      >
        {iconSvg ? (
          <span
            aria-hidden
            style={{ width: 16, height: 16, backgroundImage: iconSvg, backgroundSize: '16px 16px', backgroundRepeat: 'no-repeat' }}
          />
        ) : null}
        <span>{current?.label ?? ''}</span>
      </button>

      {open ? (
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 8px)',
            zIndex: 60,
            minWidth: 220,
            border: '1px solid var(--border)',
            background: 'var(--bg)',
            borderRadius: 14,
            boxShadow: '0 18px 46px rgba(0,0,0,0.18)',
            overflow: 'hidden'
          }}
        >
          <div style={{ padding: 6 }}>
            {options.map((o) => {
              const active = o.value === value;
              return (
                <button
                  key={`${o.value}-${o.label}`}
                  type="button"
                  onClick={() => {
                    onChange(o.value);
                    setOpen(false);
                  }}
                  style={{
                    width: '100%',
                    textAlign: 'left',
                    padding: '9px 10px',
                    borderRadius: 12,
                    border: '1px solid transparent',
                    background: active ? 'rgba(37, 99, 235, 0.10)' : 'transparent',
                    color: 'inherit',
                    cursor: 'pointer',
                    fontSize: 13,
                    fontWeight: active ? 800 : 600
                  }}
                >
                  {o.label}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Row({ k, v, onClick }: { k: string; v: number; onClick?: () => void }) {
  return (
    <div
      onClick={onClick}
      style={{ display: 'flex', justifyContent: 'space-between', gap: 12, cursor: onClick ? 'pointer' : 'default' }}
    >
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
  const padL = 36;
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
              <text x={8} y={y + 4} fontSize="12" fill="currentColor" opacity="0.65" fontWeight="500" textAnchor="start">
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
