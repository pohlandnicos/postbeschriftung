'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';

export type SidebarProps = {
  // add props here if needed
};

const Sidebar = () => {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  return (
    <div
      style={{
        width: collapsed ? 56 : 220,
        flexShrink: 0,
        borderRight: '1px solid var(--border_soft)',
        background: 'var(--panel)',
        display: 'flex',
        flexDirection: 'column',
        transition: 'width 0.2s ease'
      }}
    >
      <div style={{ padding: '14px 12px', display: 'flex', alignItems: 'center', gap: 12 }}>
        {!collapsed && <div style={{ fontSize: 15, fontWeight: 800 }}>Postbeschriftung</div>}
        <button
          type="button"
          onClick={() => setCollapsed(!collapsed)}
          style={{
            marginLeft: collapsed ? 0 : 'auto',
            padding: '8px 10px',
            borderRadius: 8,
            border: '1px solid var(--border_soft)',
            background: 'var(--panel2)',
            color: 'inherit',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center'
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d={collapsed ? 'M13 19l6-6-6-6M5 19l6-6-6-6' : 'M11 19l-6-6 6-6M19 19l-6-6 6-6'}
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
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
          {!collapsed && <div>Neue Post</div>}
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
          {!collapsed && <div>Analyse</div>}
        </Link>
      </div>
    </div>
  );
};

export default Sidebar;
