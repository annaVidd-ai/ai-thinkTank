import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET() {
  const configs = await db.scoringConfig.findMany({ orderBy: { name: 'asc' } });
  return NextResponse.json(configs);
}

export async function PUT(req: Request) {
  const body = await req.json();
  const { id, weights, alertThreshold, isActive, name } = body;

  if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 });

  const updated = await db.scoringConfig.update({
    where: { id },
    data: {
      ...(name !== undefined && { name }),
      ...(weights !== undefined && { weights: JSON.stringify(weights) }),
      ...(alertThreshold !== undefined && { alertThreshold }),
      ...(isActive !== undefined && { isActive }),
    },
  });

  return NextResponse.json(updated);
}
