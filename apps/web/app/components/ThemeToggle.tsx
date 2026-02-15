'use client';

export function ThemeToggle({
  value,
  onChange
}: {
  value: 'light' | 'dark';
  onChange: (value: 'light' | 'dark') => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(value === 'dark' ? 'light' : 'dark')}
      style={{
        padding: '6px 8px',
        background: 'none',
        border: '1px solid var(--border)',
        borderRadius: 6,
        color: 'inherit',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 13,
        opacity: 0.8,
        transition: 'opacity 0.2s ease, border-color 0.2s ease'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.opacity = '1';
        e.currentTarget.style.borderColor = 'var(--fg)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.opacity = '0.8';
        e.currentTarget.style.borderColor = 'var(--border)';
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        {value === 'dark' ? (
          <path
            d="M12 3a7.5 7.5 0 0 0 9 9 9 9 0 1 1-9-9z"
            fill="currentColor"
          />
        ) : (
          <>
            <circle cx="12" cy="12" r="4" fill="currentColor" />
            <path
              d="M12 5V3M12 21v-2M5 12H3M21 12h-2M7 7L5.5 5.5M19 19l-1.5-1.5M7 17l-1.5 1.5M19 5l-1.5 1.5"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            />
          </>
        )}
      </svg>
      {value === 'dark' ? 'Hell' : 'Dunkel'}
    </button>
  );
}
