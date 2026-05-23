import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  const alerts = await db.alert.findMany({
    orderBy: { createdAt: 'desc' },
    include: {
      cluster: {
        select: { assetId: true, assetType: true, status: true },
      },
    },
  });

  return NextResponse.json(alerts);
}
