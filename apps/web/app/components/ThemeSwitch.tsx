'use client';

export function ThemeSwitch({
  value,
  onChange
}: {
  value: 'light' | 'dark';
  onChange: (value: 'light' | 'dark') => void;
}) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        background: 'var(--panel2)',
        border: '1px solid var(--border)',
        borderRadius: 999,
        padding: 2,
        width: 56,
        height: 26
      }}
    >
      <button
        type="button"
        onClick={() => onChange('light')}
        style={{
          padding: 0,
          background: value === 'light' ? 'var(--fg)' : 'transparent',
          border: 'none',
          borderRadius: 999,
          color: value === 'light' ? 'var(--bg)' : 'inherit',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 26,
          height: 22,
          transition: 'all 0.15s ease'
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="4" fill="currentColor" />
          <path
            d="M12 5V3M12 21v-2M5 12H3M21 12h-2M7 7L5.5 5.5M19 19l-1.5-1.5M7 17l-1.5 1.5M19 5l-1.5 1.5"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
      </button>

      <button
        type="button"
        onClick={() => onChange('dark')}
        style={{
          padding: 0,
          background: value === 'dark' ? 'var(--fg)' : 'transparent',
          border: 'none',
          borderRadius: 999,
          color: value === 'dark' ? 'var(--bg)' : 'inherit',
          cursor: 'pointer',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 26,
          height: 22,
          transition: 'all 0.15s ease'
        }}
      >
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d="M12 3a7.5 7.5 0 0 0 9 9 9 9 0 1 1-9-9z"
            fill="currentColor"
          />
        </svg>
      </button>
    </div>
  );
}
