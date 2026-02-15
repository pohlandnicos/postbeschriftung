import './globals.css';
import type { ReactNode } from 'react';
import Sidebar from './components/Sidebar';

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="de" suppressHydrationWarning>
      <body style={{ margin: 0, display: 'flex', minHeight: '100vh' }}>
        <Sidebar />
        <div style={{ flex: 1 }}>{children}</div>
      </body>
    </html>
  );
}
