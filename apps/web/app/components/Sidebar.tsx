'use client';

import { usePathname } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { SidebarIcon } from './SidebarIcon';

export type SidebarProps = {
  // add props here if needed
};

const Sidebar = () => {
  const [collapsed, setCollapsed] = useState(false);
  const prevCollapsedRef = useRef<boolean | null>(null);
  const pathname = usePathname();

  const isExpanded = !collapsed;

  useEffect(() => {
    const onPreview = (e: Event) => {
      const ce = e as CustomEvent<{ open?: boolean }>;
      const open = Boolean(ce.detail?.open);

      if (open) {
        if (prevCollapsedRef.current === null) prevCollapsedRef.current = collapsed;
        setCollapsed(true);
        return;
      }

      if (prevCollapsedRef.current !== null) {
        setCollapsed(prevCollapsedRef.current);
        prevCollapsedRef.current = null;
      }
    };

    window.addEventListener('dc:preview', onPreview as EventListener);
    return () => window.removeEventListener('dc:preview', onPreview as EventListener);
  }, [collapsed]);

  return (
    <div
      style={{
        width: isExpanded ? 220 : 56,
        flexShrink: 0,
        borderRight: '1px solid var(--border_soft)',
        background: 'var(--panel)',
        position: 'relative',
        minHeight: '100%'
      }}
    >
      <div style={{ padding: '12px 8px', display: 'flex', flexDirection: 'column', gap: 4 }}>
        <Link
          href="/"
          style={{
            textDecoration: 'none',
            color: 'inherit',
            padding: '8px 12px',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            background: pathname === '/' ? 'var(--panel2)' : 'transparent',
            transition: 'background 0.2s ease',
            fontSize: 14
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
          {isExpanded && <div style={{ fontWeight: 500 }}>Neue Post</div>}
        </Link>

        <Link
          href="/analysis"
          style={{
            textDecoration: 'none',
            color: 'inherit',
            padding: '8px 12px',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            background: pathname === '/analysis' ? 'var(--panel2)' : 'transparent',
            transition: 'background 0.2s ease',
            fontSize: 14
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
          {isExpanded && <div style={{ fontWeight: 500 }}>Analytik</div>}
        </Link>

        <Link
          href="/settings"
          style={{
            textDecoration: 'none',
            color: 'inherit',
            padding: '8px 12px',
            borderRadius: 8,
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            background: pathname === '/settings' ? 'var(--panel2)' : 'transparent',
            transition: 'background 0.2s ease',
            fontSize: 14
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <path
              d="M19.4 15a7.97 7.97 0 0 0 .1-1 7.97 7.97 0 0 0-.1-1l2-1.5-2-3.5-2.4 1a8.4 8.4 0 0 0-1.7-1l-.4-2.6H9.1l-.4 2.6a8.4 8.4 0 0 0-1.7 1l-2.4-1-2 3.5 2 1.5a7.97 7.97 0 0 0-.1 1c0 .34.03.67.1 1l-2 1.5 2 3.5 2.4-1c.53.4 1.1.73 1.7 1l.4 2.6h5.8l.4-2.6c.6-.27 1.17-.6 1.7-1l2.4 1 2-3.5-2-1.5Z"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          {isExpanded && <div style={{ fontWeight: 500 }}>Einstellungen</div>}
        </Link>
      </div>

      <div style={{ position: 'absolute', left: 0, bottom: 0, width: '100%', borderTop: '1px solid var(--border_soft)' }}>
        <div style={{ width: 48, height: 48, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <SidebarIcon onClick={() => setCollapsed(!collapsed)} />
        </div>
      </div>
    </div>
  );
};

export default Sidebar;
