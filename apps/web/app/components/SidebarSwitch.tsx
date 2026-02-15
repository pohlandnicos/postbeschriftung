'use client';

export type SidebarMode = 'expanded' | 'hover' | 'collapsed';

export function SidebarSwitch({
  value,
  onChange
}: {
  value: SidebarMode;
  onChange: (value: SidebarMode) => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: 2,
          height: 28,
          borderRadius: 999,
          border: '1px solid var(--border)',
          background: 'var(--panel2)'
        }}
      >
        <button
          type="button"
          onClick={() => onChange('expanded')}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            height: 24,
            borderRadius: 999,
            background: value === 'expanded' ? 'var(--fg)' : 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: value === 'expanded' ? 'var(--bg)' : 'inherit',
            opacity: value === 'expanded' ? 1 : 0.5,
            transition: 'all 0.2s ease'
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M15 4l-6 8 6 8"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>

        <button
          type="button"
          onClick={() => onChange('hover')}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            height: 24,
            borderRadius: 999,
            background: value === 'hover' ? 'var(--fg)' : 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: value === 'hover' ? 'var(--bg)' : 'inherit',
            opacity: value === 'hover' ? 1 : 0.5,
            transition: 'all 0.2s ease'
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="3" stroke="currentColor" strokeWidth="2" />
          </svg>
        </button>

        <button
          type="button"
          onClick={() => onChange('collapsed')}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 28,
            height: 24,
            borderRadius: 999,
            background: value === 'collapsed' ? 'var(--fg)' : 'transparent',
            border: 'none',
            cursor: 'pointer',
            color: value === 'collapsed' ? 'var(--bg)' : 'inherit',
            opacity: value === 'collapsed' ? 1 : 0.5,
            transition: 'all 0.2s ease'
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M9 20l6-8-6-8"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
