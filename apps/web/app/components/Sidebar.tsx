'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useState } from 'react';
import { SidebarIcon } from './SidebarIcon';

export type SidebarProps = {
  // add props here if needed
};

const Sidebar = () => {
  const [collapsed, setCollapsed] = useState(false);
  const pathname = usePathname();

  const isExpanded = !collapsed;

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
    >
      <div style={{ flex: 1, padding: '8px', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
          <Link
            href="/"
            style={{
              textDecoration: 'none',
              color: 'inherit',
              padding: '6px 10px',
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              background: pathname === '/' ? 'var(--panel2)' : 'transparent',
              transition: 'background 0.2s ease',
              fontSize: 13
            }}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M3 7v10a4 4 0 0 0 4 4h10a4 4 0 0 0 4-4V7a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4z"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M3 7h18"
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
              padding: '6px 10px',
              borderRadius: 6,
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              background: pathname === '/analysis' ? 'var(--panel2)' : 'transparent',
              transition: 'background 0.2s ease',
              fontSize: 13
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
        </div>

        <div style={{ marginTop: 'auto', display: 'flex', justifyContent: 'center' }}>
          <SidebarIcon onClick={() => setCollapsed(!collapsed)} />
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
