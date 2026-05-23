import './lib/env'; // loads .env with override:true
import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';
import { startDebate } from './lib/debateManager';

// Own client — this is a separate process from the worker.
const adapter = new PrismaBetterSqlite3({ url: 'file:./dev.db' });
const prisma = new PrismaClient({ adapter });

const POLL_INTERVAL_MS = 2_000;
const TIMEOUT_MS = 60_000;

async function waitForDebate(debateId: string): Promise<void> {
  const deadline = Date.now() + TIMEOUT_MS;

  while (Date.now() < deadline) {
    const debate = await prisma.debate.findUnique({ where: { id: debateId } });
    if (!debate) throw new Error(`Debate ${debateId} not found`);

    if (debate.status !== 'IN_PROGRESS') {
      // Fetch full message log
      const messages = await prisma.debateMessage.findMany({
        where: { debateId },
        orderBy: { createdAt: 'asc' },
      });

      console.log('\n══════════════════════════════════════════════');
      console.log(' DEBATE TRANSCRIPT');
      console.log('══════════════════════════════════════════════');
      for (const msg of messages) {
        const body = JSON.parse(msg.content) as { argument: string };
        console.log(`\n  [Round ${msg.round}] ${msg.role.padEnd(8)} → ${body.argument}`);
      }
      console.log('\n══════════════════════════════════════════════');
      console.log(` STATUS  : ${debate.status}`);
      console.log(` VERDICT : ${debate.verdict ?? 'n/a'}`);
      console.log('══════════════════════════════════════════════\n');
      return;
    }

    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }

  throw new Error(`Debate ${debateId} did not resolve within ${TIMEOUT_MS / 1000} s`);
}

async function main() {
  // Cluster is now a strict FK on Debate — create a real row first.
  const cluster = await prisma.cluster.create({
    data: { assetId: `test-asset-${Date.now()}`, assetType: 'Repository', status: 'DEBATING' },
  });

  const debateId = await startDebate(
    cluster.id,
    'Strong on-chain developer activity detected in defi-v2 ecosystem.'
  );

  console.log(`\n[Test] Debate ${debateId} queued. Waiting for worker to resolve it...`);
  console.log('[Test] (Make sure the worker is running: npx tsx worker/index.ts)\n');

  await waitForDebate(debateId);
}

main()
  .catch((e) => {
    console.error('[Test] Fatal error:', e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
