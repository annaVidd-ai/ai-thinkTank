'use client';

import { useTheme } from 'next-themes';
import { Moon, Sun, Bell } from 'lucide-react';
import { useDashboardStore } from '@/lib/dashboard-store';
import { useQuery } from '@tanstack/react-query';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';

export function Header() {
  const { theme, setTheme } = useTheme();
  const { readAlertIds, setActiveTab } = useDashboardStore();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { data: alerts = [] } = useQuery<{ id: string }[]>({
    queryKey: ['alerts'],
    queryFn: () => fetch('/api/alerts').then((r) => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); }),
  });

  const unreadCount = alerts.filter((a) => !readAlertIds.includes(a.id)).length;

  return (
    <header className="sticky top-0 z-50 flex items-center justify-between px-6 py-3 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
      <div className="flex items-center gap-3">
        <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
        <span className="font-mono font-bold text-sm tracking-widest text-zinc-100 uppercase">
          Node Zero
        </span>
        <span className="text-zinc-600 text-xs font-mono">/ monitoring</span>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => setActiveTab('alerts')}
          className={cn(
            'relative p-2 rounded-lg transition-colors',
            unreadCount > 0
              ? 'text-amber-400 hover:bg-amber-400/10'
              : 'text-zinc-500 hover:bg-zinc-800',
          )}
        >
          <Bell className="w-4 h-4" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 w-4 h-4 text-[10px] font-bold rounded-full bg-amber-400 text-zinc-950 flex items-center justify-center">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        <button
          onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')}
          className="p-2 rounded-lg text-zinc-500 hover:bg-zinc-800 hover:text-zinc-100 transition-colors"
        >
          {mounted && (theme === 'dark' ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />)}
        </button>
      </div>
    </header>
  );
}
