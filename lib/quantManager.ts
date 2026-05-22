import { prisma } from './prisma';
import { callLLM } from './llmClient';
import { SCORE_CONFIG, MAPPER_CONFIG } from './llmConfig';
import {
  ScoreSchema,
  MapperSchema,
  SCORE_SYSTEM_PROMPT,
  MAPPER_SYSTEM_PROMPT,
  buildTranscript,
  buildScoreUser,
  buildMapperUser,
} from './prompts';

// ---------------------------------------------------------------------------
// Scoring defaults
// ---------------------------------------------------------------------------

const DEFAULT_CONFIG_NAME = 'default-v1';

const DEFAULT_WEIGHTS: Record<string, number> = {
  signalStrength: 0.40,
  timing:         0.35,
  upside:         0.25,
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

  const scoreResult = await callLLM(SCORE_CONFIG, SCORE_SYSTEM_PROMPT, user, ScoreSchema);

  console.log(`[Quant] LLM scores → signalStrength=${scoreResult.signalStrength}, timing=${scoreResult.timing}, upside=${scoreResult.upside}`);
  console.log(`[Quant] Reasoning: ${scoreResult.reasoning}`);

  // 4. Compute weighted breakdown.
  const rawScores: Record<string, number> = {
    signalStrength: scoreResult.signalStrength,
    timing:         scoreResult.timing,
    upside:         scoreResult.upside,
  };

  let totalScore = 0;
  const breakdown: Record<string, { raw: number; weight: number; weighted: number }> = {};

  for (const [dimension, weight] of Object.entries(weights)) {
    const raw      = rawScores[dimension] ?? 0.5;
    const weighted = parseFloat((raw * weight).toFixed(4));
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
 * 3. Upserts an Alert row (idempotent on re-runs).
 */
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
  const mapResult = await callLLM(MAPPER_CONFIG, MAPPER_SYSTEM_PROMPT, user, MapperSchema);

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

  // Upsert Alert — idempotent if MAP runs more than once.
  const alert = await prisma.alert.upsert({
    where:  { clusterId },
    update: { ticker: mapResult.ticker, totalScore: clusterScore.totalScore, thesis },
    create: { clusterId, ticker: mapResult.ticker, totalScore: clusterScore.totalScore, thesis },
  });

  console.log(
    `[Mapper] Alert generated → ticker=${alert.ticker}, ` +
    `score=${alert.totalScore}, thesis="${alert.thesis}" (id=${alert.id})`,
  );
}
