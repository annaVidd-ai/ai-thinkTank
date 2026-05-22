'use client';

import { useQuery } from '@tanstack/react-query';

interface DashboardStats {
  stats: { totalTasks: number; processingTasks: number; completedTasks: number; failedTasks: number; totalClusters: number; totalAlerts: number };
}

export function Footer() {
  const { data } = useQuery<DashboardStats>({
    queryKey: ['dashboard'],
    queryFn: () => fetch('/api/dashboard').then((r) => r.json()),
  });

  const stats = data?.stats;

  return (
    <footer className="border-t border-zinc-800 px-6 py-2 flex items-center gap-6 text-xs font-mono text-zinc-500">
      <span>
        agents active:{' '}
        <span className="text-emerald-400">{stats?.processingTasks ?? 0}</span>
      </span>
      <span>
        tasks total:{' '}
        <span className="text-zinc-300">{stats?.totalTasks ?? 0}</span>
      </span>
      <span>
        clusters:{' '}
        <span className="text-zinc-300">{stats?.totalClusters ?? 0}</span>
      </span>
      <span>
        alerts:{' '}
        <span className="text-amber-400">{stats?.totalAlerts ?? 0}</span>
      </span>
      <span className="ml-auto text-zinc-700">auto-refresh 10s</span>
    </footer>
  );
}
