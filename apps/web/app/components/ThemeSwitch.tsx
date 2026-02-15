'use client';

export function ThemeSwitch({
  value,
  onChange
}: {
  value: 'light' | 'dark';
  onChange: (value: 'light' | 'dark') => void;
}) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      <button
        type="button"
        onClick={() => onChange(value === 'dark' ? 'light' : 'dark')}
        style={{
          display: 'flex',
          alignItems: 'center',
          padding: 2,
          width: 64,
          height: 28,
          borderRadius: 999,
          border: '1px solid var(--border)',
          background: 'var(--panel2)',
          position: 'relative',
          cursor: 'pointer',
          boxShadow: 'inset 0 1px 1px rgba(0,0,0,0.05)',
          transition: 'border-color 0.2s ease'
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: value === 'dark' ? 34 : 2,
            top: 2,
            width: 24,
            height: 24,
            borderRadius: 999,
            background: 'var(--fg)',
            opacity: 0.9,
            transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
            boxShadow: '0 1px 2px rgba(0,0,0,0.1)',
            transform: `scale(${value === value ? 0.9 : 1})`
          }}
        />
        <div
          style={{
            position: 'relative',
            width: 30,
            height: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: value === 'light' ? 1 : 0.5,
            transition: 'opacity 0.2s ease'
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M12 16a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM12 5V3M12 21v-2M5 12H3M21 12h-2M7 7L5.5 5.5M19 19l-1.5-1.5M7 17l-1.5 1.5M19 5l-1.5 1.5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </svg>
        </div>
        <div
          style={{
            position: 'relative',
            width: 30,
            height: 24,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            opacity: value === 'dark' ? 1 : 0.5,
            transition: 'opacity 0.2s ease'
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M12 3a7.5 7.5 0 0 0 9 9 9 9 0 1 1-9-9z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </div>
      </button>
    </div>
  );
}
