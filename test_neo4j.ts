import './lib/env'; // loads .env with override:true
import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { getDriver, closeDriver } from './lib/neo4j';
import type { GraphPayload } from './lib/graphOperations';

const adapter = new PrismaBetterSqlite3({ url: 'file:./dev.db' });
const prisma = new PrismaClient({ adapter });

const ORCHESTRATE_PAYLOAD: GraphPayload = {
  developer: {
    id: '0xAlice',
    name: '0xAlice',
    isElite: true,
  },
  repository: {
    id: 'owner/defi-v2',
    url: 'https://github.com/owner/defi-v2',
  },
  events: [
    {
      type: 'STARRED',
      actorId: '0xAlice',
      assetId: 'owner/defi-v2',
      createdAt: new Date().toISOString(),
    },
  ],
};

async function waitForTask(taskId: string, timeoutMs = 30_000): Promise<string> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const task = await prisma.agentTask.findUnique({ where: { id: taskId } });
    if (task?.status === 'COMPLETED') return 'COMPLETED';
    if (task?.status === 'FAILED') {
      console.error('[Test] Task failed. Result:', task.result);
      return 'FAILED';
    }
    await new Promise((r) => setTimeout(r, 2_000));
  }
  return 'TIMEOUT';
}

async function verifyNeo4j(): Promise<void> {
  const driver = getDriver();
  const session = driver.session();
  try {
    const result = await session.executeRead((tx) =>
      tx.run(
        `MATCH (d:Actor:Developer:Elite {id: $devId})-[r:STARRED]->(repo:Asset:Repository {id: $repoId})
         RETURN d.id AS devId, d.name AS devName, labels(d) AS devLabels,
                r.createdAt AS edgeCreatedAt,
                repo.id AS repoId, repo.url AS repoUrl, labels(repo) AS repoLabels`,
        { devId: '0xAlice', repoId: 'owner/defi-v2' }
      )
    );

    if (result.records.length === 0) {
      throw new Error('Verification FAILED: no matching nodes/edges found in AuraDB');
    }

    const rec = result.records[0];
    console.log('\n[Verify] ✓ Developer node:');
    console.log('  id     :', rec.get('devId'));
    console.log('  name   :', rec.get('devName'));
    console.log('  labels :', rec.get('devLabels'));
    console.log('[Verify] ✓ STARRED edge:');
    console.log('  createdAt:', rec.get('edgeCreatedAt'));
    console.log('[Verify] ✓ Repository node:');
    console.log('  id    :', rec.get('repoId'));
    console.log('  url   :', rec.get('repoUrl'));
    console.log('  labels:', rec.get('repoLabels'));
    console.log('\n[Verify] All nodes and edges confirmed in AuraDB.\n');
  } finally {
    await session.close();
  }
}

async function main() {
  // 1. Inject task
  const task = await prisma.agentTask.create({
    data: {
      type: 'ORCHESTRATE',
      status: 'PENDING',
      payload: JSON.stringify(ORCHESTRATE_PAYLOAD),
    },
  });
  console.log(`[Test] Inserted ORCHESTRATE task: ${task.id}`);
  console.log('[Test] Waiting for worker to process it (max 30s)...');

  // 2. Wait for the running worker to pick it up
  const status = await waitForTask(task.id);

  if (status !== 'COMPLETED') {
    console.error(`[Test] Task ended with status: ${status}`);
    process.exitCode = 1;
    return;
  }
  console.log('[Test] Task COMPLETED.');

  // 3. Verify data landed in Neo4j
  await verifyNeo4j();
}

main()
  .catch((e) => {
    console.error('[Test] Unexpected error:', e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await closeDriver();
  });
