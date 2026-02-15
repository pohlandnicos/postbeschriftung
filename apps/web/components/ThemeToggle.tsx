'use client';

import { useEffect, useState } from 'react';

type Theme = 'light' | 'dark';

function getSystemTheme(): Theme {
  if (typeof window === 'undefined') return 'dark';
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function applyTheme(t: Theme) {
  document.documentElement.setAttribute('data-theme', t);
}

export function ThemeToggle() {
  const [theme, setTheme] = useState<Theme>('dark');

  useEffect(() => {
    const saved = window.localStorage.getItem('theme');
    const t = (saved === 'light' || saved === 'dark' ? saved : getSystemTheme()) as Theme;
    setTheme(t);
    applyTheme(t);
  }, []);

  const toggle = () => {
    const next: Theme = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    window.localStorage.setItem('theme', next);
    applyTheme(next);
  };

  return (
    <button
      type="button"
      onClick={toggle}
      style={{
        padding: '8px 10px',
        borderRadius: 10,
        border: '1px solid var(--border)',
        background: 'transparent',
        color: 'inherit',
        cursor: 'pointer',
        fontSize: 12
      }}
    >
      {theme === 'dark' ? 'Hell' : 'Dunkel'}
    </button>
  );
}
