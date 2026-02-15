'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import * as XLSX from 'xlsx';

type ObjectItem = {
  id?: string;
  object_number: string;
  building_name?: string | null;
  street?: string | null;
  postal_code?: string | null;
  city?: string | null;
  management?: string | null;
  accounting?: string | null;
  aliases?: string[] | null;
};

function parseDelimited(text: string, delimiter: string): string[][] {
  const out: string[][] = [];
  let row: string[] = [];
  let field = '';
  let i = 0;
  let inQuotes = false;

  const pushField = () => {
    row.push(field);
    field = '';
  };

  const pushRow = () => {
    if (row.length === 1 && row[0] === '' && !field) {
      row = [];
      return;
    }
    out.push(row);
    row = [];
  };

  while (i < text.length) {
    const c = text[i];

    if (c === '"') {
      if (inQuotes && text[i + 1] === '"') {
        field += '"';
        i += 2;
        continue;
      }
      inQuotes = !inQuotes;
      i += 1;
      continue;
    }

    if (!inQuotes && c === delimiter) {
      pushField();
      i += 1;
      continue;
    }

    if (!inQuotes && (c === '\n' || c === '\r')) {
      if (c === '\r' && text[i + 1] === '\n') i += 2;
      else i += 1;
      pushField();
      pushRow();
      continue;
    }

    field += c;
    i += 1;
  }

  pushField();
  if (row.length) pushRow();

  return out.map((r) => r.map((x) => x.trim()));
}

function detectDelimiter(text: string): string {
  const firstLine = text.split(/\r?\n/)[0] ?? '';
  const count = (ch: string) => (firstLine.match(new RegExp(`\\${ch}`, 'g')) ?? []).length;
  const commas = count(',');
  const semis = count(';');
  const tabs = (firstLine.match(/\t/g) ?? []).length;
  if (tabs > Math.max(commas, semis)) return '\t';
  if (semis > commas) return ';';
  return ',';
}

function normalizeHeader(h: string) {
  return h
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .replace(/[^a-z0-9 ]/g, '')
    .trim();
}

function splitPostalCity(s: string): { postal_code: string | null; city: string | null } {
  const m = /^\s*(\d{5})\s+(.+?)\s*$/.exec(s);
  if (m) return { postal_code: m[1] ?? null, city: (m[2] ?? '').trim() || null };
  return { postal_code: null, city: s.trim() || null };
}

function parseObjectsFromRows(rows: string[][]): ObjectItem[] {
  const cleanedRows = rows.filter((r) => r.some((c) => c.trim()));
  if (cleanedRows.length < 2) return [];

  const header = cleanedRows[0].map(normalizeHeader);
  const idx = (candidates: string[]) => {
    for (const c of candidates) {
      const i = header.indexOf(normalizeHeader(c));
      if (i >= 0) return i;
    }
    return -1;
  };

  const iObject = idx(['objekt-nr.', 'objekt-nr', 'objektnr', 'objekt_nr', 'object_number']);
  const iStreet = idx(['liegenschaft - strasse', 'liegenschaft - straße', 'strasse', 'straße', 'street']);
  const iPostalCity = idx(['liegenschaft - ort', 'plz ort', 'ort', 'city']);
  const iPostal = idx(['plz', 'postal_code', 'postleitzahl']);
  const iMgmt = idx(['objektverwaltung', 'verwaltung', 'management']);
  const iAcc = idx(['buchhaltung', 'accounting']);

  return cleanedRows.slice(1).map((r) => {
    const object_number = (r[iObject] ?? '').trim();
    const street = iStreet >= 0 ? (r[iStreet] ?? '').trim() : '';

    let postal_code: string | null = null;
    let city: string | null = null;
    if (iPostal >= 0) {
      postal_code = (r[iPostal] ?? '').trim() || null;
    }
    if (iPostalCity >= 0) {
      const pc = (r[iPostalCity] ?? '').trim();
      const split = splitPostalCity(pc);
      postal_code = postal_code ?? split.postal_code;
      city = split.city;
    }

    const management = iMgmt >= 0 ? (r[iMgmt] ?? '').trim() : '';
    const accounting = iAcc >= 0 ? (r[iAcc] ?? '').trim() : '';

    const aliases = [street]
      .map((x) => x.trim())
      .filter(Boolean);

    return {
      object_number,
      street: street || null,
      postal_code,
      city,
      management: management || null,
      accounting: accounting || null,
      aliases
    };
  });
}

function parseObjectsFromCsv(csvText: string): ObjectItem[] {
  const delimiter = detectDelimiter(csvText);
  const rows = parseDelimited(csvText, delimiter);
  return parseObjectsFromRows(rows);
}

