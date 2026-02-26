'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { Activity, BarChart3, Crosshair, BookOpen, Zap, Calculator, Settings, LogOut } from 'lucide-react';
import { cn } from '@/utils/cn';
import { createSupabaseBrowserClient } from '@/lib/supabase/client';

const NAV_ITEMS = [
  { href: '/', label: 'Dashboard', icon: BarChart3 },
  { href: '/premarket', label: 'Pre-Market', icon: Crosshair },
  { href: '/journal', label: 'Journal', icon: BookOpen },
  { href: '/edge', label: 'Edge', icon: Zap },
  { href: '/calculator', label: 'Calculator', icon: Calculator },
  { href: '/settings', label: 'Settings', icon: Settings },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname() ?? '/';
  const router = useRouter();
  const supabase = createSupabaseBrowserClient();

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    router.push('/login');
    router.refresh();
  };

  // Login page renders without the shell
  if (pathname === '/login') {
    return <>{children}</>;
  }

  return (
    <div className="min-h-screen text-stone-900 font-sans antialiased selection:bg-stone-900 selection:text-white bg-[#fafaf9]">
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-stone-200 bg-white/80 backdrop-blur-xl">
        <div className="page-width mx-auto px-5 sm:px-8 lg:px-10 h-16 sm:h-20 flex items-center justify-between">
          <div className="flex items-center gap-10">
            <Link
              href="/"
              className="flex items-center gap-3 rounded-lg focus-visible:ring-2 focus-visible:ring-stone-400 focus-visible:ring-offset-2 transition-transform active:scale-95"
            >
              <div className="w-10 h-10 rounded-xl bg-stone-900 flex items-center justify-center shadow-lg shadow-stone-200">
                <Activity className="w-5 h-5 text-white" strokeWidth={2.5} />
              </div>
              <span className="text-lg font-bold tracking-tight text-stone-900">TradePulse</span>
            </Link>

            <nav className="hidden md:flex items-center gap-1 p-1 rounded-2xl bg-stone-100/50 border border-stone-200/50" role="tablist">
              {NAV_ITEMS.map((item) => {
                const isActive = item.href === '/'
                  ? pathname === '/'
                  : pathname.startsWith(item.href);
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    role="tab"
                    aria-selected={isActive}
                    className={cn(
                      'text-sm font-semibold px-4 py-2.5 rounded-xl transition-all duration-300 flex items-center gap-2',
                      isActive
                        ? 'bg-white text-stone-900 shadow-sm border border-stone-200'
                        : 'text-stone-500 hover:text-stone-800'
                    )}
                  >
                    <item.icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                );
              })}
            </nav>
          </div>

          <button
            onClick={handleSignOut}
            className="text-sm font-semibold text-stone-400 hover:text-stone-700 transition-colors flex items-center gap-1.5 px-3 py-2 rounded-xl"
            title="Sign out"
          >
            <LogOut className="w-4 h-4" />
            <span className="hidden sm:inline">Sign out</span>
          </button>
        </div>
      </header>

      <main className="page-width mx-auto px-5 sm:px-8 lg:px-10 py-10 sm:py-14">
        {children}
      </main>

      {/* Mobile nav */}
      <div className="md:hidden fixed bottom-6 left-1/2 -translate-x-1/2 z-50">
        <nav className="flex items-center gap-1 p-1.5 rounded-2xl bg-stone-900/90 backdrop-blur-md shadow-2xl border border-stone-800" role="tablist">
          {NAV_ITEMS.slice(0, 4).map((item) => {
            const isActive = item.href === '/'
              ? pathname === '/'
              : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  'text-xs font-bold px-4 py-3 rounded-xl transition-all flex items-center gap-1.5',
                  isActive ? 'bg-white text-stone-900' : 'text-stone-400'
                )}
              >
                <item.icon className="w-3.5 h-3.5" />
                {item.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
