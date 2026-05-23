import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

const adapter = new PrismaBetterSqlite3({ url: 'file:./dev.db' });
const prisma = new PrismaClient({ adapter });

async function main() {
  const task = await prisma.agentTask.create({
    data: {
      type: 'SCOUT',
      status: 'PENDING',
      payload: JSON.stringify({ repo: 'anthropics/claude-code', branch: 'main' }),
    },
  });
  console.log('[Test] Inserted SCOUT task:', task.id);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
