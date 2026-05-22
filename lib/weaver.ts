import { prisma } from './prisma';
import { findNewClusters } from './graphOperations';
import { callLLM } from './llmClient';
import { NARRATIVE_CONFIG } from './llmConfig';
import {
  NarrativeSchema,
  NARRATIVE_SYSTEM_PROMPT,
  buildNarrativeUser,
} from './prompts';

export interface WeaverSweepResult {
  detected: number;
  skipped:  number;
}

// ---------------------------------------------------------------------------
// Narrative scout
// ---------------------------------------------------------------------------

/**
 * Calls GLM to produce a narrative summary for a newly detected cluster.
 * Returns the summary string that is passed to startDebate() as narrativeContext.
 */
export async function processNarrativeScout(cluster: {
  id:        string;
  assetId:   string;
  assetType: string;
}): Promise<string> {
  const user   = buildNarrativeUser(cluster.assetId, cluster.assetType);
  const result = await callLLM(NARRATIVE_CONFIG, NARRATIVE_SYSTEM_PROMPT, user, NarrativeSchema);

  console.log(
    `[Narrative] ${cluster.assetId} → ` +
    `mentions=${result.mentions}, sentiment=${result.sentiment}`,
  );

  return result.summary;
}

// ---------------------------------------------------------------------------
// Weaver sweep
// ---------------------------------------------------------------------------

/**
 * Runs the Weaver density sweep:
 * 1. Queries Neo4j for high-density cross-asset clusters.
 * 2. For each result, skips assets already tracked in an active Cluster row.
 * 3. Creates a new Cluster record and queues a SCOUT_NARRATIVE task.
 */
export async function runWeaverSweep(): Promise<WeaverSweepResult> {
  const candidates = await findNewClusters();

  let detected = 0;
  let skipped  = 0;

  for (const c of candidates) {
    // Deduplicate — skip if this asset is already in an active pipeline stage.
    const existing = await prisma.cluster.findFirst({
      where: {
        assetId: c.assetId,
        status:  { in: ['DETECTED', 'NARRATIVE_SCOUTING', 'DEBATING'] },
      },
    });

    if (existing) {
      console.log(`[Weaver] Skipping already-tracked asset: ${c.assetId}`);
      skipped++;
      continue;
    }

    // Derive the most specific label (strip the base 'Asset' label).
    const assetType = c.assetLabels.find((l) => l !== 'Asset') ?? 'Unknown';

    const cluster = await prisma.cluster.create({
      data: { assetId: c.assetId, assetType, status: 'DETECTED' },
    });

    await prisma.agentTask.create({
      data: {
        type:    'SCOUT_NARRATIVE',
        status:  'PENDING',
        payload: JSON.stringify({ clusterId: cluster.id }),
      },
    });

    console.log(
      `[Weaver] New cluster detected → ${c.assetId} (${assetType}) ` +
      `elites=${c.eliteCount}, crossAssets=${c.crossAssets}, clusterId=${cluster.id}`,
    );
    detected++;
  }

  console.log(`[Weaver] Sweep complete — detected=${detected}, skipped=${skipped}`);
  return { detected, skipped };
}
