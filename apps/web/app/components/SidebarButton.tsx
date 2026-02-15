'use client';

export function SidebarButton({
  collapsed,
  onClick
}: {
  collapsed: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
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
        <path
          d={collapsed ? 'M9 20l6-8-6-8' : 'M15 4l-6 8 6 8'}
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      {collapsed ? 'Öffnen' : 'Schließen'}
    </button>
  );
}
