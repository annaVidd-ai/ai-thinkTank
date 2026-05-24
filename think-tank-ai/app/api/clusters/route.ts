import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const take = Math.min(parseInt(searchParams.get('take') ?? '50', 10), 500);

  const clusters = await db.cluster.findMany({
    orderBy: { createdAt: 'desc' },
    take,
    include: {
      scores: {
        orderBy: { createdAt: 'desc' },
        take: 1,
      },
      alert: { select: { ticker: true, totalScore: true } },
      debates: {
        orderBy: { createdAt: 'desc' },
        take: 1,
        select: { id: true, status: true, currentRound: true, verdict: true, createdAt: true },
      },
    },
  });

  return NextResponse.json(clusters);
}
