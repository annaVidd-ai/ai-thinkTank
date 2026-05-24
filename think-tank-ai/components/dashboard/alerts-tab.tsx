'use client';

import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { useDashboardStore } from '@/lib/dashboard-store';
import { cn } from '@/lib/utils';
import { Bell, BellOff } from 'lucide-react';

interface Alert {
  id: string;
  ticker: string;
  totalScore: number;
  thesis: string;
  createdAt: string;
  cluster: { assetId: string; assetType: string; status: string };
}

export function AlertsTab() {
  const { readAlertIds, markAlertRead } = useDashboardStore();

  const { data: alerts = [], isLoading } = useQuery<Alert[]>({
    queryKey: ['alerts'],
    queryFn: () => fetch('/api/alerts').then((r) => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); }),
  });

  if (isLoading) {
    return <div className="p-6 text-zinc-500 font-mono text-sm">Loading…</div>;
  }

  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-mono text-zinc-500">
          {alerts.length} alert{alerts.length !== 1 ? 's' : ''} ·{' '}
          {alerts.filter((a) => !readAlertIds.includes(a.id)).length} unread
        </p>
      </div>

      {alerts.length === 0 && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-10 text-center">
          <BellOff className="w-8 h-8 text-zinc-700 mx-auto mb-3" />
          <p className="text-zinc-600 font-mono text-sm">No alerts yet</p>
        </div>
      )}

      {alerts.map((alert) => {
        const isRead = readAlertIds.includes(alert.id);
        return (
          <div
            key={alert.id}
            className={cn(
              'rounded-xl border p-5 cursor-pointer transition-all',
              isRead
                ? 'border-zinc-800 bg-zinc-900/50 opacity-60'
                : 'border-amber-500/30 bg-amber-500/5 shadow-amber-500/10 shadow-lg',
            )}
            onClick={() => markAlertRead(alert.id)}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <Bell className={cn('w-4 h-4 mt-0.5', isRead ? 'text-zinc-600' : 'text-amber-400')} />
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-zinc-100">{alert.ticker}</span>
                    <span className="text-[10px] font-mono px-1.5 py-0.5 rounded bg-zinc-800 text-zinc-400">
                      {alert.cluster.assetType}
                    </span>
                    {!isRead && (
                      <span className="w-2 h-2 rounded-full bg-amber-400" />
                    )}
                  </div>
                  <p className="text-xs text-zinc-500 font-mono mt-0.5">
                    {formatDistanceToNow(new Date(alert.createdAt), { addSuffix: true })}
                  </p>
                </div>
              </div>
              <span
                className={cn(
                  'font-mono font-bold text-lg',
                  alert.totalScore >= 0.85 ? 'text-emerald-400' :
                  alert.totalScore >= 0.70 ? 'text-amber-400' : 'text-zinc-400',
                )}
              >
                {(alert.totalScore * 100).toFixed(0)}
              </span>
            </div>

            <p className="mt-3 text-sm text-zinc-300 leading-relaxed line-clamp-3">{alert.thesis}</p>

            <p className="mt-2 text-[10px] font-mono text-zinc-600">
              click to mark as read · {alert.cluster.status}
            </p>
          </div>
        );
      })}
    </div>
  );
}
