'use client';

import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';

export function Dropzone({
  onFiles
}: {
  onFiles: (files: File[]) => Promise<void>;
}) {
  const [busy, setBusy] = useState(false);

  const onDrop = useCallback(
    async (accepted: File[]) => {
      if (!accepted.length) return;
      setBusy(true);
      try {
        await onFiles(accepted);
      } finally {
        setBusy(false);
      }
    },
    [onFiles]
  );

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    multiple: true,
    accept: { 'application/pdf': ['.pdf'] }
  });

  return (
    <div
      {...getRootProps()}
      style={{
        border: '1px dashed var(--border)',
        borderRadius: 14,
        padding: 24,
        background: 'var(--panel2)',
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
              : 'PDFs per Drag & Drop hochladen (oder klicken)'}
        </div>
        <div style={{ fontSize: 13, opacity: 0.8 }}>
          Nur PDF. Max. Größe hängt von deinem Setup ab.
        </div>
      </div>
    </div>
  );
}
