'use client';

import { useState } from 'react';

export type ToggleButtonProps = {
  value: boolean;
  onChange: (value: boolean) => void;
  leftIcon: React.ReactNode;
  rightIcon: React.ReactNode;
  label?: string;
  threeState?: boolean;
  onHover?: (hover: boolean) => void;
};

export function ToggleButton({
  value,
  onChange,
  leftIcon,
  rightIcon,
  label,
  threeState,
  onHover
}: ToggleButtonProps) {
  const [hover, setHover] = useState(false);

  const handleHover = (h: boolean) => {
    setHover(h);
    onHover?.(h);
  };

  return (
    <button
      type="button"
      onClick={() => onChange(!value)}
      onMouseEnter={() => handleHover(true)}
      onMouseLeave={() => handleHover(false)}
      style={{
        padding: '10px 12px',
        borderRadius: 8,
        border: '1px solid var(--border_soft)',
        background: 'var(--panel2)',
        color: 'inherit',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        width: '100%',
        position: 'relative'
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          position: 'relative',
          padding: 2,
          borderRadius: 999,
          border: '1px solid var(--border)',
          background: 'var(--panel)',
          width: 48,
          height: 24
        }}
      >
        <div
          style={{
            position: 'absolute',
            left: 2,
            top: 2,
            width: 20,
            height: 20,
            borderRadius: 999,
            background: 'var(--fg)',
            opacity: value ? 0.15 : 0.85,
            transform: `translateX(${value ? '24px' : '0'})`,
            transition: 'transform 0.2s ease, opacity 0.2s ease'
          }}
        />
        <div style={{ width: 20, height: 20, opacity: value ? 0.4 : 1, transition: 'opacity 0.2s ease' }}>
          {leftIcon}
        </div>
        <div style={{ width: 20, height: 20, opacity: value ? 1 : 0.4, transition: 'opacity 0.2s ease' }}>
          {rightIcon}
        </div>
      </div>
      {label && <div>{label}</div>}
      {threeState && (
        <div
          style={{
            position: 'absolute',
            right: 12,
            top: '50%',
            transform: 'translateY(-50%)',
            opacity: hover ? 1 : 0.4,
            transition: 'opacity 0.2s ease'
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M12 8l-6 8h12l-6-8z"
              fill="currentColor"
              style={{
                transform: hover ? 'rotate(180deg)' : 'rotate(0deg)',
                transition: 'transform 0.2s ease',
                transformOrigin: 'center'
              }}
            />
          </svg>
        </div>
      )}
    </button>
  );
}
