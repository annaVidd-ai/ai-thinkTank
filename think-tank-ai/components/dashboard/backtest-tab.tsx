'use client';

import { useQuery } from '@tanstack/react-query';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts';
import { cn } from '@/lib/utils';
import { AlertTriangle, CheckCircle2 } from 'lucide-react';

interface BacktestSummary {
  id:             string;
  ticker:         string;
  projectAlias:   string;
  sector:         string;
  split:          string;
  isControl:      boolean;
  signalDate:     string;
  actualMultiple: number;
  blindedRuns:    number;
  unblindedRuns:  number;
  blindedMedian:  number | null;
  unblindedMedian: number | null;
  biasRatio:      number | null;
  pooledStdDev:   number | null;
}

function biasLabel(ratio: number | null): string {
  if (ratio === null) return '—';
  if (ratio >= 99.0)  return '∞';
  return ratio.toFixed(2);
}

function scoreColor(score: number | null): string {
  if (score === null)  return 'text-zinc-600';
  if (score >= 0.75)   return 'text-emerald-400';
  if (score >= 0.55)   return 'text-amber-400';
  return 'text-red-400';
}

function avg(nums: number[]): number | null {
  if (!nums.length) return null;
  return nums.reduce((s, n) => s + n, 0) / nums.length;
}

