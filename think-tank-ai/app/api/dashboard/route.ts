import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  const [totalTasks, processingTasks, completedTasks, failedTasks, totalClusters, totalAlerts] =
    await Promise.all([
      db.agentTask.count(),
      db.agentTask.count({ where: { status: 'PROCESSING' } }),
      db.agentTask.count({ where: { status: 'COMPLETED' } }),
      db.agentTask.count({ where: { status: 'FAILED' } }),
      db.cluster.count(),
      db.alert.count(),
    ]);

  const recentTasks = await db.agentTask.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: {
      id: true,
      type: true,
      status: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  return NextResponse.json({
    stats: { totalTasks, processingTasks, completedTasks, failedTasks, totalClusters, totalAlerts },
    recentTasks,
  });
}
