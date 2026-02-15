'use client';

export function ChatGPTButton({
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
        padding: '6px 12px',
        background: 'var(--panel2)',
        border: '1px solid var(--border)',
        borderRadius: 6,
        color: 'inherit',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        fontSize: 13,
        minWidth: 100,
        justifyContent: 'space-between'
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.borderColor = 'var(--fg)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.borderColor = 'var(--border)';
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path
            d={collapsed ? 'M9 20l6-8-6-8' : 'M15 4l-6 8 6 8'}
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
        {collapsed ? 'Sidebar öffnen' : 'Sidebar schließen'}
      </div>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M6 9l6 6 6-6"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </button>
  );
}
