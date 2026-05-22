/**
 * Backtest Runner
 *
 * Runs the pipeline for a single backtest case:
 *   1. Load curated historical state from case JSON
 *   2. Optionally blind all identifying information (Patch 1)
 *   3. Create a Cluster row directly (bypass WEAVER_SWEEP and SCOUT_NARRATIVE)
 *   4. Start the debate with the curated (blinded or raw) narrative
 *   5. The existing worker processes DEBATE_ANALYST → DEBATE_SKEPTIC (×3) → SCORE
 *   6. Poll for ClusterScore completion (Patch 2 — async, non-blocking)
 *   7. Store each run in BacktestResult
 *   8. After N runs: compute median and variance, update all rows
 *
 * The worker MUST be running separately:  npm run worker:start
 * MAP tasks injected by processScore are ignored (result not captured).
 */

import { prisma }                  from '../prisma';
import { startDebate }             from '../debateManager';
import { harvestCase }             from './harvester';
import { blindPayload, blindNarrativeContext, getAliasEntry } from './blinder';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface BacktestRunConfig {
  caseId:   string;   // BacktestCase.id
  ticker:   string;   // e.g. "UNI"
  configId: string;   // ScoringConfig.id
  runType:  'blinded' | 'unblinded';
  numRuns:  number;   // typically 3
}

export interface BacktestRunResult {
  caseId:       string;
  ticker:       string;
  runType:      string;
  scores:       number[];     // totalScore per run
  medianScore:  number;
  variance:     number;       // standard deviation across runs
  verdicts:     string[];
  breakdowns:   BreakdownEntry[];
}

interface BreakdownEntry {
  runIndex:      number;
  signalStrength: number;
  timing:        number;
  upside:        number;
  totalScore:    number;
}

// ---------------------------------------------------------------------------
// Polling helper (Patch 2)
// ---------------------------------------------------------------------------

const POLL_INTERVAL_MS = 2_000;
const POLL_TIMEOUT_MS  = 300_000; // 5 minutes per run

/**
 * Polls for a ClusterScore row for the given clusterId.
 * Returns the score when found, throws if timeout exceeded.
 */
async function pollForScore(clusterId: string): Promise<{
  totalScore:    number;
  signalStrength: number;
  timing:        number;
  upside:        number;
}> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const score = await prisma.clusterScore.findFirst({
      where:   { clusterId },
      orderBy: { createdAt: 'desc' },
    });

    if (score) {
      const breakdown = JSON.parse(score.breakdown) as Record<string, {
        raw: number; weight: number; weighted: number;
      }>;
      return {
        totalScore:     score.totalScore,
        signalStrength: breakdown.signalStrength?.raw ?? 0,
        timing:         breakdown.timing?.raw         ?? 0,
        upside:         breakdown.upside?.raw         ?? 0,
      };
    }

    await sleep(POLL_INTERVAL_MS);
  }

  throw new Error(
    `[Runner] Pipeline stall — ClusterScore not created within ` +
    `${POLL_TIMEOUT_MS / 1000}s for cluster ${clusterId}`,
  );
}

/**
 * Polls for the Debate to reach a terminal status (COMPLETED or ESCALATED).
 * Needed to get the verdict for BacktestResult.
 */
async function pollForDebate(clusterId: string): Promise<string> {
  const deadline = Date.now() + POLL_TIMEOUT_MS;

  while (Date.now() < deadline) {
    const debate = await prisma.debate.findFirst({
      where:   { clusterId, status: { in: ['COMPLETED', 'ESCALATED'] } },
      orderBy: { createdAt: 'desc' },
    });
    if (debate) return debate.verdict ?? 'UNKNOWN';
    await sleep(POLL_INTERVAL_MS);
  }

  throw new Error(
    `[Runner] Debate did not reach terminal status within ${POLL_TIMEOUT_MS / 1000}s ` +
    `for cluster ${clusterId}`,
  );
}

// ---------------------------------------------------------------------------
// Pre-run cleanup (Patch 2)
// ---------------------------------------------------------------------------

/**
 * Deletes any existing Cluster (and cascaded Debate/DebateMessage/ClusterScore/Alert)
 * with the given assetId. Prevents cross-contamination between runs.
 */
async function cleanupPriorRun(assetId: string): Promise<void> {
  const existing = await prisma.cluster.findMany({ where: { assetId } });
  if (existing.length > 0) {
    await prisma.cluster.deleteMany({ where: { assetId } });
    console.log(`[Runner] Cleaned up ${existing.length} prior cluster(s) for assetId="${assetId}"`);
  }
}

// ---------------------------------------------------------------------------
// Single run
// ---------------------------------------------------------------------------

