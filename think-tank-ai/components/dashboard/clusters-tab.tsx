'use client';

import { useQuery } from '@tanstack/react-query';
import { formatDistanceToNow } from 'date-fns';
import { useDashboardStore } from '@/lib/dashboard-store';
import { cn } from '@/lib/utils';

interface Cluster {
  id: string;
  assetId: string;
  assetType: string;
  status: string;
  createdAt: string;
  scores: { totalScore: number; createdAt: string }[];
  alert: { ticker: string; totalScore: number } | null;
  debates: { id: string; status: string; currentRound: number; verdict: string | null }[];
}

const STATUS_COLORS: Record<string, string> = {
  DETECTED:          'bg-zinc-700 text-zinc-300',
  NARRATIVE_SCOUTING:'bg-blue-500/20 text-blue-300',
  DEBATING:          'bg-violet-500/20 text-violet-300',
  SCORED:            'bg-emerald-500/20 text-emerald-300',
};

export function ClustersTab() {
  const { setActiveTab, setSelectedDebateId } = useDashboardStore();

  const { data: clusters = [], isLoading } = useQuery<Cluster[]>({
    queryKey: ['clusters'],
    queryFn: () => fetch('/api/clusters').then((r) => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); }),
  });

  if (isLoading) {
    return <div className="p-6 text-zinc-500 font-mono text-sm">Loading…</div>;
  }

  return (
    <div className="p-6 space-y-4">
      <p className="text-xs font-mono text-zinc-500">{clusters.length} clusters</p>

      {clusters.length === 0 && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-10 text-center">
          <p className="text-zinc-600 font-mono text-sm">No clusters detected yet</p>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {clusters.map((c) => {
          const score = c.scores[0]?.totalScore;
          const debate = c.debates[0];

          return (
            <div
              key={c.id}
              className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-3"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-mono font-bold text-sm text-zinc-100 truncate max-w-[200px]">
                    {c.alert?.ticker ?? c.assetId}
                  </p>
                  <p className="text-[10px] font-mono text-zinc-500 mt-0.5">{c.assetType}</p>
                </div>
                <span className={cn('text-[10px] font-mono px-2 py-1 rounded', STATUS_COLORS[c.status] ?? 'bg-zinc-700 text-zinc-300')}>
                  {c.status}
                </span>
              </div>

              {score !== undefined && (
                <div>
                  <div className="flex justify-between text-[10px] font-mono text-zinc-500 mb-1">
                    <span>Score</span>
                    <span className={cn(
                      'font-bold',
                      score >= 0.85 ? 'text-emerald-400' :
                      score >= 0.70 ? 'text-amber-400' : 'text-red-400',
                    )}>
                      {(score * 100).toFixed(1)}
                    </span>
                  </div>
                  <div className="w-full h-1.5 rounded-full bg-zinc-800">
                    <div
                      className={cn(
                        'h-full rounded-full transition-all',
                        score >= 0.85 ? 'bg-emerald-400' :
                        score >= 0.70 ? 'bg-amber-400' : 'bg-red-400',
                      )}
                      style={{ width: `${score * 100}%` }}
                    />
                  </div>
                </div>
              )}

              {debate && (
                <button
                  onClick={() => { setSelectedDebateId(debate.id); setActiveTab('debates'); }}
                  className="text-[10px] font-mono text-violet-400 hover:text-violet-300 transition-colors"
                >
                  Debate round {debate.currentRound} · {debate.status} →
                </button>
              )}

              <p className="text-[10px] font-mono text-zinc-600">
                {formatDistanceToNow(new Date(c.createdAt), { addSuffix: true })}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
