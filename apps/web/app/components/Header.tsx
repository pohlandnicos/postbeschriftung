'use client';

import { ThemeSwitch } from './ThemeSwitch';

export function Header({
  theme,
  onThemeChange
}: {
  theme: 'light' | 'dark';
  onThemeChange: (theme: 'light' | 'dark') => void;
}) {
  return (
    <header
      style={{
        height: 60,
        borderBottom: '1px solid var(--border)',
        background: 'var(--panel)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 16px',
        position: 'sticky',
        top: 0,
        zIndex: 10
      }}
    >
      <div
        style={{
          fontFamily: '"SF Pro Display", -apple-system, BlinkMacSystemFont, sans-serif',
          fontSize: 20,
          fontWeight: 800,
          fontStyle: 'italic',
          background: 'linear-gradient(90deg, var(--fg) 0%, var(--fg) 50%, var(--border) 100%)',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          letterSpacing: '-0.02em'
        }}
      >
        DocuCloud
      </div>

      <ThemeSwitch value={theme} onChange={onThemeChange} />
    </header>
  );
}