export function BacktestTab() {
  const { data: cases = [], isLoading } = useQuery<BacktestSummary[]>({
    queryKey:        ['backtest'],
    queryFn:         () => fetch('/api/backtest').then((r) => { if (!r.ok) throw new Error(`${r.status}`); return r.json(); }),
    staleTime:       10_000,
    refetchInterval: 10_000,
  });

  if (isLoading) {
    return <div className="p-6 text-zinc-500 font-mono text-sm">Loading…</div>;
  }

  const withRuns = cases.filter((c) => c.blindedRuns > 0 || c.unblindedRuns > 0);

  // Discrimination stats (only cases that have blinded runs)
  const withBlinded  = cases.filter((c) => c.blindedMedian !== null);
  const winners      = withBlinded.filter((c) => !c.isControl);
  const controls     = withBlinded.filter((c) => c.isControl);
  const winnersAvg   = avg(winners.map((c)  => c.blindedMedian!));
  const controlsAvg  = avg(controls.map((c) => c.blindedMedian!));
  const delta        = winnersAvg !== null && controlsAvg !== null ? winnersAvg - controlsAvg : null;

  // Overall bias: avg ratio excluding ∞ sentinel
  const ratios       = withBlinded.map((c) => c.biasRatio).filter((r): r is number => r !== null && r < 99);
  const avgBiasRatio = avg(ratios);

  // Chart data
  const chartData = withRuns.map((c) => ({
    name:      c.projectAlias.replace('Project_', ''),
    blinded:   c.blindedMedian   ? +(c.blindedMedian   * 100).toFixed(1) : 0,
    unblinded: c.unblindedMedian ? +(c.unblindedMedian * 100).toFixed(1) : 0,
    isControl: c.isControl,
  }));

  const discriminationOk = delta !== null && delta >= 0.10;

  return (
    <div className="p-6 space-y-6">

      {/* Top stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: 'Total Cases',  value: cases.length },
          { label: 'Ran',          value: withRuns.length },
          { label: 'Avg Bias',     value: avgBiasRatio !== null ? avgBiasRatio.toFixed(3) : '—' },
          { label: 'Bias Alerts',  value: withBlinded.filter((c) => c.biasRatio !== null && c.biasRatio >= 99).length },
        ].map((s) => (
          <div key={s.label} className="rounded-xl border border-zinc-800 bg-zinc-900 p-4">
            <p className="text-xs font-mono text-zinc-500 mb-1">{s.label}</p>
            <p className="text-2xl font-bold font-mono text-zinc-100">{s.value}</p>
          </div>
        ))}
      </div>

      {/* Discrimination panel */}
      {delta !== null && (
        <div className={cn(
          'rounded-xl border p-5 flex flex-col md:flex-row gap-6 items-start md:items-center',
          discriminationOk ? 'border-emerald-800 bg-emerald-950/30' : 'border-amber-700 bg-amber-950/20',
        )}>
          <div className="flex items-center gap-2 shrink-0">
            {discriminationOk
              ? <CheckCircle2 className="w-5 h-5 text-emerald-400" />
              : <AlertTriangle className="w-5 h-5 text-amber-400" />}
            <span className={cn('text-sm font-mono font-semibold', discriminationOk ? 'text-emerald-400' : 'text-amber-400')}>
              {discriminationOk ? 'Discrimination OK' : 'Discrimination Warning'}
            </span>
          </div>
          <div className="flex gap-8 font-mono text-sm">
            <div>
              <p className="text-zinc-500 text-xs mb-0.5">Controls avg</p>
              <p className="text-red-400 font-bold">{(controlsAvg! * 100).toFixed(1)}</p>
            </div>
            <div>
              <p className="text-zinc-500 text-xs mb-0.5">Winners avg</p>
              <p className="text-emerald-400 font-bold">{(winnersAvg! * 100).toFixed(1)}</p>
            </div>
            <div>
              <p className="text-zinc-500 text-xs mb-0.5">Δ (target ≥ 10)</p>
              <p className={cn('font-bold', discriminationOk ? 'text-emerald-400' : 'text-amber-400')}>
                +{(delta * 100).toFixed(1)}
              </p>
            </div>
          </div>
          {!discriminationOk && (
            <p className="text-xs text-amber-600 font-mono md:ml-auto">
              Winners and controls score too similarly — signal may not be reliable
            </p>
          )}
        </div>
      )}

      {/* Chart */}
      {chartData.length > 0 && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-xs font-mono text-zinc-500 mb-4">Blinded vs Unblinded Scores (×100)</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} barCategoryGap="25%">
              <XAxis dataKey="name" tick={{ fontSize: 10, fill: '#71717a', fontFamily: 'monospace' }} />
              <YAxis domain={[0, 100]} tick={{ fontSize: 10, fill: '#71717a', fontFamily: 'monospace' }} />
              <ReferenceLine y={70} stroke="#52525b" strokeDasharray="4 2" label={{ value: 'threshold', position: 'right', fontSize: 9, fill: '#52525b' }} />
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
            <span><span className="inline-block w-2 h-2 rounded-full bg-blue-400 mr-1" />Blinded (winner)</span>
            <span><span className="inline-block w-2 h-2 rounded-full bg-red-400 mr-1" />Blinded (control)</span>
            <span><span className="inline-block w-2 h-2 rounded-full bg-blue-300 mr-1 opacity-60" />Unblinded</span>
          </div>
        </div>
      )}

      {/* Detailed table */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
        <div className="px-4 py-3 border-b border-zinc-800">
          <p className="text-xs font-mono text-zinc-400">All Cases</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-500">
                <th className="text-left px-4 py-2">Ticker</th>
                <th className="text-left px-4 py-2">Alias</th>
                <th className="text-left px-4 py-2">Split</th>
                <th className="text-left px-4 py-2">Type</th>
                <th className="text-right px-4 py-2">Actual×</th>
                <th className="text-right px-4 py-2">Blinded</th>
                <th className="text-right px-4 py-2">Unblinded</th>
                <th className="text-right px-4 py-2">Bias</th>
                <th className="text-right px-4 py-2">Runs</th>
              </tr>
            </thead>
            <tbody>
              {cases.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-6 text-center text-zinc-600">No backtest cases yet</td>
                </tr>
              )}
              {cases.map((c) => (
                <tr key={c.id} className="border-b border-zinc-800/50 hover:bg-zinc-800/30">
                  <td className="px-4 py-2 text-zinc-200 font-semibold">{c.ticker}</td>
                  <td className="px-4 py-2 text-zinc-500">{c.projectAlias.replace('Project_', '')}</td>
                  <td className="px-4 py-2 text-zinc-500 capitalize">{c.split}</td>
                  <td className="px-4 py-2">
                    {c.isControl
                      ? <span className="text-red-400 bg-red-950/40 px-1.5 py-0.5 rounded">ctrl</span>
                      : <span className="text-emerald-400 bg-emerald-950/40 px-1.5 py-0.5 rounded">pos</span>}
                  </td>
                  <td className="px-4 py-2 text-right text-zinc-300">{c.actualMultiple.toFixed(1)}×</td>
                  <td className={cn('px-4 py-2 text-right font-semibold', scoreColor(c.blindedMedian))}>
                    {c.blindedMedian !== null ? (c.blindedMedian * 100).toFixed(1) : '—'}
                  </td>
                  <td className={cn('px-4 py-2 text-right', scoreColor(c.unblindedMedian))}>
                    {c.unblindedMedian !== null ? (c.unblindedMedian * 100).toFixed(1) : '—'}
                  </td>
                  <td className="px-4 py-2 text-right text-zinc-400">{biasLabel(c.biasRatio)}</td>
                  <td className="px-4 py-2 text-right text-zinc-500">
                    {c.blindedRuns > 0 || c.unblindedRuns > 0
                      ? `${c.blindedRuns}b/${c.unblindedRuns}u`
                      : '—'}
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
