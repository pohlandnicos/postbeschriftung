'use client';

import { useMemo, type ChangeEvent } from 'react';

type ObjectOption = {
  object_number: string;
  label: string;
};

export function ObjectPicker({
  options,
  value,
  onChange
}: {
  options: ObjectOption[];
  value: string;
  onChange: (v: string) => void;
}) {
  const sorted = useMemo(() => {
    return [...options].sort((a, b) => a.object_number.localeCompare(b.object_number));
  }, [options]);

  return (
    <select
      value={value}
      onChange={(e: ChangeEvent<HTMLSelectElement>) => onChange(e.target.value)}
      style={{
        width: '100%',
        padding: '10px 12px',
        borderRadius: 12,
        border: '1px solid rgba(231, 238, 252, 0.18)',
        background: 'rgba(255,255,255,0.03)',
        color: '#e7eefc'
      }}
    >
      <option value="">Objekt auswählen ...</option>
      {sorted.map((o: ObjectOption) => (
        <option key={o.object_number} value={o.object_number}>
          {o.object_number} - {o.label}
        </option>
      ))}
    </select>
  );
}
