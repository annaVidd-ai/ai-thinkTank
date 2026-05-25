import { prisma } from './prisma';
import { callLLM } from './llmClient';
import { SCORE_CONFIG, MAPPER_CONFIG } from './llmConfig';
import {
  ScoreSchema,
  MapperSchema,
  getScoreSystemPrompt,
  getMapperSystemPrompt,
  getTemperature,
  buildTranscript,
  buildScoreUser,
  buildMapperUser,
} from './prompts';

// ---------------------------------------------------------------------------
// Scoring defaults
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG_NAME = 'default-v1';

const DEFAULT_WEIGHTS: Record<string, number> = {
  signalStrength: 0.30,
  timing:         0.2625,
  upside:         0.1875,
  failureRisk:    0.25,
};

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Scores a cluster using DeepSeek-R1:
 * 1. Fetches (or auto-seeds) the active ScoringConfig.
 * 2. Fetches the completed debate + full transcript for context.
 * 3. Calls DeepSeek-R1 to produce real signalStrength / timing / upside scores.
 * 4. Computes a weighted breakdown and persists a ClusterScore row.
 * 5. Advances Cluster.status → SCORED.
 * 6. Injects a MAP task.
 */
export async function processScore(clusterId: string): Promise<void> {
  // 1. Fetch or auto-seed active config.
  let config = await prisma.scoringConfig.findFirst({ where: { isActive: true } });

  if (!config) {
    console.log('[Quant] No active ScoringConfig found — seeding default.');
    config = await prisma.scoringConfig.create({
      data: {
        name:     DEFAULT_CONFIG_NAME,
        weights:  JSON.stringify(DEFAULT_WEIGHTS),
        isActive: true,
      },
    });
    console.log(`[Quant] Seeded config "${config.name}" (id=${config.id})`);
  }

  const weights: Record<string, number> = JSON.parse(config.weights);

  // C4: Validate weight sum — must be within ±0.01 of 1.0 to avoid silent scoring drift
  const weightSum = Object.values(weights).reduce((s, w) => s + w, 0);
  if (Math.abs(weightSum - 1.0) > 0.01) {
    throw new Error(
      `[Quant] Weight sum ${weightSum.toFixed(4)} deviates from 1.0 by more than 0.01 — ` +
      `check ScoringConfig "${config.name}".`,
    );
  }

  // 2. Fetch cluster and its most recent completed debate.
  const cluster = await prisma.cluster.findUniqueOrThrow({ where: { id: clusterId } });

  const debate = await prisma.debate.findFirst({
    where:   { clusterId, status: { in: ['COMPLETED', 'ESCALATED'] } },
    orderBy: { createdAt: 'desc' },
    include: { messages: { orderBy: { createdAt: 'asc' } } },
  });

  if (!debate) {
    throw new Error(`[Quant] No resolved Debate (COMPLETED or ESCALATED) found for cluster ${clusterId}`);
  }

  const transcript = buildTranscript(debate.messages);

  // 3. Call DeepSeek-R1 for quantitative scores.
  const user = buildScoreUser(
    cluster.assetId,
    cluster.assetType,
    debate.verdict ?? 'UNKNOWN',
    debate.narrativeContext ?? '',
    transcript,
  );

  const scoreResult = await callLLM(SCORE_CONFIG, getScoreSystemPrompt(), user, ScoreSchema, getTemperature('quant'));

  console.log(
    `[Quant] LLM scores → signalStrength=${scoreResult.signalStrength}, ` +
    `timing=${scoreResult.timing}, upside=${scoreResult.upside}, ` +
    `failureRisk=${scoreResult.failureRisk}`,
  );
  console.log(`[Quant] Reasoning: ${scoreResult.reasoning}`);

  // 4. Compute weighted breakdown.
  // failureRisk is inverted: (1 - raw) × weight so high risk lowers totalScore.
  // If failureRisk was absent from LLM output, ScoreSchema defaults it to 0 (no risk).
  const rawScores: Record<string, number> = {
    signalStrength: scoreResult.signalStrength,
    timing:         scoreResult.timing,
    upside:         scoreResult.upside,
    failureRisk:    scoreResult.failureRisk ?? 0.0,
  };

  let totalScore = 0;
  const breakdown: Record<string, { raw: number; weight: number; weighted: number }> = {};

  for (const [dimension, weight] of Object.entries(weights)) {
    const raw      = rawScores[dimension] ?? 0.5;
    // failureRisk contributes (1 - raw) × weight; all other dimensions contribute raw × weight
    const effective = dimension === 'failureRisk' ? (1 - raw) : raw;
    const weighted  = parseFloat((effective * weight).toFixed(4));
    breakdown[dimension] = { raw, weight, weighted };
    totalScore += weighted;
  }
  totalScore = parseFloat(totalScore.toFixed(4));

  // 5. Persist ClusterScore.
  const score = await prisma.clusterScore.create({
    data: {
      clusterId,
      configId:  config.id,
      totalScore,
      breakdown: JSON.stringify(breakdown),
    },
  });

  console.log(`[Quant] Score saved: totalScore=${totalScore} (id=${score.id})`);
  console.log(`[Quant] Breakdown: ${JSON.stringify(breakdown)}`);

  // 6. Advance cluster status.
  const updatedCluster = await prisma.cluster.update({
    where: { id: clusterId },
    data:  { status: 'SCORED' },
  });

  console.log(`[Quant] Cluster ${updatedCluster.assetId} → SCORED`);

  // 7. Queue MAP task.
  await prisma.agentTask.create({
    data: {
      type:    'MAP',
      status:  'PENDING',
      payload: JSON.stringify({ clusterId }),
    },
  });
}

