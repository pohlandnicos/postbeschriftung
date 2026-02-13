'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';

export function Dropzone({
  onFile
}: {
  onFile: (file: File) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);

  const onDrop = useCallback(
    async (accepted: File[]) => {
      const file = accepted[0];
      if (!file) return;
      setBusy(true);
      try {
        await onFile(file);
      } finally {
        setBusy(false);
      }
    },
    [onFile]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: false,
    accept: { 'application/pdf': ['.pdf'] }
  });

  return (
    <div
      {...getRootProps()}
      style={{
        border: '1px dashed rgba(231, 238, 252, 0.35)',
        borderRadius: 14,
        padding: 24,
        background: 'rgba(255,255,255,0.03)',
        cursor: busy ? 'not-allowed' : 'pointer',
        opacity: busy ? 0.6 : 1
      }}
    >
      <input {...getInputProps()} disabled={busy} />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ fontSize: 16, fontWeight: 600 }}>
          {busy
            ? 'Verarbeitung läuft ...'
            : isDragActive
              ? 'PDF hier loslassen'
              : 'PDF per Drag & Drop hochladen (oder klicken)'}
        </div>
        <div style={{ fontSize: 13, opacity: 0.8 }}>
          Nur PDF. Max. Größe hängt von deinem Setup ab.
        </div>
      </div>
    </div>
  );
}
