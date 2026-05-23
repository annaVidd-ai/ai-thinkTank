'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useEffect } from 'react';
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from 'recharts';
import { Save } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ScoringConfig {
  id: string;
  name: string;
  weights: string; // JSON string
  alertThreshold: number;
  isActive: boolean;
}

const WEIGHT_KEYS = ['signalStrength', 'timing', 'upside'] as const;
const COLORS = ['#60a5fa', '#34d399', '#f59e0b'];

function parseWeights(raw: string): Record<string, number> {
  try { return JSON.parse(raw); } catch { return {}; }
}

export function ConfigTab() {
  const qc = useQueryClient();

  const { data: configs = [], isLoading } = useQuery<ScoringConfig[]>({
    queryKey: ['scoring-config'],
    queryFn: () => fetch('/api/scoring-config').then((r) => r.json()),
  });

  const active = configs.find((c) => c.isActive) ?? configs[0];

  const [weights, setWeights] = useState<Record<string, number>>({});
  const [threshold, setThreshold] = useState(0.7);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (active) {
      setWeights(parseWeights(active.weights));
      setThreshold(active.alertThreshold);
    }
  }, [active]);

  const mutation = useMutation({
    mutationFn: (payload: { id: string; weights: Record<string, number>; alertThreshold: number }) =>
      fetch('/api/scoring-config', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      }).then((r) => r.json()),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['scoring-config'] });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    },
  });

  const weightSum = Object.values(weights).reduce((s, w) => s + w, 0);
  const sumOk     = Math.abs(weightSum - 1.0) <= 0.01;

  const pieData = WEIGHT_KEYS.map((k, i) => ({
    name:  k,
    value: +(( weights[k] ?? 0) * 100).toFixed(1),
    color: COLORS[i],
  }));

  if (isLoading) {
    return <div className="p-6 text-zinc-500 font-mono text-sm">Loading…</div>;
  }

  if (!active) {
    return (
      <div className="p-6 text-zinc-600 font-mono text-sm">
        No scoring configuration found. Run the worker to initialise one.
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="font-mono font-bold text-zinc-100">{active.name}</p>
          <p className="text-xs font-mono text-zinc-500 mt-0.5">Active scoring configuration</p>
        </div>
        <button
          disabled={!sumOk || mutation.isPending}
          onClick={() => mutation.mutate({ id: active.id, weights, alertThreshold: threshold })}
          className={cn(
            'flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-mono font-bold transition-all',
            sumOk && !mutation.isPending
              ? saved
                ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                : 'bg-blue-500/20 text-blue-300 border border-blue-500/30 hover:bg-blue-500/30'
              : 'bg-zinc-800 text-zinc-600 border border-zinc-700 cursor-not-allowed',
          )}
        >
          <Save className="w-3 h-3" />
          {saved ? 'Saved!' : mutation.isPending ? 'Saving…' : 'Save'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Weight sliders */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5 space-y-5">
          <p className="text-xs font-mono text-zinc-500">Score Weights</p>

          {WEIGHT_KEYS.map((key, i) => (
            <div key={key}>
              <div className="flex justify-between text-xs font-mono mb-1">
                <span style={{ color: COLORS[i] }}>{key}</span>
                <span className="text-zinc-300">{((weights[key] ?? 0) * 100).toFixed(0)}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                step={1}
                value={Math.round((weights[key] ?? 0) * 100)}
                onChange={(e) =>
                  setWeights((prev) => ({ ...prev, [key]: +e.target.value / 100 }))
                }
                className="w-full accent-blue-400"
              />
            </div>
          ))}

          <div className={cn(
            'text-xs font-mono mt-2',
            sumOk ? 'text-emerald-400' : 'text-red-400',
          )}>
            Sum: {(weightSum * 100).toFixed(0)}% {sumOk ? '✓' : '— must equal 100%'}
          </div>
        </div>

        {/* Pie chart */}
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
          <p className="text-xs font-mono text-zinc-500 mb-2">Distribution</p>
          <ResponsiveContainer width="100%" height={200}>
            <PieChart>
              <Pie
                data={pieData}
                cx="50%"
                cy="50%"
                innerRadius={55}
                outerRadius={85}
                paddingAngle={3}
                dataKey="value"
              >
                {pieData.map((entry, i) => (
                  <Cell key={i} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip
                contentStyle={{ background: '#18181b', border: '1px solid #3f3f46', fontSize: 11, fontFamily: 'monospace' }}
                formatter={(v) => [`${v}%`]}
              />
            </PieChart>
          </ResponsiveContainer>
          <div className="flex gap-4 justify-center mt-1">
            {pieData.map((d) => (
              <div key={d.name} className="flex items-center gap-1 text-[10px] font-mono text-zinc-400">
                <span className="w-2 h-2 rounded-full" style={{ background: d.color }} />
                {d.name}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Alert threshold */}
      <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-5">
        <p className="text-xs font-mono text-zinc-500 mb-3">Alert Threshold</p>
        <div className="flex items-center gap-4">
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={Math.round(threshold * 100)}
            onChange={(e) => setThreshold(+e.target.value / 100)}
            className="flex-1 accent-amber-400"
          />
          <span className="font-mono font-bold text-amber-400 text-sm w-12 text-right">
            {(threshold * 100).toFixed(0)}%
          </span>
        </div>
        <p className="text-[10px] font-mono text-zinc-600 mt-2">
          Clusters scoring below this threshold will not generate alerts.
        </p>
      </div>

      {/* All configs table */}
      {configs.length > 1 && (
        <div className="rounded-xl border border-zinc-800 bg-zinc-900 overflow-hidden">
          <div className="px-4 py-3 border-b border-zinc-800">
            <p className="text-xs font-mono text-zinc-400">All Configurations</p>
          </div>
          <table className="w-full text-xs font-mono">
            <thead>
              <tr className="border-b border-zinc-800 text-zinc-500">
                <th className="text-left px-4 py-2">Name</th>
                <th className="text-left px-4 py-2">Active</th>
                <th className="text-left px-4 py-2">Threshold</th>
              </tr>
            </thead>
            <tbody>
              {configs.map((c) => (
                <tr key={c.id} className="border-b border-zinc-800/50">
                  <td className="px-4 py-2 text-zinc-300">{c.name}</td>
                  <td className="px-4 py-2">
                    {c.isActive ? <span className="text-emerald-400">✓</span> : <span className="text-zinc-700">—</span>}
                  </td>
                  <td className="px-4 py-2 text-zinc-400">{(c.alertThreshold * 100).toFixed(0)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
