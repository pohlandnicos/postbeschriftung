'use client';

type ModernSwitchProps = {
  value: boolean;
  onChange: (value: boolean) => void;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  label?: string;
};

export function ModernSwitch({ value, onChange, leftIcon, rightIcon, label }: ModernSwitchProps) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: 3,
        background: value ? 'var(--fg)' : 'var(--panel2)',
        border: '1px solid var(--border)',
        borderRadius: 999,
        color: 'inherit',
        cursor: 'pointer',
        transition: 'background 0.2s ease'
      }}
    >
      <div
        style={{
          width: 22,
          height: 22,
          borderRadius: '50%',
          background: value ? 'var(--bg)' : 'var(--panel)',
          border: '1px solid var(--border)',
          transform: `translateX(${value ? '24px' : '0'})`,
          transition: 'transform 0.2s ease',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: value ? 'var(--bg)' : 'var(--fg)',
          position: 'relative',
          zIndex: 1
        }}
      >
        {value ? rightIcon : leftIcon}
      </div>
      <div
        style={{
          position: 'absolute',
          left: 3,
          width: 50,
          display: 'flex',
          justifyContent: 'space-between',
          padding: '0 6px',
          pointerEvents: 'none',
          color: value ? 'var(--bg)' : 'var(--fg)',
          opacity: 0.7
        }}
      >
        <div style={{ opacity: value ? 0.5 : 1 }}>{leftIcon}</div>
        <div style={{ opacity: value ? 1 : 0.5 }}>{rightIcon}</div>
      </div>
      {label && (
        <div style={{ fontSize: 13, marginLeft: 4, color: 'var(--fg)' }}>
          {label}
        </div>
      )}
    </button>
  );
}
