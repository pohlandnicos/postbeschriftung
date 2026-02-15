
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
    employees: string[];
  };
  top: {
    by_type: { key: string; count: number }[];
    by_vendor: { key: string; count: number }[];
    by_employee: { key: string; count: number }[];
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
  const [from, setFrom] = useState<string | null>(null);
  const [to, setTo] = useState<string | null>(null);
  const [objectNumber, setObjectNumber] = useState<string>('');
  const [docType, setDocType] = useState<string>('');
  const [vendor, setVendor] = useState<string>('');
  const [employee, setEmployee] = useState<string>('');
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
        if (employee) qs.set('employee', employee);
        if (from) qs.set('from', from);
        if (to) qs.set('to', to);

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
  }, [range, objectNumber, docType, vendor, employee, from, to]);

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
    if (employee) parts.push(employee);
    if (from || to) {
      const f = from ? new Date(from).toLocaleDateString() : '…';
      const t = to ? new Date(to).toLocaleDateString() : '…';
      parts.push(`Zeitraum: ${f} – ${t}`);
    } else {
      parts.push(range === 'all' ? 'Zeitraum: Alles' : range === '7d' ? 'Zeitraum: 7 Tage' : 'Zeitraum: 30 Tage');
    }
    return parts.join(' · ');
  }, [docType, objectNumber, range, vendor, employee, from, to]);

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

  const employeeOptions = useMemo(() => {
    const opts = (data?.facets.employees ?? []).map((e) => ({ value: e, label: e, subLabel: '' }));
    return [{ value: '', label: 'Alle Mitarbeiter', subLabel: '' }, ...opts];
  }, [data?.facets.employees]);

  const rangeLabel = useMemo(() => {
    if (from || to) {
      const f = from ? new Date(from).toLocaleDateString() : '…';
      const t = to ? new Date(to).toLocaleDateString() : '…';
      return `${f} – ${t}`;
    }
    return range === 'all' ? 'Alles' : range === '7d' ? 'Letzte 7 Tage' : 'Letzte 30 Tage';
  }, [range, from, to]);

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
              <DateRangePicker
                range={range}
                from={from}
                to={to}
                onPreset={(r) => {
                  setFrom(null);
                  setTo(null);
                  setRange(r);
                }}
                onApply={(next) => {
                  setFrom(next.from);
                  setTo(next.to);
                }}
              />
              <button
                onClick={() => {
                  setObjectNumber('');
                  setDocType('');
                  setVendor('');
                  setEmployee('');
                  setFrom(null);
                  setTo(null);
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
              gridTemplateColumns: 'repeat(4, minmax(0, 1fr))',
              gap: 10
            }}
          >
            <LabeledComboBox label="Gebäude" value={objectNumber} options={objectOptions} onChange={setObjectNumber} placeholder="Gebäude suchen…" />
            <LabeledComboBox label="Dokument-Art" value={docType} options={docTypeOptions} onChange={setDocType} placeholder="Art suchen…" />
            <LabeledComboBox label="Lieferant" value={vendor} options={vendorOptions} onChange={setVendor} placeholder="Lieferant suchen…" />
            <LabeledComboBox label="Mitarbeiter" value={employee} options={employeeOptions} onChange={setEmployee} placeholder="Mitarbeiter suchen…" />
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

