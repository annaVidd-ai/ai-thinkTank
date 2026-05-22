'use client';

import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface Task {
  id: string;
  type: string;
  status: string;
  createdAt: string;
  updatedAt: string;
}

interface DashboardData {
  stats: {
    totalTasks: number;
    processingTasks: number;
    completedTasks: number;
    failedTasks: number;
    totalClusters: number;
    totalAlerts: number;
  };
  recentTasks: Task[];
}

const STATUS_COLORS: Record<string, string> = {
  PENDING:    'bg-zinc-700 text-zinc-300',
  PROCESSING: 'bg-blue-500/20 text-blue-300 animate-pulse',
  COMPLETED:  'bg-emerald-500/20 text-emerald-300',
  FAILED:     'bg-red-500/20 text-red-300',
};

const PIPELINE_PHASES = [
  { label: 'SCOUT', desc: 'Harvest on-chain data' },
  { label: 'NARRATIVE', desc: 'Summarise narrative' },
  { label: 'DEBATE', desc: 'Bull/Bear analysis' },
  { label: 'SCORE', desc: 'Quant scoring' },
  { label: 'MAP', desc: 'Alert gating' },
];

export function PipelineTab() {
  const { data, isLoading } = useQuery<DashboardData>({
    queryKey: ['dashboard'],
    queryFn: () => fetch('/api/dashboard').then((r) => r.json()),
  });

  if (isLoading) {
    return <div className="p-6 text-zinc-500 font-mono text-sm">Loading…</div>;
  }

  const stats = data?.stats;
  const tasks = data?.recentTasks ?? [];

  return (
    <div className="p-6 space-y-6">
      {/* Stat cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Tasks',      value: stats?.totalTasks,      color: 'text-zinc-100' },
          { label: 'Processing',       value: stats?.processingTasks, color: 'text-blue-400' },
          { label: 'Completed',        value: stats?.completedTasks,  color: 'text-emerald-400' },
          { label: 'Failed',           value: stats?.failedTasks,     color: 'text-red-400' },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-xs font-mono text-zinc-500 mb-1">{s.label}</p>
            <p className={cn('text-2xl font-bold font-mono', s.color)}>{s.value ?? 0}</p>
          </div>
        ))}
      </div>

      {/* Pipeline phases */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
        <p className="text-xs font-mono text-zinc-500 mb-3">Pipeline Phases</p>
        <div className="flex items-center gap-0">
          {PIPELINE_PHASES.map((phase, i) => (
            <div key={phase.label} className="flex items-center flex-1">
              <div className="flex-1 rounded-lg bg-zinc-800 p-3 text-center">
                <p className="text-xs font-mono font-bold text-zinc-200">{phase.label}</p>
                <p className="text-[10px] text-zinc-500 mt-0.5">{phase.desc}</p>
              </div>
              {i < PIPELINE_PHASES.length - 1 && (
                <div className="w-6 flex items-center justify-center">
                  <div className="w-full h-px bg-zinc-700" />
                  <span className="text-zinc-600 text-xs absolute">›</span>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Recent tasks */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-800">
          <p className="text-xs font-mono text-zinc-400">Recent Tasks</p>
        </div>
        <table className="w-full text-xs font-mono">
          <thead>
            <tr className="border-b border-zinc-800 text-zinc-500">
              <th className="text-left px-4 py-2">Type</th>
              <th className="text-left px-4 py-2">Status</th>
              <th className="text-left px-4 py-2">Created</th>
              <th className="text-left px-4 py-2">Updated</th>
            </tr>
          </thead>
          <tbody>
            {tasks.length === 0 && (
              <tr>
                <td colSpan={4} className="px-4 py-6 text-center text-zinc-600">
                  No tasks yet
                </td>
              </tr>
            )}
            {tasks.map((t) => (
              <tr key={t.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                <td className="px-4 py-2 text-zinc-300">{t.type}</td>
                <td className="px-4 py-2">
                  <span className={cn('px-2 py-0.5 rounded text-[10px] font-bold', STATUS_COLORS[t.status] ?? 'bg-zinc-700 text-zinc-300')}>
                    {t.status}
                  </span>
                </td>
                <td className="px-4 py-2 text-zinc-500">
                  {formatDistanceToNow(new Date(t.createdAt), { addSuffix: true })}
                </td>
                <td className="px-4 py-2 text-zinc-500">
                  {formatDistanceToNow(new Date(t.updatedAt), { addSuffix: true })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
