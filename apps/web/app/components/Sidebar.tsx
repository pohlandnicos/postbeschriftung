'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useState, useEffect } from 'react';
import { ModernSwitch } from './ModernSwitch';

export type SidebarProps = {
  // add props here if needed
};

const Sidebar = () => {
  const [collapsed, setCollapsed] = useState(false);
  const [hovered, setHovered] = useState(false);
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const pathname = usePathname();

  const mode = collapsed ? (hovered ? 'center' : 'right') : 'left';
  const isExpanded = !collapsed || hovered;

  useEffect(() => {
    const saved = window.localStorage.getItem('theme');
    const t = (saved === 'light' || saved === 'dark' ? saved : window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') as 'light' | 'dark';
    setTheme(t);
    document.documentElement.setAttribute('data-theme', t);
  }, []);

  const toggleTheme = () => {
    const next: 'light' | 'dark' = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    window.localStorage.setItem('theme', next);
    document.documentElement.setAttribute('data-theme', next);
  };

  return (
    <div
      style={{
        width: isExpanded ? 220 : 56,
        flexShrink: 0,
        borderRight: '1px solid var(--border_soft)',
        background: 'var(--panel)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.2s ease'
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{ padding: '14px 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
        {isExpanded && <div style={{ fontSize: 15, fontWeight: 800 }}>Postbeschriftung</div>}
      </div>

      <div style={{ padding: '4px 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <Link
          href="/"
          style={{
            textDecoration: 'none',
            color: 'inherit',
            padding: '10px 12px',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            background: pathname === '/' ? 'var(--panel2)' : undefined,
            border: `1px solid ${pathname === '/' ? 'var(--border)' : 'transparent'}`
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M11 14h2v7h-2v-7zm-6-3h2v10H5V11zm12 5h2v5h-2v-5zM4 3h16l2 4H2z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {isExpanded && <div>Neue Post</div>}
        </Link>

        <Link
          href="/analysis"
          style={{
            textDecoration: 'none',
            color: 'inherit',
            padding: '10px 12px',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            background: pathname === '/analysis' ? 'var(--panel2)' : undefined,
            border: `1px solid ${pathname === '/analysis' ? 'var(--border)' : 'transparent'}`
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M3 3v16h18M7 11l4-4 4 4 4-4"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {isExpanded && <div>Analyse</div>}
        </Link>

        <div style={{ marginTop: 'auto', padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 12, opacity: isExpanded ? 1 : 0.85, transition: 'opacity 0.2s ease' }}>
          <ModernSwitch
            value={theme === 'dark'}
            onChange={() => toggleTheme()}
            leftIcon={
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="4" fill="currentColor" />
                <path d="M12 5V3M12 21v-2M5 12H3M21 12h-2M7 7L5.5 5.5M19 19l-1.5-1.5M7 17l-1.5 1.5M19 5l-1.5 1.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
              </svg>
            }
            rightIcon={
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M12 3a7.5 7.5 0 0 0 9 9 9 9 0 1 1-9-9z" fill="currentColor" />
              </svg>
            }
            label={isExpanded ? (theme === 'dark' ? 'Dunkel' : 'Hell') : undefined}
          />

          <ModernSwitch
            value={collapsed}
            onChange={(v) => {
              setCollapsed(v);
              if (!v) setHovered(false);
            }}
            leftIcon={
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M15 4l-6 8 6 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            }
            rightIcon={
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path d="M9 20l6-8-6-8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            }
            label={isExpanded ? 'Sidebar' : undefined}
          />
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
