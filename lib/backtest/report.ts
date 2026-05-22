/**
 * Backtest Bias Report Generator
 *
 * For each backtest case, compares blinded vs unblinded median scores using
 * only the most recent N runs per (case, runType) — where N = numRuns param.
 *
 * Key metric: biasRatio = unblindedMedian / blindedMedian
 *   - biasRatio > 1.5 → hindsight bias detected (LLM using training knowledge)
 *   - biasRatio ≈ 1.0 → clean signal (structural features driving the score)
 *   - biasRatio < 1.0 → blinded scores higher (unusual — could indicate anchoring)
 *
 * Success criterion: at least 50% of calibration POSITIVE cases score ≥ ALERT_THRESHOLD
 * in the blinded run (structural signal is strong enough without names).
 *
 * Controls: negative-control cases (isControl=true) are shown separately and excluded
 * from the pass-rate calculation. discriminationWarning fires when |winnersAvg - controlsAvg| < 0.10.
 */

import { prisma } from '../prisma';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BiasReport {
  ticker:             string;
  projectAlias:       string;
  sector:             string;
  split:              string;
  isControl:          boolean;     // true = negative control case
  actualMultiple:     number;
  blindedMedian:      number;
  unblindedMedian:    number;
  biasRatio:          number;      // unblindedMedian / blindedMedian (or 0 if no data)
  biasDetected:       boolean;     // biasRatio > 1.5
  varianceBlinded:    number;
  varianceUnblinded:  number;
  blindedRuns:        number;      // how many blinded runs used (≤ numRuns)
  unblindedRuns:      number;
}

