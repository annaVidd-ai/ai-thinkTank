import '../lib/env'; // loads .env with override:true — must be first

// Prepend local timestamp to every console.log / console.error line
const _log = console.log.bind(console);
const _err = console.error.bind(console);
const ts = () => new Date().toLocaleTimeString('en-GB', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
console.log   = (...a: unknown[]) => _log(`[${ts()}]`, ...a);
console.error = (...a: unknown[]) => _err(`[${ts()}]`, ...a);
import { prisma } from '../lib/prisma';
import { upsertEntities, type GraphPayload } from '../lib/graphOperations';
import { closeDriver } from '../lib/neo4j';
import {
  processAnalystTurn,
  processSkepticTurn,
  startDebate,
} from '../lib/debateManager';
import { runWeaverSweep } from '../lib/weaver';
import { processNarrativeScout } from '../lib/weaver';
import { processScore, processMap } from '../lib/quantManager';
import { callLLM } from '../lib/llmClient';
import { SCOUT_CONFIG } from '../lib/llmConfig';
import { ScoutSchema, getScoutSystemPrompt, getTemperature, buildScoutUser } from '../lib/prompts';

// ---------------------------------------------------------------------------
// Re-entrance guard — prevents overlapping async invocations under setInterval
// ---------------------------------------------------------------------------

let isProcessing = false;

async function processNextTask() {
  if (isProcessing) return;
  isProcessing = true;
  try {
    await _processNextTask();
  } finally {
    isProcessing = false;
  }
}

async function _processNextTask() {
  const task = await prisma.agentTask.findFirst({
    where:   { status: 'PENDING' },
    orderBy: { createdAt: 'asc' },
  });

  if (!task) return;

  console.log(`[Worker] Picked up task: ${task.type} (${task.id})`);

  await prisma.agentTask.update({
    where: { id: task.id },
    data:  { status: 'PROCESSING' },
  });

  try {
    let result = '';

    switch (task.type) {

      // ── Scout A — structure raw GitHub/on-chain data via GLM ─────────────
      case 'SCOUT': {
        console.log('-> Calling GLM (Scout) to structure raw data…');
        const rawPayload = task.payload;                   // raw data from upstream
        const user       = buildScoutUser(rawPayload);
        const structured = await callLLM(SCOUT_CONFIG, getScoutSystemPrompt(), user, ScoutSchema, getTemperature('scout'));

        // Convert nullable fields → undefined to satisfy GraphPayload type
        const graphPayload: GraphPayload = {
          events: structured.events,
          ...(structured.developer  != null && { developer:  structured.developer  }),
          ...(structured.wallet     != null && { wallet:     structured.wallet     }),
          ...(structured.repository != null && { repository: structured.repository }),
          ...(structured.contract   != null && { contract:   structured.contract   }),
        };

        result = JSON.stringify({ success: true, graphPayload });
        break;
      }

      // ── Orchestrate — write entities to Neo4j graph ───────────────────────
      case 'ORCHESTRATE': {
        const graphPayload = JSON.parse(task.payload) as GraphPayload;
        console.log('-> Writing entities to Neo4j…');
        await upsertEntities(graphPayload);
        result = JSON.stringify({ success: true, action: 'inserted to graph' });
        break;
      }

      // ── Weaver density sweep ──────────────────────────────────────────────
      case 'WEAVER_SWEEP': {
        console.log('-> Running Weaver density sweep…');
        const sweepResult = await runWeaverSweep();
        result = JSON.stringify({ success: true, ...sweepResult });
        break;
      }

      // ── Narrative scout — GLM produces narrative; debate is started ───────
      case 'SCOUT_NARRATIVE': {
        const { clusterId } = JSON.parse(task.payload) as { clusterId: string };

        const cluster = await prisma.cluster.update({
          where: { id: clusterId },
          data:  { status: 'NARRATIVE_SCOUTING' },
        });

        console.log(
          `-> Scouting narrative for cluster: ${cluster.assetId} (${cluster.assetType})`,
        );

        const narrativeContext = await processNarrativeScout(cluster);

        await prisma.cluster.update({
          where: { id: clusterId },
          data:  { status: 'DEBATING' },
        });

        const debateId = await startDebate(clusterId, narrativeContext);
        result = JSON.stringify({ success: true, debateId });
        break;
      }

      // ── Quant score ───────────────────────────────────────────────────────
      case 'SCORE': {
        const { clusterId } = JSON.parse(task.payload) as { clusterId: string };
        console.log(`-> Running Quant scoring for cluster ${clusterId}…`);
        await processScore(clusterId);
        result = JSON.stringify({ success: true });
        break;
      }

      // ── Asset mapper ──────────────────────────────────────────────────────
      case 'MAP': {
        const { clusterId } = JSON.parse(task.payload) as { clusterId: string };
        console.log(`-> Running Mapper for cluster ${clusterId}…`);
        await processMap(clusterId);
        result = JSON.stringify({ success: true });
        break;
      }

      // ── Analyze (legacy stub) ─────────────────────────────────────────────
      case 'ANALYZE':
        console.log('-> Calling DeepSeek-R1…');
        result = JSON.stringify({ success: true, score: 95, thesis: 'Bullish' });
        break;

      // ── Debate turns ──────────────────────────────────────────────────────
      case 'DEBATE_ANALYST': {
        const { debateId } = JSON.parse(task.payload) as { debateId: string };
        await processAnalystTurn(debateId);
        result = JSON.stringify({ success: true });
        break;
      }

      case 'DEBATE_SKEPTIC': {
        const { debateId } = JSON.parse(task.payload) as { debateId: string };
        await processSkepticTurn(debateId);
        result = JSON.stringify({ success: true });
        break;
      }

      default:
        throw new Error(`Unknown task type: ${task.type}`);
    }

    await prisma.agentTask.update({
      where: { id: task.id },
      data:  { status: 'COMPLETED', result },
    });
    console.log(`[Worker] Completed task: ${task.id}\n`);

  } catch (error) {
    console.error(`[Worker] Failed task: ${task.id}`, error);
    await prisma.agentTask.update({
      where: { id: task.id },
      data:  { status: 'FAILED', result: String(error) },
    });
  }
}

console.log('[Worker] Started polling every 5 s…');
setInterval(processNextTask, 5000);

process.on('SIGINT', async () => {
  console.log('[Worker] Shutting down…');
  await closeDriver();
  await prisma.$disconnect();
  process.exit(0);
});