async function runSingle(
  config:    BacktestRunConfig,
  runIndex:  number,
): Promise<{ result: BacktestRunResult['breakdowns'][0]; verdict: string; totalScore: number }> {
  const { ticker, runType } = config;

  // Determine assetId for this specific run (predictable + unique per run slot)
  const aliasEntry = getAliasEntry(ticker);
  const assetId    = runType === 'blinded'
    ? `bt_${aliasEntry.alias}_r${runIndex}`
    : `bt_${ticker}_r${runIndex}`;

  // Cleanup prior run at this slot (Patch 2)
  await cleanupPriorRun(assetId);

  // Load historical state
  const state = await harvestCase(ticker);

  // Optionally blind
  let narrativeContext: string;
  let displayName:      string;

  if (runType === 'blinded') {
    const blinded    = blindPayload(state.payload, aliasEntry);
    narrativeContext = blindNarrativeContext(blinded.narrativeAtSnapshot, aliasEntry);
    displayName      = aliasEntry.alias;
  } else {
    narrativeContext = state.payload.narrativeAtSnapshot;
    displayName      = ticker;
  }

  // Create Cluster row (bypasses WEAVER_SWEEP and SCOUT_NARRATIVE)
  const cluster = await prisma.cluster.create({
    data: {
      assetId:   assetId,
      assetType: 'Repository',          // all backtest cases are GitHub repos
      status:    'DEBATING',
    },
  });

  console.log(
    `[Runner] ${runType.toUpperCase()} run ${runIndex}/${config.numRuns} — ` +
    `${displayName} (cluster ${cluster.id})`,
  );

  // Start debate with curated (blinded or raw) narrative
  await startDebate(cluster.id, narrativeContext);

  // Poll for debate verdict, then score (Patch 2 — async)
  const verdict    = await pollForDebate(cluster.id);
  const scoreData  = await pollForScore(cluster.id);

  console.log(
    `[Runner] Run ${runIndex} complete — ` +
    `score=${scoreData.totalScore.toFixed(3)}, verdict=${verdict}`,
  );

  return {
    result: {
      runIndex,
      signalStrength: scoreData.signalStrength,
      timing:         scoreData.timing,
      upside:         scoreData.upside,
      totalScore:     scoreData.totalScore,
    },
    verdict,
    totalScore: scoreData.totalScore,
  };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Runs N backtest iterations for a single case+config+runType.
 * Stores each run in BacktestResult, then populates variance after all runs.
 */
export async function runBacktest(config: BacktestRunConfig): Promise<BacktestRunResult> {
  const { caseId, ticker, configId, runType, numRuns } = config;

  console.log(
    `\n[Runner] ══ Starting ${runType.toUpperCase()} backtest: ${ticker} ` +
    `(${numRuns} runs) ══`,
  );

  const scores:     number[]                          = [];
  const verdicts:   string[]                          = [];
  const breakdowns: BacktestRunResult['breakdowns']   = [];
  const resultIds:  string[]                          = [];

  for (let i = 1; i <= numRuns; i++) {
    let runData: Awaited<ReturnType<typeof runSingle>>;

    try {
      runData = await runSingle(config, i);
    } catch (err) {
      console.error(`[Runner] Run ${i} failed:`, (err as Error).message);
      continue; // log error, skip this run, continue to next
    }

    const { result, verdict, totalScore } = runData;
    scores.push(totalScore);
    verdicts.push(verdict);
    breakdowns.push(result);

    // Persist individual BacktestResult (variance = null until all runs done)
    const persisted = await prisma.backtestResult.create({
      data: {
        caseId,
        configId,
        runType,
        runIndex:      i,
        signalStrength: result.signalStrength,
        timing:         result.timing,
        upside:         result.upside,
        totalScore,
        verdict,
        variance:       null,
      },
    });
    resultIds.push(persisted.id);
  }

  if (scores.length === 0) {
    throw new Error(`[Runner] All ${numRuns} runs failed for ${ticker} (${runType})`);
  }

  // Compute median and standard deviation
  const sortedScores = [...scores].sort((a, b) => a - b);
  const midIndex     = Math.floor(sortedScores.length / 2);
  const medianScore  = sortedScores.length % 2 === 1
    ? sortedScores[midIndex]
    : (sortedScores[midIndex - 1] + sortedScores[midIndex]) / 2;

  const mean     = scores.reduce((a, b) => a + b, 0) / scores.length;
  const variance = Math.sqrt(
    scores.reduce((sum, s) => sum + Math.pow(s - mean, 2), 0) / scores.length,
  );

  // Back-fill variance on all BacktestResult rows for this batch
  await prisma.backtestResult.updateMany({
    where: { id: { in: resultIds } },
    data:  { variance },
  });

  console.log(
    `[Runner] ══ ${ticker} ${runType.toUpperCase()} complete — ` +
    `median=${medianScore.toFixed(3)}, σ=${variance.toFixed(3)} ══\n`,
  );

  return {
    caseId,
    ticker,
    runType,
    scores,
    medianScore,
    variance,
    verdicts,
    breakdowns,
  };
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
