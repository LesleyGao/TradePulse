import type { Metadata } from 'next';
import { AppShell } from '@/components/layout/AppShell';
import './globals.css';

// All pages require auth — skip static generation at build time
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'TradePulse — QQQ Options Trading Dashboard',
  description: 'Pre-market analysis, trade journaling, and edge refinement for QQQ 0DTE options',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
