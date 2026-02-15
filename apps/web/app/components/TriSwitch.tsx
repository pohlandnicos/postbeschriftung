'use client';

type TriSwitchValue = 'left' | 'center' | 'right';

type TriSwitchProps = {
  value: TriSwitchValue;
  onChange: (value: TriSwitchValue) => void;
  leftIcon?: React.ReactNode;
  centerIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
};

export function TriSwitch({ value, onChange, leftIcon, centerIcon, rightIcon }: TriSwitchProps) {
  return (
    <div
      style={{
        position: 'relative',
        width: 60,
        height: 20,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between'
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
      <button
        type="button"
        onClick={() => onChange('left')}
        style={{
          padding: 0,
          margin: 0,
          border: 0,
          background: 'none',
          cursor: 'pointer',
          width: 20,
          height: 20,
          borderRadius: '50%',
          opacity: value === 'left' ? 0.9 : 0.4,
          transition: 'opacity 0.15s ease',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--fg)',
          fontSize: 12
        }}
      >
        {leftIcon}
      </button>

      <button
        type="button"
        onClick={() => onChange('center')}
        style={{
          padding: 0,
          margin: 0,
          border: 0,
          background: 'none',
          cursor: 'pointer',
          width: 20,
          height: 20,
          borderRadius: '50%',
          opacity: value === 'center' ? 0.9 : 0.4,
          transition: 'opacity 0.15s ease',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--fg)',
          fontSize: 12
        }}
      >
        {centerIcon}
      </button>

      <button
        type="button"
        onClick={() => onChange('right')}
        style={{
          padding: 0,
          margin: 0,
          border: 0,
          background: 'none',
          cursor: 'pointer',
          width: 20,
          height: 20,
          borderRadius: '50%',
          opacity: value === 'right' ? 0.9 : 0.4,
          transition: 'opacity 0.15s ease',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'var(--fg)',
          fontSize: 12
        }}
      >
        {rightIcon}
      </button>

      <div
        style={{
          position: 'absolute',
          width: 20,
          height: 20,
          borderRadius: '50%',
          background: 'var(--fg)',
          opacity: 0.15,
          transform: `translateX(${value === 'left' ? '0' : value === 'center' ? '20px' : '40px'})`,
          transition: 'transform 0.15s ease'
        }}
      />
    </div>
  );
}
