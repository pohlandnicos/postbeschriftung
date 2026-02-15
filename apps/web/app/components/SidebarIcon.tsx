'use client';

export function SidebarIcon({
  onClick
}: {
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: 0,
        background: 'none',
        border: 'none',
        color: 'inherit',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 32,
        height: 32,
        opacity: 0.7,
        transition: 'opacity 0.2s ease'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.opacity = '1';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.opacity = '0.7';
      }}
    >
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M10 4H22C24.2091 4 26 5.79086 26 8V24C26 26.2091 24.2091 28 22 28H10C7.79086 28 6 26.2091 6 24V8C6 5.79086 7.79086 4 10 4Z"
          stroke="currentColor"
          strokeWidth="1.5"
        />
        <line x1="12" y1="4" x2="12" y2="28" stroke="currentColor" strokeWidth="1.5" />
      </svg>
    </button>
  );
}