/**
 * Maps a scored cluster to a tradable ticker via Claude Haiku and generates an Alert:
 * 1. Calls Claude Haiku with MapperSchema to derive ticker + marketCap.
 * 2. Fetches the latest ClusterScore and completed Debate verdict.
 * 3. Gates on the T+U sub-score threshold (NOT totalScore).
 * 4. Upserts an Alert row (idempotent on re-runs).
 *
 * Alert gate: T+U sub-score = (0.2625 × timing_raw + 0.1875 × upside_raw) / 0.45
 * Threshold locked from 8W/6C marathon training set (2026-05-25):
 *   midpoint(min_Winner_TU=0.5667 [SUSHI], max_Control_TU=0.5667 [CRV]) = 0.5667
 * TotalScore is NOT used for alert gating.
 */
const TU_ALERT_THRESHOLD = 0.5667;

export async function processMap(clusterId: string): Promise<void> {
  const cluster = await prisma.cluster.findUniqueOrThrow({ where: { id: clusterId } });

  // Fetch completed debate for thesis.
  const debate = await prisma.debate.findFirst({
    where:   { clusterId, status: { in: ['COMPLETED', 'ESCALATED'] } },
    orderBy: { createdAt: 'desc' },
  });

  if (!debate) {
    throw new Error(`[Mapper] No resolved Debate found for cluster ${clusterId}`);
  }

  const thesis = debate.verdict ?? 'UNKNOWN';

  // Call Claude Haiku to derive ticker.
  const user      = buildMapperUser(cluster.assetId, cluster.assetType, thesis);
  const mapResult = await callLLM(MAPPER_CONFIG, getMapperSystemPrompt(), user, MapperSchema, getTemperature('mapper'));

  console.log(
    `[Mapper] Resolved ticker for "${cluster.assetId}" → ${mapResult.ticker} ` +
    `(marketCap: ${mapResult.marketCap})`,
  );

  // Fetch latest score for this cluster.
  const clusterScore = await prisma.clusterScore.findFirst({
    where:   { clusterId },
    orderBy: { createdAt: 'desc' },
  });

  if (!clusterScore) {
    throw new Error(`[Mapper] No ClusterScore found for cluster ${clusterId}`);
  }

  // Compute T+U sub-score from breakdown JSON.
  let timing = 0;
  let upside = 0;
  try {
    const breakdown = JSON.parse(clusterScore.breakdown) as Record<string, { raw: number }>;
    timing = breakdown.timing?.raw ?? 0;
    upside = breakdown.upside?.raw ?? 0;
  } catch {
    console.warn(
      `[Mapper] Could not parse breakdown JSON for cluster ${clusterId} — T+U defaults to 0.`,
    );
  }
  const timingUpsideSubScore = parseFloat(((0.2625 * timing + 0.1875 * upside) / 0.45).toFixed(4));

  console.log(
    `[Mapper] T+U sub-score: timing=${timing}, upside=${upside}, ` +
    `T+U=${timingUpsideSubScore.toFixed(4)} (threshold=${TU_ALERT_THRESHOLD})`,
  );

  // Gate on T+U sub-score — skip alert if below the locked training threshold.
  if (timingUpsideSubScore < TU_ALERT_THRESHOLD) {
    console.log(
      `[Mapper] T+U ${timingUpsideSubScore.toFixed(4)} < ${TU_ALERT_THRESHOLD} ` +
      `— no alert generated for cluster ${clusterId}.`,
    );
    return;
  }

  // Upsert Alert — idempotent if MAP runs more than once.
  const alert = await prisma.alert.upsert({
    where:  { clusterId },
    update: { ticker: mapResult.ticker, totalScore: clusterScore.totalScore, thesis },
    create: { clusterId, ticker: mapResult.ticker, totalScore: clusterScore.totalScore, thesis },
  });

  console.log(
    `[Mapper] Alert generated → ticker=${alert.ticker}, score=${alert.totalScore}, ` +
    `T+U=${timingUpsideSubScore.toFixed(4)}, thesis="${alert.thesis}" (id=${alert.id})`,
  );
}
