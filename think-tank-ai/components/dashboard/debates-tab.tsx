'use client';

import { useQuery } from '@tanstack/react-query';
import { useDashboardStore } from '@/lib/dashboard-store';
import { formatDistanceToNow } from 'date-fns';
import { cn } from '@/lib/utils';

interface DebateMessage {
  id: string;
  role: string;
  content: string;
  round: number;
  createdAt: string;
}

interface DebateDetail {
  id: string;
  status: string;
  currentRound: number;
  verdict: string | null;
  narrativeContext: string | null;
  createdAt: string;
  messages: DebateMessage[];
  cluster: { assetId: string; assetType: string };
}

interface Cluster {
  id: string;
  assetId: string;
  debates: { id: string; status: string; currentRound: number }[];
  alert: { ticker: string } | null;
}

function parseContent(raw: string): string {
  try {
    const obj = JSON.parse(raw);
    if (typeof obj === 'string') return obj;
    if (obj.content) return obj.content;
    if (obj.argument) return obj.argument;
    return JSON.stringify(obj, null, 2);
  } catch {
    return raw;
  }
}

export function DebatesTab() {
  const { selectedDebateId, setSelectedDebateId } = useDashboardStore();

  const { data: clusters = [] } = useQuery<Cluster[]>({
    queryKey: ['clusters'],
    queryFn: () => fetch('/api/clusters').then((r) => r.json()),
  });

  const debateList = clusters.flatMap((c) =>
    c.debates.map((d) => ({ ...d, ticker: c.alert?.ticker ?? c.assetId })),
  );

  const { data: debate, isLoading: detailLoading } = useQuery<DebateDetail>({
    queryKey: ['debate', selectedDebateId],
    queryFn: () => fetch(`/api/debates/${selectedDebateId}`).then((r) => r.json()),
    enabled: !!selectedDebateId,
  });

  return (
    <div className="flex h-full" style={{ minHeight: '60vh' }}>
      {/* Sidebar */}
      <div className="w-64 border-r border-zinc-800 overflow-y-auto flex-shrink-0">
        <div className="px-4 py-3 border-b border-zinc-800">
          <p className="text-xs font-mono text-zinc-500">Debates ({debateList.length})</p>
        </div>
        {debateList.length === 0 && (
          <p className="p-4 text-xs font-mono text-zinc-600">No debates yet</p>
        )}
        {debateList.map((d) => (
          <button
            key={d.id}
            onClick={() => setSelectedDebateId(d.id)}
            className={cn(
              'w-full text-left px-4 py-3 border-b border-zinc-800/50 hover:bg-zinc-800/50 transition-colors',
              selectedDebateId === d.id && 'bg-zinc-800',
            )}
          >
            <p className="font-mono font-bold text-xs text-zinc-200">{d.ticker}</p>
            <p className="text-[10px] font-mono text-zinc-500 mt-0.5">
              Round {d.currentRound} · {d.status}
            </p>
          </button>
        ))}
      </div>

      {/* Detail */}
      <div className="flex-1 overflow-y-auto">
        {!selectedDebateId && (
          <div className="flex items-center justify-center h-full text-zinc-600 font-mono text-sm">
            Select a debate
          </div>
        )}

        {selectedDebateId && detailLoading && (
          <div className="p-6 text-zinc-500 font-mono text-sm">Loading…</div>
        )}

        {debate && (
          <div className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <span className="font-mono font-bold text-zinc-100">{debate.cluster?.assetId ?? '—'}</span>
              <span className={cn(
                'text-[10px] font-mono px-2 py-0.5 rounded',
                debate.status === 'ESCALATED'
                  ? 'bg-amber-500/20 text-amber-300'
                  : 'bg-zinc-800 text-zinc-400',
              )}>{debate.status}</span>
              {debate.verdict && (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-red-500/20 text-red-300">
                  {debate.verdict}
                </span>
              )}
            </div>

            {debate.narrativeContext && (
              <div className="rounded-lg border border-zinc-800 bg-zinc-900/50 p-4 text-xs text-zinc-400 font-mono leading-relaxed">
                <p className="text-[10px] text-zinc-600 mb-2">NARRATIVE CONTEXT</p>
                {debate.narrativeContext.slice(0, 400)}{debate.narrativeContext.length > 400 ? '…' : ''}
              </div>
            )}

            <div className="space-y-3">
              {debate.messages.map((msg) => (
                <div
                  key={msg.id}
                  className={cn(
                    'rounded-lg p-4 border',
                    msg.role === 'ANALYST'
                      ? 'border-blue-500/20 bg-blue-500/5'
                      : 'border-red-500/20 bg-red-500/5',
                  )}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span
                      className={cn(
                        'text-[10px] font-mono font-bold',
                        msg.role === 'ANALYST' ? 'text-blue-400' : 'text-red-400',
                      )}
                    >
                      {msg.role} · Round {msg.round}
                    </span>
                    <span className="text-[10px] font-mono text-zinc-600">
                      {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                    </span>
                  </div>
                  <p className="text-sm text-zinc-300 leading-relaxed whitespace-pre-wrap">
                    {parseContent(msg.content)}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
