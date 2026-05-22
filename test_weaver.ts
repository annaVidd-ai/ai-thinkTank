/**
 * End-to-end test for the Weaver cascade:
 *   WEAVER_SWEEP → SCOUT_NARRATIVE → DEBATE_ANALYST (×3) ↔ DEBATE_SKEPTIC (×3) → COMPLETED
 *
 * Seeds Neo4j with two Elite actors both connected to "owner/defi-v2",
 * plus a cross-asset edge so the density query triggers a cluster hit.
 *
 * Idempotent: deletes any pre-existing active cluster for the test asset
 * so the test can be re-run cleanly without resetting the whole database.
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
const POLL_MS = 2_000;
const TIMEOUT_MS = 90_000;

// ---------------------------------------------------------------------------
// Seed Neo4j (fully self-contained — no dependency on prior test runs)
// ---------------------------------------------------------------------------

async function seedNeo4j() {
  console.log('[Seed] Writing test graph data to Neo4j...');

  // Seed 0xAlice (Elite Dev) → owner/defi-v2.
  // MERGE is idempotent — safe to call even if Alice already exists.
  await upsertEntities({
    developer: { id: '0xAlice', name: '0xAlice', isElite: true },
    repository: { id: 'owner/defi-v2', url: 'https://github.com/owner/defi-v2' },
    events: [
      {
        type: 'STARRED',
        actorId: '0xAlice',
        assetId: 'owner/defi-v2',
        createdAt: new Date().toISOString(),
      },
    ],
  });

  // Seed 0xBob (second Elite Dev) → owner/defi-v2.
  // This brings Elite inbound count to 2, satisfying the cluster threshold.
  await upsertEntities({
    developer: { id: '0xBob', name: '0xBob', isElite: true },
    repository: { id: 'owner/defi-v2', url: 'https://github.com/owner/defi-v2' },
    events: [
      {
        type: 'STARRED',
        actorId: '0xBob',
        assetId: 'owner/defi-v2',
        createdAt: new Date().toISOString(),
      },
    ],
  });

  // Seed cross-asset edge: 0xAlice also stars owner/another-protocol.
  // Including Alice's developer node here makes the seed self-contained —
  // the MATCH for the STARRED edge requires the Actor node to exist first.
  await upsertEntities({
    developer: { id: '0xAlice', name: '0xAlice', isElite: true },
    repository: {
      id: 'owner/another-protocol',
      url: 'https://github.com/owner/another-protocol',
    },
    events: [
      {
        type: 'STARRED',
        actorId: '0xAlice',
        assetId: 'owner/another-protocol',
        createdAt: new Date().toISOString(),
      },
    ],
  });

  console.log(
    '[Seed] Done. Graph: 0xAlice + 0xBob → owner/defi-v2, 0xAlice → owner/another-protocol'
  );
}

// ---------------------------------------------------------------------------
// SQLite cleanup — makes the test re-runnable without a full DB reset
// ---------------------------------------------------------------------------

async function resetTestCluster() {
  // Delete any prior cluster for the test asset so the Weaver can detect it fresh.
  // Debates and DebateMessages cascade-delete automatically (onDelete: Cascade).
  const deleted = await prisma.cluster.deleteMany({
    where: { assetId: TEST_ASSET_ID },
  });
  if (deleted.count > 0) {
    console.log(`[Setup] Removed ${deleted.count} stale cluster(s) (+ debates) for "${TEST_ASSET_ID}"`);
  }
}

// ---------------------------------------------------------------------------
// Polling helpers
// ---------------------------------------------------------------------------

/**
 * Waits for the Weaver to create a NEW Cluster for TEST_ASSET_ID.
 * Uses `createdAfter` to distinguish new clusters from pre-existing ones.
 */
async function waitForCluster(createdAfter: Date, timeoutMs = TIMEOUT_MS): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const cluster = await prisma.cluster.findFirst({
      where: { assetId: TEST_ASSET_ID, createdAt: { gte: createdAfter } },
      orderBy: { createdAt: 'desc' },
    });
    if (cluster) return cluster.id;
    await new Promise((r) => setTimeout(r, POLL_MS));
  }
  throw new Error(`Timed out waiting for Cluster "${TEST_ASSET_ID}" to be created`);
}

async function waitForDebate(clusterId: string, timeoutMs = TIMEOUT_MS): Promise<void> {
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const debate = await prisma.debate.findFirst({
      where: { clusterId },
      orderBy: { createdAt: 'desc' },
    });

    if (debate && debate.status !== 'IN_PROGRESS') {
      const messages = await prisma.debateMessage.findMany({
        where: { debateId: debate.id },
        orderBy: { createdAt: 'asc' },
      });

      const cluster = await prisma.cluster.findUniqueOrThrow({ where: { id: clusterId } });

      console.log('\n══════════════════════════════════════════════════════');
      console.log(' WEAVER CASCADE — FINAL REPORT');
      console.log('══════════════════════════════════════════════════════');
      console.log(` Cluster  : ${cluster.assetId} (${cluster.assetType})`);
      console.log(` Status   : ${cluster.status}`);
      console.log(` Debate   : ${debate.id}`);
      console.log('\n DEBATE TRANSCRIPT:');
      for (const msg of messages) {
        const body = JSON.parse(msg.content) as { argument: string };
        console.log(`\n  [R${msg.round}] ${msg.role.padEnd(8)} → ${body.argument}`);
      }
      console.log('\n══════════════════════════════════════════════════════');
      console.log(` DEBATE STATUS  : ${debate.status}`);
      console.log(` VERDICT        : ${debate.verdict ?? 'n/a'}`);
      console.log('══════════════════════════════════════════════════════\n');
      return;
    }

    await new Promise((r) => setTimeout(r, POLL_MS));
  }

  throw new Error('Timed out waiting for Debate to resolve');
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  await seedNeo4j();
  await resetTestCluster();

  const sweepStartedAt = new Date();

  const sweepTask = await prisma.agentTask.create({
    data: {
      type: 'WEAVER_SWEEP',
      status: 'PENDING',
      payload: JSON.stringify({}),
    },
  });

  console.log(`\n[Test] WEAVER_SWEEP task injected: ${sweepTask.id}`);
  console.log('[Test] Waiting for the full cascade to complete (max 90 s)...');
  console.log('[Test] (Worker must be running: npx tsx worker/index.ts)\n');

  // Wait for the Weaver to detect and register a fresh cluster.
  const clusterId = await waitForCluster(sweepStartedAt);
  console.log(`[Test] ✓ New cluster created: ${clusterId}`);

  // Wait for the full debate cascade spawned by SCOUT_NARRATIVE.
  await waitForDebate(clusterId);
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
