import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  const clusters = await db.cluster.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      scores: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
      alert: { select: { ticker: true, totalScore: true } },
      debates: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { id: true, status: true, currentRound: true, verdict: true },
      },
    },
  });

  return NextResponse.json(clusters);
}
