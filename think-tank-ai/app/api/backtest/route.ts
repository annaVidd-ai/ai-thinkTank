import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  const cases = await db.backtestCase.findMany({
    orderBy: { signalDate: 'asc' },
    include: {
      results: {
        orderBy: { createdAt: 'desc' },
      },
    },
  });

  const summary = cases.map((c) => {
    const blinded   = c.results.filter((r) => r.runType === 'blinded');
    const unblinded = c.results.filter((r) => r.runType === 'unblinded');

    const median = (arr: number[]) => {
      if (!arr.length) return null;
      const s = [...arr].sort((a, b) => a - b);
      const m = Math.floor(s.length / 2);
      return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
    };

    const blindedMedian   = median(blinded.map((r) => r.totalScore));
    const unblindedMedian = median(unblinded.map((r) => r.totalScore));

    let biasRatio: number | null = null;
    if (blindedMedian !== null && unblindedMedian !== null) {
      if (blindedMedian > 0) biasRatio = unblindedMedian / blindedMedian;
      else if (unblindedMedian > 0) biasRatio = 99.0; // ∞ sentinel
      else biasRatio = 0;
    }

    const pooledStdDev = (() => {
      const vals = c.results.map((r) => r.stdDev ?? 0).filter((v) => v > 0);
      if (!vals.length) return null;
      const meanSq = vals.reduce((s, σ) => s + σ * σ, 0) / vals.length;
      return Math.sqrt(meanSq);
    })();

    return {
      id:             c.id,
      ticker:         c.ticker,
      projectAlias:   c.projectAlias,
      sector:         c.sector,
      split:          c.split,
      isControl:      c.isControl,
      signalDate:     c.signalDate,
      actualMultiple: c.actualMultiple,
      blindedRuns:    blinded.length,
      unblindedRuns:  unblinded.length,
      blindedMedian,
      unblindedMedian,
      biasRatio,
      pooledStdDev,
    };
  });

  return NextResponse.json(summary);
}
