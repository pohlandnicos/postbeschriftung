'use client';

import './globals.css';
import { useState, useEffect } from 'react';
import type { ReactNode } from 'react';
import Sidebar from './components/Sidebar';
import { Header } from './components/Header';

export default function RootLayout({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');

  useEffect(() => {
    const saved = window.localStorage.getItem('theme');
    const t = (saved === 'light' || saved === 'dark' ? saved : window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') as 'light' | 'dark';
    setTheme(t);
    document.documentElement.setAttribute('data-theme', t);
  }, []);

  const toggleTheme = (value: 'light' | 'dark') => {
    setTheme(value);
    window.localStorage.setItem('theme', value);
    document.documentElement.setAttribute('data-theme', value);
  };

  return (
    <html lang="de" suppressHydrationWarning>
      <body style={{ margin: 0, display: 'flex', flexDirection: 'column', minHeight: '100vh' }}>
        <Header theme={theme} onThemeChange={toggleTheme} />
        <div style={{ flex: 1, display: 'flex' }}>
          <Sidebar />
          <div style={{ flex: 1 }}>{children}</div>
        </div>
      </body>
    </html>
  );
}
