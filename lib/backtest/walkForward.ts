/**
 * Walk-Forward Validation
 *
 * Runs the full backtest across all cases in split order:
 *   calibration (7) → validation (3) → verification (2)
 *
 * For each case × each active ScoringConfig:
 *   - Runs N=3 blinded iterations
 *   - Runs N=3 unblinded iterations
 *   - Stores all BacktestResult rows
 *
 * Total: 12 cases × 2 run types × 3 runs = 72 pipeline runs.
 * Each run = 6 DeepSeek-R1 debate calls + 1 scoring call ≈ 5-10 minutes.
 * Full suite ≈ 6-12 hours. Use --cases flag for targeted runs.
 */

import { prisma }       from '../prisma';
import { runBacktest }  from './runner';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface WalkForwardConfig {
  tickerFilter?: string[];             // undefined = all cases
  numRuns?:      number;               // default 3
  runTypes?:     ('blinded' | 'unblinded')[];  // default both
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns or creates the default ScoringConfig */
async function ensureDefaultConfig(): Promise<{ id: string; name: string }> {
  let config = await prisma.scoringConfig.findFirst({ where: { isActive: true } });

  if (!config) {
    config = await prisma.scoringConfig.create({
      data: {
        name:     'default-v1',
        weights:  JSON.stringify({ signalStrength: 0.40, timing: 0.35, upside: 0.25 }),
        isActive: true,
      },
    });
    console.log(`[WalkForward] Created default ScoringConfig: ${config.id}`);
  }

  return { id: config.id, name: config.name };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Runs walk-forward validation for all (or filtered) backtest cases.
 * Returns a summary of median scores per case.
 */
export async function runWalkForwardValidation(options: WalkForwardConfig = {}): Promise<void> {
  const {
    tickerFilter,
    numRuns  = 3,
    runTypes = ['blinded', 'unblinded'],
  } = options;

  const config = await ensureDefaultConfig();

  // Load cases from DB, in split order: calibration → validation → verification
  const splitOrder = { calibration: 0, validation: 1, verification: 2 };
  const allCases   = await prisma.backtestCase.findMany();

  const cases = allCases
    .filter((c) => !tickerFilter || tickerFilter.includes(c.ticker))
    .sort((a, b) =>
      (splitOrder[a.split as keyof typeof splitOrder] ?? 99) -
      (splitOrder[b.split as keyof typeof splitOrder] ?? 99),
    );

  if (cases.length === 0) {
    throw new Error(
      '[WalkForward] No cases found. Run `npx tsx prisma/seed-backtest.ts` first.',
    );
  }

  const totalRuns = cases.length * runTypes.length * numRuns;
  console.log(
    `\n[WalkForward] Starting validation:`,
    `\n  Cases    : ${cases.length} (${tickerFilter ? tickerFilter.join(', ') : 'all'})`,
    `\n  Run types: ${runTypes.join(', ')}`,
    `\n  Runs each: ${numRuns}`,
    `\n  Total    : ${totalRuns} pipeline runs`,
    `\n  Config   : ${config.name} (${config.id})`,
    `\n  Est. time: ${Math.round(totalRuns * 7)} min (at ~7 min/run)\n`,
  );

  let completed = 0;
  const errors:  string[] = [];

  for (const btCase of cases) {
    for (const runType of runTypes) {
      try {
        await runBacktest({
          caseId:   btCase.id,
          ticker:   btCase.ticker,
          configId: config.id,
          runType,
          numRuns,
        });
        completed++;
      } catch (err) {
        const msg = `${btCase.ticker} (${runType}): ${(err as Error).message}`;
        console.error(`[WalkForward] ERROR — ${msg}`);
        errors.push(msg);
      }
    }
  }

  console.log(`\n[WalkForward] Complete — ${completed}/${cases.length * runTypes.length} case×type combos succeeded.`);
  if (errors.length > 0) {
    console.warn(`[WalkForward] ${errors.length} errors:`);
    errors.forEach((e) => console.warn(`  • ${e}`));
  }
}
