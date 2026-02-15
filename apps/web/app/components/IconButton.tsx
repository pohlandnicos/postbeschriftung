'use client';

export type IconButtonProps = {
  icon: React.ReactNode;
  label?: string;
  active?: boolean;
  onClick: () => void;
};

export function IconButton({ icon, label, active, onClick }: IconButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '8px',
        background: active ? 'var(--panel2)' : 'transparent',
        border: 'none',
        borderRadius: 6,
        color: 'inherit',
        cursor: 'pointer',
        opacity: active ? 1 : 0.75,
        transition: 'opacity 0.15s ease, background 0.15s ease'
      }}
    >
      {icon}
      {label && <div style={{ fontSize: 13 }}>{label}</div>}
    </button>
  );
}
