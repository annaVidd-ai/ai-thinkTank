/**
 * Seeds the BacktestCase table with 12 verified historical cases.
 * Safe to re-run — upserts by ticker so no duplicates.
 *
 * Usage: npx tsx prisma/seed-backtest.ts
 */
import '../lib/env';
import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

const adapter = new PrismaBetterSqlite3({ url: 'file:./dev.db' });
const prisma   = new PrismaClient({ adapter });

const CASES = [
  // ── Calibration (7) ──────────────────────────────────────────────────────
  {
    ticker:         'UNI',
    projectAlias:   'Project_Alpha',
    sector:         'DeFi',
    signalDate:     new Date('2020-11-01'),
    signalPrice:    3.78,
    athPrice:       44.92,
    actualMultiple: 11.9,
    split:          'calibration',
  },
  {
    ticker:         'LINK',
    projectAlias:   'Project_Beta',
    sector:         'Infrastructure',
    signalDate:     new Date('2019-05-01'),
    signalPrice:    0.48,
    athPrice:       52.70,
    actualMultiple: 109.8,
    split:          'calibration',
  },
  {
    ticker:         'AAVE',
    projectAlias:   'Project_Gamma',
    sector:         'DeFi',
    signalDate:     new Date('2020-10-01'),
    signalPrice:    28.00,
    athPrice:       661.69,
    actualMultiple: 23.6,
    split:          'calibration',
  },
  {
    ticker:         'SOL',
    projectAlias:   'Project_Delta',
    sector:         'L1',
    signalDate:     new Date('2021-01-01'),
    signalPrice:    1.51,
    athPrice:       293.31,
    actualMultiple: 194.2,
    split:          'calibration',
  },
  {
    ticker:         'AVAX',
    projectAlias:   'Project_Epsilon',
    sector:         'L1',
    signalDate:     new Date('2021-06-01'),
    signalPrice:    12.00,
    athPrice:       144.96,
    actualMultiple: 12.1,
    split:          'calibration',
  },
  {
    ticker:         'MATIC',
    projectAlias:   'Project_Zeta',
    sector:         'L2',
    signalDate:     new Date('2021-01-01'),
    signalPrice:    0.018,
    athPrice:       2.92,
    actualMultiple: 162.2,
    split:          'calibration',
  },
  {
    ticker:         'YFI',
    projectAlias:   'Project_Eta',
    sector:         'DeFi',
    signalDate:     new Date('2020-08-01'),
    signalPrice:    3000,
    athPrice:       90787,
    actualMultiple: 30.3,
    split:          'calibration',
  },
  // ── Validation (3) ───────────────────────────────────────────────────────
  {
    ticker:         'GRT',
    projectAlias:   'Project_Theta',
    sector:         'Infrastructure',
    signalDate:     new Date('2020-12-01'),
    signalPrice:    0.03,
    athPrice:       2.84,
    actualMultiple: 94.7,
    split:          'validation',
  },
  {
    ticker:         'AXS',
    projectAlias:   'Project_Iota',
    sector:         'Gaming',
    signalDate:     new Date('2021-01-01'),
    signalPrice:    0.54,
    athPrice:       164.90,
    actualMultiple: 305.4,
    split:          'validation',
  },
  {
    ticker:         'MKR',
    projectAlias:   'Project_Kappa',
    sector:         'DeFi',
    signalDate:     new Date('2020-10-01'),
    signalPrice:    500,
    athPrice:       6292,
    actualMultiple: 12.6,
    split:          'validation',
  },
  // ── Verification (2) ─────────────────────────────────────────────────────
  {
    ticker:         'SNX',
    projectAlias:   'Project_Lambda',
    sector:         'DeFi',
    signalDate:     new Date('2020-07-01'),
    signalPrice:    2.90,
    athPrice:       28.53,
    actualMultiple: 9.8,
    split:          'verification',
  },
  {
    ticker:         'SUSHI',
    projectAlias:   'Project_Mu',
    sector:         'DeFi',
    signalDate:     new Date('2020-10-01'),
    signalPrice:    0.55,
    athPrice:       23.38,
    actualMultiple: 42.5,
    split:          'verification',
  },
] as const;

async function main() {
  console.log('[Seed] Seeding BacktestCase table…');

  for (const c of CASES) {
    await prisma.backtestCase.upsert({
      where:  { ticker: c.ticker },
      update: c,
      create: c,
    });
    console.log(`  ✓  ${c.ticker} (${c.split}) — ${c.actualMultiple}x actual`);
  }

  const total = await prisma.backtestCase.count();
  console.log(`[Seed] Done. ${total} cases in DB.`);
}

main()
  .catch((e) => { console.error('[Seed] Error:', e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
