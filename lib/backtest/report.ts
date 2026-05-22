/**
 * Backtest Bias Report Generator
 *
 * For each backtest case, compares blinded vs unblinded median scores.
 *
 * Key metric: biasRatio = unblindedMedian / blindedMedian
 *   - biasRatio > 1.5 → hindsight bias detected (LLM using training knowledge)
 *   - biasRatio ≈ 1.0 → clean signal (structural features driving the score)
 *   - biasRatio < 1.0 → blinded scores higher (unusual — could indicate anchoring)
 *
 * Success criterion: at least 50% of calibration cases score ≥ ALERT_THRESHOLD
 * in the blinded run (structural signal is strong enough without names).
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
  actualMultiple:     number;
  blindedMedian:      number;
  unblindedMedian:    number;
  biasRatio:          number;      // unblindedMedian / blindedMedian (or Infinity if blindedMedian=0)
  biasDetected:       boolean;     // biasRatio > 1.5
  varianceBlinded:    number;
  varianceUnblinded:  number;
  blindedRuns:        number;      // how many blinded runs completed
  unblindedRuns:      number;
}

export interface ReportSummary {
  cases:                BiasReport[];
  alertThreshold:       number;
  calibrationPassRate:  number;    // fraction of calibration cases scoring >= threshold (blinded)
  validationPassRate:   number;
  verificationPassRate: number;
  overallPassRate:      number;
  avgBiasRatio:         number;
  biasDetectedCount:    number;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

const ALERT_THRESHOLD = 0.5; // configurable

/**
 * Reads all BacktestResult rows and produces the full bias report.
 * Call after runWalkForwardValidation() completes.
 */
export async function generateBiasReport(
  alertThreshold = ALERT_THRESHOLD,
): Promise<ReportSummary> {
  const cases   = await prisma.backtestCase.findMany({ orderBy: { split: 'asc' } });
  const reports: BiasReport[] = [];

  for (const c of cases) {
    const results = await prisma.backtestResult.findMany({
      where: { caseId: c.id },
    });

    const blindedResults    = results.filter((r) => r.runType === 'blinded');
    const unblindedResults  = results.filter((r) => r.runType === 'unblinded');

    const blindedMedian     = median(blindedResults.map((r) => r.totalScore));
    const unblindedMedian   = median(unblindedResults.map((r) => r.totalScore));
    const varianceBlinded   = avgVariance(blindedResults);
    const varianceUnblinded = avgVariance(unblindedResults);

    // Only compute bias ratio when both sides have data
    const hasBothSides = blindedResults.length > 0 && unblindedResults.length > 0;
    const biasRatio    = hasBothSides && blindedMedian > 0
      ? unblindedMedian / blindedMedian
      : 0;
    const biasDetected = hasBothSides && biasRatio > 1.5;

    reports.push({
      ticker:             c.ticker,
      projectAlias:       c.projectAlias,
      sector:             c.sector,
      split:              c.split,
      actualMultiple:     c.actualMultiple,
      blindedMedian:      round4(blindedMedian),
      unblindedMedian:    round4(unblindedMedian),
      biasRatio:          round4(biasRatio),
      biasDetected,
      varianceBlinded:    round4(varianceBlinded),
      varianceUnblinded:  round4(varianceUnblinded),
      blindedRuns:        blindedResults.length,
      unblindedRuns:      unblindedResults.length,
    });
  }

  // Compute summary statistics
  const calibration    = reports.filter((r) => r.split === 'calibration');
  const validation     = reports.filter((r) => r.split === 'validation');
  const verification   = reports.filter((r) => r.split === 'verification');

  const passRate = (group: BiasReport[]) => {
    const withData = group.filter((r) => r.blindedRuns > 0);
    if (withData.length === 0) return 0;
    return withData.filter((r) => r.blindedMedian >= alertThreshold).length / withData.length;
  };

  const validRatios     = reports.filter((r) => isFinite(r.biasRatio));
  const avgBiasRatio    = validRatios.length > 0
    ? validRatios.reduce((s, r) => s + r.biasRatio, 0) / validRatios.length
    : 0;
  // Only count bias as detected when both sides have data and ratio is > 1.5
  const biasDetectedCount = reports.filter(
    (r) => r.blindedRuns > 0 && r.unblindedRuns > 0 && r.biasDetected,
  ).length;

  return {
    cases:                reports,
    alertThreshold,
    calibrationPassRate:  round4(passRate(calibration)),
    validationPassRate:   round4(passRate(validation)),
    verificationPassRate: round4(passRate(verification)),
    overallPassRate:      round4(passRate(reports)),
    avgBiasRatio:         round4(avgBiasRatio),
    biasDetectedCount,
  };
}

/**
 * Prints a formatted bias report to the console.
 */
export function printBiasReport(summary: ReportSummary): void {
  const { cases, alertThreshold } = summary;

  console.log('\n╔══════════════════════════════════════════════════════════════════════════╗');
  console.log('║                     BACKTEST BIAS REPORT                               ║');
  console.log('╠══════════════════════════════════════════════════════════════════════════╣');
  console.log(`║  Alert threshold   : ${String(alertThreshold).padEnd(51)}║`);
  console.log(`║  Calibration pass  : ${pct(summary.calibrationPassRate).padEnd(51)}║`);
  console.log(`║  Validation pass   : ${pct(summary.validationPassRate).padEnd(51)}║`);
  console.log(`║  Verification pass : ${pct(summary.verificationPassRate).padEnd(51)}║`);
  console.log(`║  Avg bias ratio    : ${summary.avgBiasRatio.toFixed(3).padEnd(51)}║`);
  console.log(`║  Bias detected     : ${String(summary.biasDetectedCount).padEnd(51)}║`);
  console.log('╠══════════════════════════════════════════════════════════════════════════╣');
  console.log('║  Ticker   Split   Blinded  Unblind  Bias  Det  ActualX  Runs           ║');
  console.log('╠══════════════════════════════════════════════════════════════════════════╣');

  for (const r of cases) {
    const noData      = r.blindedRuns === 0 && r.unblindedRuns === 0;
    const det         = noData ? '-' : r.biasDetected ? '⚠' : '✓';
    const blindedStr  = r.blindedRuns   > 0 ? r.blindedMedian.toFixed(3)   : 'N/A';
    const unblindStr  = r.unblindedRuns > 0 ? r.unblindedMedian.toFixed(3) : 'N/A';
    const biasStr     = (r.blindedRuns > 0 && r.unblindedRuns > 0)
      ? r.biasRatio.toFixed(2)
      : 'N/A';
    const alias       = r.split === 'calibration' ? r.projectAlias : r.ticker;
    const line        =
      `  ${alias.padEnd(14)}` +
      `${r.split.padEnd(13)}` +
      `${blindedStr.padEnd(9)}` +
      `${unblindStr.padEnd(9)}` +
      `${biasStr.padEnd(7)}` +
      `${det.padEnd(4)}` +
      `${String(r.actualMultiple).padEnd(9)}` +
      `${r.blindedRuns}b/${r.unblindedRuns}u`;
    console.log(`║${line.padEnd(72)} ║`);
  }

  console.log('╚══════════════════════════════════════════════════════════════════════════╝\n');

  if (summary.calibrationPassRate >= 0.5) {
    console.log('✅  SIGNAL VALIDATED: ≥50% of calibration cases score above threshold (blinded).');
  } else {
    console.log('❌  SIGNAL WEAK: <50% of calibration cases score above threshold (blinded).');
    console.log('    Review prompt framing and scoring weights before proceeding.');
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
