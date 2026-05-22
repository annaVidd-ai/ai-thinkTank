/**
 * End-to-end pipeline test:
 *   WEAVER_SWEEP → SCOUT_NARRATIVE → DEBATE (3 rounds) → SCORE → MAP → Alert
 *
 * Fully idempotent — deletes any stale cluster for the test asset before
 * running so the test can be re-executed cleanly.
 *
 * Requires the worker to be running in a separate terminal:
 *   npx tsx worker/index.ts
 */
import './lib/env'; // loads .env with override:true
import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { upsertEntities } from './lib/graphOperations';
import { closeDriver } from './lib/neo4j';

const adapter = new PrismaBetterSqlite3({ url: 'file:./dev.db' });
const prisma = new PrismaClient({ adapter });

const TEST_ASSET_ID = 'owner/defi-v2';
const POLL_MS       = 5_000;
const TIMEOUT_MS    = 600_000; // 10 min — DeepSeek-R1 reasoning model can take 30–60 s per turn

// ---------------------------------------------------------------------------
// Neo4j seed (self-contained — safe to call on any graph state)
// ---------------------------------------------------------------------------

async function seedNeo4j() {
  console.log('[Seed] Seeding Neo4j...');

  await upsertEntities({
    developer:  { id: '0xAlice', name: '0xAlice', isElite: true },
    repository: { id: 'owner/defi-v2', url: 'https://github.com/owner/defi-v2' },
    events: [{ type: 'STARRED', actorId: '0xAlice', assetId: 'owner/defi-v2', createdAt: new Date().toISOString() }],
  });

  await upsertEntities({
    developer:  { id: '0xBob', name: '0xBob', isElite: true },
    repository: { id: 'owner/defi-v2', url: 'https://github.com/owner/defi-v2' },
    events: [{ type: 'STARRED', actorId: '0xBob', assetId: 'owner/defi-v2', createdAt: new Date().toISOString() }],
  });

  await upsertEntities({
    developer:  { id: '0xAlice', name: '0xAlice', isElite: true },
    repository: { id: 'owner/another-protocol', url: 'https://github.com/owner/another-protocol' },
    events: [{ type: 'STARRED', actorId: '0xAlice', assetId: 'owner/another-protocol', createdAt: new Date().toISOString() }],
  });

  console.log('[Seed] Done.');
}

// ---------------------------------------------------------------------------
// SQLite cleanup
// ---------------------------------------------------------------------------

async function resetTestCluster() {
  // Cascade deletes: Debate → DebateMessage, ClusterScore, Alert
  const deleted = await prisma.cluster.deleteMany({ where: { assetId: TEST_ASSET_ID } });
  if (deleted.count > 0) {
    console.log(`[Setup] Removed ${deleted.count} stale cluster(s) (cascade) for "${TEST_ASSET_ID}"`);
  }
}

// ---------------------------------------------------------------------------
// Polling helpers
// ---------------------------------------------------------------------------

async function waitForCluster(after: Date): Promise<string> {
  const deadline = Date.now() + TIMEOUT_MS;
  while (Date.now() < deadline) {
    const c = await prisma.cluster.findFirst({
      where: { assetId: TEST_ASSET_ID, createdAt: { gte: after } },
      orderBy: { createdAt: 'desc' },
    });
    if (c) return c.id;
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  throw new Error('Timed out waiting for Cluster');
}

async function waitForDebateCompleted(clusterId: string): Promise<string> {
  const deadline = Date.now() + TIMEOUT_MS;
  while (Date.now() < deadline) {
    // Accept both COMPLETED (agreed) and ESCALATED (deadlocked) — both always inject SCORE
    const debate = await prisma.debate.findFirst({
      where: { clusterId, status: { in: ['COMPLETED', 'ESCALATED'] } },
      orderBy: { createdAt: 'desc' },
    });
    if (debate) return debate.id;
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  throw new Error('Timed out waiting for Debate to reach terminal status (COMPLETED or ESCALATED)');
}

async function waitForAlert(clusterId: string): Promise<void> {
  const deadline = Date.now() + TIMEOUT_MS;
  while (Date.now() < deadline) {
    const alert = await prisma.alert.findFirst({ where: { clusterId } });

    if (alert) {
      const cluster = await prisma.cluster.findUniqueOrThrow({ where: { id: clusterId } });
      const score   = await prisma.clusterScore.findFirst({
        where:   { clusterId },
        orderBy: { createdAt: 'desc' },
        include: { config: true },
      });

      console.log('\n╔══════════════════════════════════════════════════════╗');
      console.log('║           FULL PIPELINE — FINAL ALERT                ║');
      console.log('╠══════════════════════════════════════════════════════╣');
      console.log(`║  Cluster   : ${cluster.assetId.padEnd(38)} ║`);
      console.log(`║  AssetType : ${cluster.assetType.padEnd(38)} ║`);
      console.log(`║  Status    : ${cluster.status.padEnd(38)} ║`);
      console.log('╠══════════════════════════════════════════════════════╣');
      console.log(`║  Ticker    : ${alert.ticker.padEnd(38)} ║`);
      console.log(`║  Score     : ${String(alert.totalScore).padEnd(38)} ║`);
      console.log(`║  Thesis    : ${alert.thesis.padEnd(38)} ║`);
      console.log(`║  Alert ID  : ${alert.id.padEnd(38)} ║`);
      console.log('╠══════════════════════════════════════════════════════╣');
      if (score) {
        const bd = JSON.parse(score.breakdown) as Record<string, { raw: number; weight: number; weighted: number }>;
        console.log('║  Score Breakdown:                                    ║');
        for (const [dim, v] of Object.entries(bd)) {
          const line = `  ${dim}: raw=${v.raw} × w=${v.weight} = ${v.weighted}`;
          console.log(`║${line.padEnd(52)} ║`);
        }
        console.log(`║  Config    : ${score.config.name.padEnd(38)} ║`);
      }
      console.log('╚══════════════════════════════════════════════════════╝\n');
      return;
    }

    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  throw new Error('Timed out waiting for Alert');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  await seedNeo4j();
  await resetTestCluster();

  const sweepStartedAt = new Date();

  const sweepTask = await prisma.agentTask.create({
    data: { type: 'WEAVER_SWEEP', status: 'PENDING', payload: JSON.stringify({}) },
  });

  console.log(`\n[Test] WEAVER_SWEEP injected: ${sweepTask.id}`);
  console.log('[Test] Running full pipeline — SWEEP → NARRATIVE → DEBATE → SCORE → MAP');
  console.log('[Test] (Worker must be running: npx tsx worker/index.ts)\n');

  const clusterId = await waitForCluster(sweepStartedAt);
  console.log(`[Test] ✓ Cluster detected: ${clusterId}`);

  const debateId = await waitForDebateCompleted(clusterId);
  console.log(`[Test] ✓ Debate resolved: ${debateId}`);

  await waitForAlert(clusterId);
}

main()
  .catch((e) => {
    console.error('[Test] Fatal error:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await closeDriver();
  });
