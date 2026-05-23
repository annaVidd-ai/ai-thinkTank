import { NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const debate = await db.debate.findUnique({
    where: { id },
    include: {
      messages: { orderBy: { createdAt: 'asc' } },
      cluster: { select: { assetId: true, assetType: true } },
    },
  });

  if (!debate) return NextResponse.json({ error: 'Not found' }, { status: 404 });
  return NextResponse.json(debate);
}
