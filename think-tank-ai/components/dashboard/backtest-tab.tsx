'use client';

import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts';
import { cn } from '@/lib/utils';

interface BacktestSummary {
  id: string;
  ticker: string;
  projectAlias: string;
  sector: string;
  split: string;
  isControl: boolean;
  signalDate: string;
  actualMultiple: number;
  blindedRuns: number;
  unblindedRuns: number;
  blindedMedian: number | null;
  unblindedMedian: number | null;
  biasRatio: number | null;
  pooledStdDev: number | null;
}

function biasLabel(ratio: number | null): string {
  if (ratio === null) return 'N/A';
  if (ratio >= 99.0) return '∞';
  return ratio.toFixed(2);
}

function scoreColor(score: number | null): string {
  if (score === null) return 'text-zinc-600';
  if (score >= 0.75) return 'text-emerald-400';
  if (score >= 0.55) return 'text-amber-400';
  return 'text-red-400';
}

export function BacktestTab() {
  const { data: cases = [], isLoading } = useQuery<BacktestSummary[]>({
    queryKey: ['backtest'],
    queryFn: () => fetch('/api/backtest').then((r) => r.json()),
  });

  if (isLoading) {
    return <div className="p-6 text-zinc-500 font-mono text-sm">Loading…</div>;
  }

  const withRuns = cases.filter((c) => c.blindedRuns > 0 || c.unblindedRuns > 0);
  const chartData = withRuns.map((c) => ({
    name:       c.projectAlias.replace('Project_', ''),
    blinded:    c.blindedMedian   ? +(c.blindedMedian * 100).toFixed(1)   : 0,
    unblinded:  c.unblindedMedian ? +(c.unblindedMedian * 100).toFixed(1) : 0,
    isControl:  c.isControl,
  }));

  return (
    <div className="p-6 space-y-6">
      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Cases',   value: cases.length },
          { label: 'With Runs',     value: withRuns.length },
          { label: 'Controls',      value: cases.filter((c) => c.isControl).length },
          { label: 'Positives',     value: cases.filter((c) => !c.isControl).length },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-xs font-mono text-zinc-500 mb-1">{s.label}</p>
            <p className="text-2xl font-bold font-mono text-zinc-100">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-xs font-mono text-zinc-500 mb-4">Blinded vs Unblinded Scores (median × 100)</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} barCategoryGap="25%">
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#71717a', fontFamily: 'monospace' }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#71717a', fontFamily: 'monospace' }} />
              <Tooltip
                contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', fontSize: 11, fontFamily: 'monospace' }}
                labelStyle={{ color: '#d4d4d8' }}
              />
              <Bar dataKey="blinded" name="Blinded" radius={[3, 3, 0, 0]}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.isControl ? '#f87171' : '#60a5fa'} />
                ))}
              </Bar>
              <Bar dataKey="unblinded" name="Unblinded" radius={[3, 3, 0, 0]}>
                {chartData.map((entry, i) => (
                  <Cell key={i} fill={entry.isControl ? '#fca5a5' : '#93c5fd'} opacity={0.6} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          <div className="flex gap-4 mt-2 text-[10px] font-mono text-zinc-500">
            <span><span className="inline-block w-2 h-2 rounded-full bg-blue-400 mr-1" />Blinded (positive)</span>
            <span><span className="inline-block w-2 h-2 rounded-full bg-red-400 mr-1" />Blinded (control)</span>
            <span><span className="inline-block w-2 h-2 rounded-full bg-blue-300 mr-1 opacity-60" />Unblinded</span>
          </div>
        </div>
      )}

      {/* Results table */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-800">
          <p className="text-xs font-mono text-zinc-400">All Cases</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-500">
                <th className="text-left px-4 py-2">Alias</th>
                <th className="text-left px-4 py-2">Split</th>
                <th className="text-left px-4 py-2">Ctrl</th>
                <th className="text-left px-4 py-2">Actual×</th>
                <th className="text-left px-4 py-2">B Runs</th>
                <th className="text-left px-4 py-2">B Median</th>
                <th className="text-left px-4 py-2">U Median</th>
                <th className="text-left px-4 py-2">Bias</th>
                <th className="text-left px-4 py-2">StdDev</th>
              </tr>
            </thead>
            <tbody>
              {cases.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-6 text-center text-zinc-600">No backtest cases yet</td>
                </tr>
              )}
              {cases.map((c) => (
                <tr key={c.id} className={cn(
                  'border-b border-zinc-800/50 hover:bg-zinc-800/30',
                  c.isControl && 'opacity-70',
                )}>
                  <td className="px-4 py-2 text-zinc-300">{c.projectAlias.replace('Project_', '')}</td>
                  <td className="px-4 py-2 text-zinc-500">{c.split}</td>
                  <td className="px-4 py-2">{c.isControl ? <span className="text-red-400">✓</span> : <span className="text-zinc-700">—</span>}</td>
                  <td className="px-4 py-2 text-zinc-300">{c.actualMultiple.toFixed(1)}×</td>
                  <td className="px-4 py-2 text-zinc-400">{c.blindedRuns}</td>
                  <td className={cn('px-4 py-2', scoreColor(c.blindedMedian))}>
                    {c.blindedMedian !== null ? (c.blindedMedian * 100).toFixed(1) : '—'}
                  </td>
                  <td className={cn('px-4 py-2', scoreColor(c.unblindedMedian))}>
                    {c.unblindedMedian !== null ? (c.unblindedMedian * 100).toFixed(1) : '—'}
                  </td>
                  <td className="px-4 py-2 text-zinc-400">{biasLabel(c.biasRatio)}</td>
                  <td className="px-4 py-2 text-zinc-500">
                    {c.pooledStdDev !== null ? c.pooledStdDev.toFixed(3) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