async function parseObjectsFromXlsx(file: File): Promise<ObjectItem[]> {
  const buf = await file.arrayBuffer();
  const wb = XLSX.read(buf, { type: 'array' });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) return [];
  const sheet = wb.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false }) as any[];
  const normalized: string[][] = rows
    .map((r) => (Array.isArray(r) ? r.map((c) => String(c ?? '')) : []))
    .filter((r) => r.length);
  return parseObjectsFromRows(normalized);
}

export default function SettingsPage() {
  const [items, setItems] = useState<ObjectItem[]>([]);
  const [csvText, setCsvText] = useState('');
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setBusy('load');
    setError(null);
    try {
      const res = await fetch('/api/objects', { cache: 'no-store' });
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { items: ObjectItem[] };
      setItems(Array.isArray(data.items) ? data.items : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Laden');
    } finally {
      setBusy(null);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const hasChanges = useMemo(() => items.some((it) => !it.object_number.trim()), [items]);

  const upsert = useCallback(async (newItems: ObjectItem[]) => {
    setBusy('save');
    setError(null);
    try {
      const res = await fetch('/api/objects', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: newItems.map((it) => ({
            object_number: it.object_number,
            building_name: it.building_name ?? null,
            street: it.street ?? null,
            postal_code: it.postal_code ?? null,
            city: it.city ?? null,
            management: it.management ?? null,
            accounting: it.accounting ?? null,
            aliases: Array.isArray(it.aliases) ? it.aliases : []
          }))
        })
      });
      if (!res.ok) throw new Error(await res.text());
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Fehler beim Speichern');
    } finally {
      setBusy(null);
    }
  }, [load]);

  const onFile = useCallback(async (file: File) => {
    if (file.name.toLowerCase().endsWith('.xlsx') || file.type.includes('spreadsheetml')) {
      const parsed = await parseObjectsFromXlsx(file);
      setCsvText(JSON.stringify(parsed, null, 2));
      return;
    }
    const text = await file.text();
    setCsvText(text);
  }, []);

  const importPreview = useMemo(() => {
    if (!csvText.trim()) return [] as ObjectItem[];
    try {
      if (csvText.trim().startsWith('[')) {
        const obj = JSON.parse(csvText) as ObjectItem[];
        return (Array.isArray(obj) ? obj : []).filter((x) => x.object_number);
      }
      const parsed = parseObjectsFromCsv(csvText);
      return parsed.filter((x) => x.object_number);
    } catch {
      return [];
    }
  }, [csvText]);

  return (
    <main style={{ maxWidth: 1100, margin: '0 auto', padding: '28px 18px 80px' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 18 }}>
        <div style={{ fontSize: 20, fontWeight: 800 }}>Einstellungen</div>
        <div style={{ fontSize: 13, opacity: 0.75 }}>Objektliste verwalten und importieren.</div>
      </div>

      {error ? (
        <div style={{ marginBottom: 12, padding: 10, borderRadius: 12, border: '1px solid rgba(255,120,120,0.35)', background: 'rgba(255,120,120,0.08)' }}>
          <div style={{ fontSize: 13 }}>{error}</div>
        </div>
      ) : null}

      <div style={{ display: 'grid', gridTemplateColumns: '1fr', gap: 14 }}>
        <div style={{ border: '1px solid var(--border_soft)', borderRadius: 14, background: 'var(--panel)', overflow: 'hidden' }}>
          <div style={{ padding: 12, borderBottom: '1px solid var(--border_soft)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>Objektliste</div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              <button
                type="button"
                onClick={() =>
                  setItems((prev) => [
                    {
                      object_number: '',
                      building_name: null,
                      street: null,
                      city: null,
                      management: null,
                      accounting: null,
                      aliases: []
                    },
                    ...prev
                  ])
                }
                style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid var(--border)', background: 'transparent', color: 'inherit', cursor: 'pointer' }}
              >
                + Zeile
              </button>
              <button
                type="button"
                disabled={busy === 'save'}
                onClick={() => upsert(items.filter((it) => it.object_number.trim()))}
                style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid rgba(37, 99, 235, 0.35)', background: 'rgba(37, 99, 235, 0.14)', color: 'inherit', cursor: 'pointer', opacity: busy === 'save' ? 0.6 : 1 }}
              >
                Speichern
              </button>
            </div>
          </div>

          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: 'var(--panel2)' }}>
                  <th style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid var(--border_soft)', whiteSpace: 'nowrap' }}>Objekt-Nr.</th>
                  <th style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid var(--border_soft)', whiteSpace: 'nowrap' }}>Straße</th>
                  <th style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid var(--border_soft)', whiteSpace: 'nowrap' }}>PLZ</th>
                  <th style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid var(--border_soft)', whiteSpace: 'nowrap' }}>Ort</th>
                  <th style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid var(--border_soft)', whiteSpace: 'nowrap' }}>Verwaltung</th>
                  <th style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid var(--border_soft)', whiteSpace: 'nowrap' }}>Buchhaltung</th>
                  <th style={{ textAlign: 'left', padding: 10, borderBottom: '1px solid var(--border_soft)', whiteSpace: 'nowrap' }}>Aliases (| getrennt)</th>
                  <th style={{ width: 1, padding: 10, borderBottom: '1px solid var(--border_soft)' }} />
                </tr>
              </thead>
              <tbody>
                {items.map((it, idx) => (
                  <tr key={it.id ?? `${it.object_number}-${idx}`} style={{ borderBottom: '1px solid var(--border_soft)' }}>
                    {(
                      [
                        ['object_number', it.object_number ?? ''],
                        ['street', it.street ?? ''],
                        ['postal_code', it.postal_code ?? ''],
                        ['city', it.city ?? ''],
                        ['management', it.management ?? ''],
                        ['accounting', it.accounting ?? ''],
                        ['aliases', Array.isArray(it.aliases) ? it.aliases.join(' | ') : '']
                      ] as const
                    ).map(([k, v]) => (
                      <td key={k} style={{ padding: 8, verticalAlign: 'top' }}>
                        <input
                          value={v}
                          onChange={(e) => {
                            const value = e.target.value;
                            setItems((prev) =>
                              prev.map((p, i) => {
                                if (i !== idx) return p;
                                if (k === 'aliases') {
                                  const aliases = value
                                    .split('|')
                                    .map((x) => x.trim())
                                    .filter(Boolean);
                                  return { ...p, aliases };
                                }
                                return { ...p, [k]: value } as any;
                              })
                            );
                          }}
                          placeholder={k === 'object_number' ? 'z.B. 100' : ''}
                          style={{ width: '100%', padding: '7px 9px', borderRadius: 10, border: '1px solid rgba(231, 238, 252, 0.18)', background: 'transparent', color: 'inherit', outline: 'none' }}
                        />
                      </td>
                    ))}
                    <td style={{ padding: 8, verticalAlign: 'top' }}>
                      <button
                        type="button"
                        onClick={() => setItems((prev) => prev.filter((_, i) => i !== idx))}
                        style={{ width: 34, height: 32, borderRadius: 10, border: '1px solid rgba(255, 120, 120, 0.35)', background: 'rgba(255, 120, 120, 0.08)', color: 'inherit', cursor: 'pointer' }}
                        aria-label="Zeile löschen"
                      >
                        ×
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {busy === 'load' ? <div style={{ padding: 12, fontSize: 13, opacity: 0.75 }}>Lade…</div> : null}
        </div>

        <div style={{ border: '1px solid var(--border_soft)', borderRadius: 14, background: 'var(--panel)', overflow: 'hidden' }}>
          <div style={{ padding: 12, borderBottom: '1px solid var(--border_soft)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 700 }}>Import (CSV)</div>
            <button
              type="button"
              disabled={busy === 'save' || !importPreview.length}
              onClick={() => upsert(importPreview)}
              style={{ padding: '8px 10px', borderRadius: 10, border: '1px solid rgba(34, 197, 94, 0.35)', background: 'rgba(34, 197, 94, 0.14)', color: 'inherit', cursor: 'pointer', opacity: busy === 'save' || !importPreview.length ? 0.6 : 1 }}
            >
              Importieren ({importPreview.length})
            </button>
          </div>

          <div style={{ padding: 12, display: 'grid', gap: 10 }}>
            <div style={{ fontSize: 13, opacity: 0.75 }}>
              Du kannst CSV oder Excel (.xlsx) hochladen. Bei "Liegenschaft - Ort" wird "PLZ Ort" automatisch getrennt.
            </div>

            <input
              type="file"
              accept=".csv,text/csv,.xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void onFile(f);
              }}
            />

            <textarea
              value={csvText}
              onChange={(e) => setCsvText(e.target.value)}
              placeholder="Alternativ: CSV hier rein kopieren"
              style={{ width: '100%', minHeight: 160, padding: 10, borderRadius: 12, border: '1px solid rgba(231, 238, 252, 0.18)', background: 'transparent', color: 'inherit', outline: 'none', resize: 'vertical' }}
            />

            {csvText.trim() && !importPreview.length ? (
              <div style={{ fontSize: 13, opacity: 0.8 }}>
                Keine Zeilen erkannt. Prüfe bitte, ob die Datei die Spalten "Objekt-Nr.", "Liegenschaft - Straße", "Liegenschaft - Ort" enthält.
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </main>
  );
}