export interface ReportSummary {
  cases:                BiasReport[];
  alertThreshold:       number;
  numRuns:              number;
  calibrationPassRate:  number;    // fraction of positive calibration cases scoring >= threshold
  validationPassRate:   number;
  verificationPassRate: number;
  overallPassRate:      number;
  avgBiasRatio:         number | null;  // null when no cases have both sides tested yet
  biasDetectedCount:    number;
  controlsAvg:          number | null;  // avg blinded score for tested controls
  winnersAvg:           number | null;  // avg blinded score for tested positive cases
  discriminationWarning: boolean;       // true when |winnersAvg − controlsAvg| < 0.10
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const ALERT_THRESHOLD = 0.7;

/**
 * Reads BacktestResult rows and produces the full bias report.
 *
 * Bug 1 fix: uses only the most recent numRuns rows per (case, runType) so
 * repeated runs of the same case don't pool across historical batches.
 *
 * Bug 2 fix: avgBiasRatio is null (displayed as "N/A") when no cases have
 * both blinded and unblinded results yet, rather than including zeros for
 * untested cases and producing a bogus low average.
 */
export async function generateBiasReport(
  alertThreshold = ALERT_THRESHOLD,
  numRuns        = 3,
): Promise<ReportSummary> {
  const cases   = await prisma.backtestCase.findMany({ orderBy: { split: 'asc' } });
  const reports: BiasReport[] = [];

  for (const c of cases) {
    // Most recent numRuns rows per runType — avoids pooling across historical batches.
    const blindedResults = await prisma.backtestResult.findMany({
      where:   { caseId: c.id, runType: 'blinded' },
      orderBy: { createdAt: 'desc' },
      take:    numRuns,
    });
    const unblindedResults = await prisma.backtestResult.findMany({
      where:   { caseId: c.id, runType: 'unblinded' },
      orderBy: { createdAt: 'desc' },
      take:    numRuns,
    });

    const blindedMedian     = median(blindedResults.map((r) => r.totalScore));
    const unblindedMedian   = median(unblindedResults.map((r) => r.totalScore));
    const varianceBlinded   = avgVariance(blindedResults);
    const varianceUnblinded = avgVariance(unblindedResults);

    const hasBothSides = blindedResults.length > 0 && unblindedResults.length > 0;
    const biasRatio    = hasBothSides && blindedMedian > 0
      ? unblindedMedian / blindedMedian
      : 0;
    const biasDetected = hasBothSides && biasRatio > 1.5;

    reports.push({
      ticker:            c.ticker,
      projectAlias:      c.projectAlias,
      sector:            c.sector,
      split:             c.split,
      isControl:         c.isControl,
      actualMultiple:    c.actualMultiple,
      blindedMedian:     round4(blindedMedian),
      unblindedMedian:   round4(unblindedMedian),
      biasRatio:         round4(biasRatio),
      biasDetected,
      varianceBlinded:   round4(varianceBlinded),
      varianceUnblinded: round4(varianceUnblinded),
      blindedRuns:       blindedResults.length,
      unblindedRuns:     unblindedResults.length,
    });
  }

  // Split groups
  const calibration  = reports.filter((r) => r.split === 'calibration');
  const validation   = reports.filter((r) => r.split === 'validation');
  const verification = reports.filter((r) => r.split === 'verification');

  // Pass rate counts only positive (non-control) cases with blinded data.
  // Controls are expected to score low — including them would corrupt the metric.
  const passRate = (group: BiasReport[]) => {
    const withData = group.filter((r) => r.blindedRuns > 0 && !r.isControl);
    if (withData.length === 0) return 0;
    return withData.filter((r) => r.blindedMedian >= alertThreshold).length / withData.length;
  };

  // Only average bias ratios for cases that have BOTH sides tested and a positive ratio.
  const testedBothSides = reports.filter(
    (r) => r.blindedRuns > 0 && r.unblindedRuns > 0 && r.biasRatio > 0,
  );
  const avgBiasRatio: number | null = testedBothSides.length > 0
    ? round4(testedBothSides.reduce((s, r) => s + r.biasRatio, 0) / testedBothSides.length)
    : null;

  const biasDetectedCount = reports.filter(
    (r) => r.blindedRuns > 0 && r.unblindedRuns > 0 && r.biasDetected,
  ).length;

  // Controls vs winners discrimination
  const testedControls = reports.filter((r) =>  r.isControl && r.blindedRuns > 0);
  const testedWinners  = reports.filter((r) => !r.isControl && r.blindedRuns > 0);

  const controlsAvg: number | null = testedControls.length > 0
    ? round4(testedControls.reduce((s, r) => s + r.blindedMedian, 0) / testedControls.length)
    : null;
  const winnersAvg: number | null = testedWinners.length > 0
    ? round4(testedWinners.reduce((s, r) => s + r.blindedMedian, 0) / testedWinners.length)
    : null;

  const discriminationWarning =
    controlsAvg !== null &&
    winnersAvg  !== null &&
    Math.abs(winnersAvg - controlsAvg) < 0.10;

  return {
    cases:                reports,
    alertThreshold,
    numRuns,
    calibrationPassRate:  round4(passRate(calibration)),
    validationPassRate:   round4(passRate(validation)),
    verificationPassRate: round4(passRate(verification)),
    overallPassRate:      round4(passRate(reports)),
    avgBiasRatio,
    biasDetectedCount,
    controlsAvg,
    winnersAvg,
    discriminationWarning,
  };
}

/**
 * Prints a formatted bias report to the console.
 * Box width: 82 chars.
 */
export function printBiasReport(summary: ReportSummary): void {
  const { cases, alertThreshold, numRuns } = summary;
  const W = 80; // inner content width (between the two ║ chars)

  const border = (l: string, m: string, r: string) =>
    l + m.repeat(W) + r;

  const row = (content: string) =>
    '║' + content.padEnd(W) + '║';

  const kv = (label: string, value: string) => {
    const prefix = `  ${label}: `;
    return row(prefix + value.padEnd(W - prefix.length));
  };

  // ── Header ────────────────────────────────────────────────────────────────
  console.log('\n' + border('╔', '═', '╗'));
  console.log(row('                      BACKTEST BIAS REPORT'));
  console.log(border('╠', '═', '╣'));
  console.log(kv('Alert threshold  ', String(alertThreshold)));
  console.log(kv('Runs per batch   ', String(numRuns)));
  console.log(kv('Calibration pass ', pct(summary.calibrationPassRate)));
  console.log(kv('Validation pass  ', pct(summary.validationPassRate)));
  console.log(kv('Verification pass', pct(summary.verificationPassRate)));
  const biasRatioStr = summary.avgBiasRatio === null ? 'N/A' : summary.avgBiasRatio.toFixed(3);
  console.log(kv('Avg bias ratio   ', biasRatioStr));
  console.log(kv('Bias detected    ', String(summary.biasDetectedCount)));

  // ── Per-case table ─────────────────────────────────────────────────────────
  console.log(border('╠', '═', '╣'));

  // Column widths: alias(14) split(14) type(5) blinded(9) unblind(9) bias(7) det(4) actualX(9) runs(~5)
  // Total fixed: 2+14+14+5+9+9+7+4+9 = 73, leaving ~7 for runs and padding
  const colHeader =
    '  ' +
    'Ticker'.padEnd(14) +
    'Split'.padEnd(14) +
    'Type '.padEnd(6) +
    'Blinded  '.padEnd(9) +
    'Unblind  '.padEnd(9) +
    'Bias   '.padEnd(7) +
    'Det '.padEnd(5) +
    'ActualX  '.padEnd(9) +
    'Runs';
  console.log(row(colHeader));
  console.log(border('╠', '═', '╣'));

  for (const r of cases) {
    const noData      = r.blindedRuns === 0 && r.unblindedRuns === 0;
    const det         = noData ? '-' : r.biasDetected ? '⚠' : '✓';
    const blindedStr  = r.blindedRuns   > 0 ? r.blindedMedian.toFixed(3)   : 'N/A';
    const unblindStr  = r.unblindedRuns > 0 ? r.unblindedMedian.toFixed(3) : 'N/A';
    const biasStr     = (r.blindedRuns > 0 && r.unblindedRuns > 0)
      ? r.biasRatio.toFixed(2) : 'N/A';
    const typeStr     = r.isControl ? 'Ctrl' : 'Pos';
    const alias       = r.split === 'calibration' ? r.projectAlias : r.ticker;

    const line =
      '  ' +
      alias.padEnd(14) +
      r.split.padEnd(14) +
      typeStr.padEnd(6) +
      blindedStr.padEnd(9) +
      unblindStr.padEnd(9) +
      biasStr.padEnd(7) +
      det.padEnd(5) +
      String(r.actualMultiple).padEnd(9) +
      `${r.blindedRuns}b/${r.unblindedRuns}u`;

    console.log(row(line));
  }

  // ── Controls vs winners summary ────────────────────────────────────────────
  console.log(border('╠', '═', '╣'));
  if (summary.controlsAvg !== null && summary.winnersAvg !== null) {
    const delta    = summary.winnersAvg - summary.controlsAvg;
    const sign     = delta >= 0 ? '+' : '';
    const summLine =
      `  Controls avg: ${summary.controlsAvg.toFixed(3)}` +
      `  |  Winners avg: ${summary.winnersAvg.toFixed(3)}` +
      `  |  Δ: ${sign}${delta.toFixed(3)}`;
    console.log(row(summLine));
  } else {
    console.log(row('  Discrimination: insufficient data (run controls + at least one positive case).'));
  }
  console.log(border('╚', '═', '╝'));
  console.log();

  // ── Verdicts ──────────────────────────────────────────────────────────────
  if (summary.calibrationPassRate >= 0.5) {
    console.log('✅  SIGNAL VALIDATED: ≥50% of positive calibration cases score above threshold (blinded).');
  } else {
    console.log('❌  SIGNAL WEAK: <50% of positive calibration cases score above threshold (blinded).');
    console.log('    Review prompt framing and scoring weights before proceeding.');
  }

  if (summary.discriminationWarning) {
    console.log(
      '⚠️   WARNING: Scoring discrimination insufficient — ' +
      'controls and winners score too similarly (Δ < 0.10).',
    );
  }

  console.log();
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function median(values: number[]): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid    = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

function avgVariance(results: { variance: number | null }[]): number {
  const vals = results.map((r) => r.variance ?? 0);
  return vals.length === 0 ? 0 : vals.reduce((a, b) => a + b, 0) / vals.length;
}

function pct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}

function round4(n: number): number {
  return Math.round(n * 10_000) / 10_000;
}
