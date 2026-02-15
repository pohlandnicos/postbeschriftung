'use client';

type SwitchProps = {
  value: boolean;
  onChange: (value: boolean) => void;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
};

export function Switch({ value, onChange, leftIcon, rightIcon }: SwitchProps) {
  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      style={{
        padding: 0,
        margin: 0,
        border: 0,
        background: 'none',
        cursor: 'pointer',
        position: 'relative',
        width: 40,
        height: 20,
        display: 'flex',
        alignItems: 'center'
      }}
    >
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          height: 2,
          background: 'var(--border)',
          opacity: 0.5
        }}
      />
      <div
        style={{
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: 'var(--fg)',
          opacity: 0.9,
          transform: `translateX(${value ? '20px' : '0'})`,
          transition: 'transform 0.15s ease'
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--bg)',
            fontSize: 12
          }}
        >
          {value ? rightIcon : leftIcon}
        </div>
      </div>
    </button>
  );
}