function DateRangePicker(props: {
  range: '7d' | '30d' | 'all';
  from: string | null;
  to: string | null;
  onPreset: (r: '7d' | '30d' | 'all') => void;
  onApply: (next: { from: string | null; to: string | null }) => void;
}) {
  const { range, from, to, onPreset, onApply } = props;

  const wrapRef = useRef<HTMLDivElement | null>(null);
  const [open, setOpen] = useState(false);

  const today = useMemo(() => new Date(), []);
  const [view, setView] = useState(() => ({ y: today.getFullYear(), m: today.getMonth() }));
  const [draftStart, setDraftStart] = useState<string | null>(from);
  const [draftEnd, setDraftEnd] = useState<string | null>(to);

  const [hoverIso, setHoverIso] = useState<string | null>(null);

  useEffect(() => {
    setDraftStart(from);
    setDraftEnd(to);
    setHoverIso(null);
  }, [from, to]);

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

  const label = useMemo(() => {
    if (from || to) {
      const f = from ? new Date(from).toLocaleDateString() : '…';
      const t = to ? new Date(to).toLocaleDateString() : '…';
      return `${f} – ${t}`;
    }
    return range === 'all' ? 'Alles' : range === '7d' ? 'Letzte 7 Tage' : 'Letzte 30 Tage';
  }, [range, from, to]);

  const monthLabel = useMemo(() => {
    const d = new Date(Date.UTC(view.y, view.m, 1));
    return d.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });
  }, [view.m, view.y]);

  const days = useMemo(() => buildCalendar(view.y, view.m), [view.y, view.m]);

  const startMs = draftStart ? Date.parse(draftStart) : null;
  const endMs = draftEnd ? Date.parse(draftEnd) : null;

  const previewMs = useMemo(() => {
    if (!draftStart || draftEnd) return null;
    if (!hoverIso) return null;
    const day = hoverIso.slice(0, 10);
    return {
      start: Date.parse(draftStart),
      end: Date.parse(new Date(`${day}T23:59:59.999Z`).toISOString())
    };
  }, [draftEnd, draftStart, hoverIso]);

  const effectiveRange = useMemo(() => {
    if (startMs === null) return null;
    if (endMs !== null) return { start: startMs, end: endMs, preview: false };
    if (previewMs) {
      const s = previewMs.start;
      const e = previewMs.end;
      return s <= e ? { start: s, end: e, preview: true } : { start: e, end: s, preview: true };
    }
    return { start: startMs, end: startMs, preview: true };
  }, [endMs, previewMs, startMs]);

  const isInEffectiveRange = (iso: string) => {
    if (!effectiveRange) return false;
    const t = Date.parse(iso);
    if (!Number.isFinite(t)) return false;
    return t >= effectiveRange.start && t <= effectiveRange.end;
  };

  const isEffectiveEdge = (iso: string) => {
    if (!effectiveRange) return false;
    const t = Date.parse(iso);
    return t === effectiveRange.start || t === effectiveRange.end;
  };

  const presetActive = (key: '7d' | '30d' | 'all') => !from && !to && range === key;

  const applyDraft = () => {
    // if only start selected, treat as single-day range
    if (draftStart && !draftEnd) {
      const day = draftStart.slice(0, 10);
      const endIso = new Date(`${day}T23:59:59.999Z`).toISOString();
      onApply({ from: draftStart, to: endIso });
      return;
    }
    onApply({ from: draftStart, to: draftEnd });
  };

  return (
    <div ref={wrapRef} style={{ position: 'relative' }}>
      <button
        type="button"
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
        <span
          aria-hidden
          style={{
            width: 16,
            height: 16,
            backgroundImage:
              'url("data:image/svg+xml,%3Csvg xmlns=\"http://www.w3.org/2000/svg\" width=\"18\" height=\"18\" viewBox=\"0 0 24 24\" fill=\"none\" stroke=\"%239CA3AF\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\"%3E%3Crect x=\"3\" y=\"4\" width=\"18\" height=\"18\" rx=\"2\" ry=\"2\"/%3E%3Cline x1=\"16\" y1=\"2\" x2=\"16\" y2=\"6\"/%3E%3Cline x1=\"8\" y1=\"2\" x2=\"8\" y2=\"6\"/%3E%3Cline x1=\"3\" y1=\"10\" x2=\"21\" y2=\"10\"/%3E%3C/svg%3E")',
            backgroundSize: '16px 16px',
            backgroundRepeat: 'no-repeat'
          }}
        />
        <span>{label}</span>
      </button>

      {open ? (
        <div
          style={{
            position: 'absolute',
            right: 0,
            top: 'calc(100% + 8px)',
            zIndex: 80,
            width: 520,
            maxWidth: 'calc(100vw - 40px)',
            border: '1px solid var(--border_soft)',
            background: 'var(--bg)',
            borderRadius: 14,
            boxShadow: '0 18px 46px rgba(0,0,0,0.22)',
            overflow: 'hidden'
          }}
        >
          <div style={{ display: 'grid', gridTemplateColumns: '170px 1fr', background: 'var(--bg)' }}>
            <div style={{ padding: 10, borderRight: '1px solid var(--border_soft)', background: 'var(--panel)' }}>
              <div style={{ fontSize: 11, opacity: 0.7, marginBottom: 8 }}>Quick</div>
              <div style={{ display: 'grid', gap: 2 }}>
                {(
                  [
                    { key: '7d' as const, label: 'Letzte 7 Tage' },
                    { key: '30d' as const, label: 'Letzte 30 Tage' },
                    { key: 'all' as const, label: 'Alles' }
                  ]
                ).map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => {
                      onPreset(p.key);
                      setOpen(false);
                    }}
                    style={{
                      padding: '8px 10px',
                      borderRadius: 10,
                      border: '1px solid transparent',
                      background: presetActive(p.key) ? 'rgba(37, 99, 235, 0.12)' : 'var(--panel2)',
                      color: 'inherit',
                      fontSize: 12,
                      cursor: 'pointer',
                      textAlign: 'left',
                      fontWeight: presetActive(p.key) ? 800 : 600
                    }}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <div style={{ marginTop: 10, fontSize: 11, opacity: 0.7, marginBottom: 6 }}>Custom</div>
              <div style={{ display: 'grid', gap: 6 }}>
                <div style={{ display: 'grid', gap: 6 }}>
                  <div style={{ fontSize: 11, opacity: 0.7 }}>Start</div>
                  <input
                    type="date"
                    value={draftStart ? draftStart.slice(0, 10) : ''}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (!v) {
                        setDraftStart(null);
                        setHoverIso(null);
                        return;
                      }
                      setDraftStart(new Date(`${v}T00:00:00.000Z`).toISOString());
                      setDraftEnd(null);
                      setHoverIso(null);
                    }}
                    style={{
                      padding: '8px 8px',
                      borderRadius: 10,
                      border: '1px solid var(--border_soft)',
                      background: 'var(--panel2)',
                      color: 'inherit',
                      fontSize: 12,
                      outline: 'none'
                    }}
                  />
                </div>

                <div style={{ display: 'grid', gap: 6 }}>
                  <div style={{ fontSize: 11, opacity: 0.7 }}>Ende</div>
                  <input
                    type="date"
                    value={draftEnd ? draftEnd.slice(0, 10) : ''}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (!v) {
                        setDraftEnd(null);
                        return;
                      }
                      setDraftEnd(new Date(`${v}T23:59:59.999Z`).toISOString());
                    }}
                    style={{
                      padding: '8px 8px',
                      borderRadius: 10,
                      border: '1px solid var(--border_soft)',
                      background: 'var(--panel2)',
                      color: 'inherit',
                      fontSize: 12,
                      outline: 'none'
                    }}
                  />
                </div>
              </div>
            </div>

            <div style={{ padding: 12, background: 'var(--bg)' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 10 }}>
                <div style={{ fontWeight: 800 }}>{monthLabel}</div>
                <div style={{ display: 'flex', gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date(Date.UTC(view.y, view.m, 1));
                      d.setUTCMonth(d.getUTCMonth() - 1);
                      setView({ y: d.getUTCFullYear(), m: d.getUTCMonth() });
                    }}
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 12,
                      border: '1px solid var(--border_soft)',
                      background: 'var(--panel2)',
                      color: 'inherit',
                      cursor: 'pointer'
                    }}
                  >
                    ‹
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const d = new Date(Date.UTC(view.y, view.m, 1));
                      d.setUTCMonth(d.getUTCMonth() + 1);
                      setView({ y: d.getUTCFullYear(), m: d.getUTCMonth() });
                    }}
                    style={{
                      width: 34,
                      height: 34,
                      borderRadius: 12,
                      border: '1px solid var(--border_soft)',
                      background: 'var(--panel2)',
                      color: 'inherit',
                      cursor: 'pointer'
                    }}
                  >
                    ›
                  </button>
                </div>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6, fontSize: 11, opacity: 0.65, marginBottom: 8 }}>
                {['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'].map((d) => (
                  <div key={d} style={{ textAlign: 'center' }}>
                    {d}
                  </div>
                ))}
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6 }}>
                {days.map((cell, idx) => {
                  if (!cell) return <div key={idx} />;
                  const active = isEffectiveEdge(cell.iso);
                  const inRange = isInEffectiveRange(cell.iso);
                  const muted = !cell.inMonth;

                  const isSelectingEnd = Boolean(draftStart && !draftEnd);
                  const isHoverDay = Boolean(hoverIso && cell.iso.slice(0, 10) === hoverIso.slice(0, 10));

                  const rangeFill = effectiveRange?.preview ? 'rgba(37, 99, 235, 0.10)' : 'rgba(37, 99, 235, 0.12)';
                  const edgeFill = 'rgba(37, 99, 235, 0.22)';
                  const hoverFill = 'rgba(37, 99, 235, 0.10)';

                  const t = Date.parse(cell.iso);
                  const isStart = Boolean(effectiveRange && t === effectiveRange.start);
                  const isEnd = Boolean(effectiveRange && t === effectiveRange.end);
                  const isSingle = Boolean(effectiveRange && effectiveRange.start === effectiveRange.end);

                  // Vercel-like: no default tile, only hover/range/edges are filled.
                  // Use half gradients on edges to visually connect the range.
                  let background: string = 'transparent';
                  let backgroundImage: string | undefined = undefined;
                  let border: string = '1px solid transparent';
                  let radius = 10;

                  if (inRange && effectiveRange) {
                    if (isSingle && (isStart || isEnd)) {
                      background = edgeFill;
                      border = '1px solid rgba(37, 99, 235, 0.55)';
                      radius = 10;
                    } else if (isStart) {
                      border = '1px solid rgba(37, 99, 235, 0.55)';
                      radius = 10;
                      backgroundImage = `linear-gradient(90deg, ${edgeFill} 0%, ${edgeFill} 50%, ${rangeFill} 50%, ${rangeFill} 100%)`;
                    } else if (isEnd) {
                      border = '1px solid rgba(37, 99, 235, 0.55)';
                      radius = 10;
                      backgroundImage = `linear-gradient(90deg, ${rangeFill} 0%, ${rangeFill} 50%, ${edgeFill} 50%, ${edgeFill} 100%)`;
                    } else {
                      // middle range cells as a soft bar
                      background = rangeFill;
                      radius = 4;
                    }
                  } else if (isHoverDay && isSelectingEnd) {
                    background = hoverFill;
                    radius = 10;
                  }

                  // slightly fade out days not in current month
                  const opacity = muted ? 0.45 : 1;

                  return (
                    <button
                      key={cell.iso}
                      type="button"
                      onMouseEnter={() => {
                        if (draftStart && !draftEnd) setHoverIso(cell.iso);
                      }}
                      onMouseLeave={() => {
                        if (draftStart && !draftEnd) setHoverIso(null);
                      }}
                      onClick={() => {
                        const isoStart = new Date(`${cell.iso.slice(0, 10)}T00:00:00.000Z`).toISOString();
                        const isoEnd = new Date(`${cell.iso.slice(0, 10)}T23:59:59.999Z`).toISOString();

                        if (!draftStart || (draftStart && draftEnd)) {
                          setDraftStart(isoStart);
                          setDraftEnd(null);
                          setHoverIso(null);
                          return;
                        }

                        const start = Date.parse(draftStart);
                        const picked = Date.parse(isoStart);
                        if (picked < start) {
                          setDraftEnd(new Date(`${draftStart.slice(0, 10)}T23:59:59.999Z`).toISOString());
                          setDraftStart(isoStart);
                        } else {
                          setDraftEnd(isoEnd);
                        }
                        setHoverIso(null);
                      }}
                      style={{
                        height: 34,
                        borderRadius: radius,
                        border,
                        background,
                        backgroundImage,
                        color: 'inherit',
                        cursor: 'pointer',
                        opacity,
                        fontWeight: active ? 900 : 600
                      }}
                    >
                      {cell.day}
                    </button>
                  );
                })}
              </div>

              <div style={{ marginTop: 12, display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
                <button
                  type="button"
                  onClick={() => {
                    setDraftStart(from);
                    setDraftEnd(to);
                    setHoverIso(null);
                    setOpen(false);
                  }}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 12,
                    border: '1px solid var(--border_soft)',
                    background: 'var(--panel2)',
                    color: 'inherit',
                    cursor: 'pointer',
                    fontSize: 12
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    applyDraft();
                    setOpen(false);
                  }}
                  style={{
                    padding: '8px 10px',
                    borderRadius: 12,
                    border: '1px solid rgba(37, 99, 235, 0.35)',
                    background: 'rgba(37, 99, 235, 0.14)',
                    color: 'inherit',
                    cursor: 'pointer',
                    fontSize: 12
                  }}
                >
                  Apply
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function buildCalendar(year: number, month: number): Array<null | { iso: string; day: number; inMonth: boolean }> {
  // Monday-first calendar grid
  const first = new Date(Date.UTC(year, month, 1));
  const firstDow = (first.getUTCDay() + 6) % 7; // 0=Mon
  const start = new Date(Date.UTC(year, month, 1 - firstDow));

  const out: Array<null | { iso: string; day: number; inMonth: boolean }> = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(start.getTime() + i * 24 * 60 * 60 * 1000);
    const iso = d.toISOString();
    out.push({
      iso,
      day: d.getUTCDate(),
      inMonth: d.getUTCMonth() === month
    });
  }
  return out;
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
