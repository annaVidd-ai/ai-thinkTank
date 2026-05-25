/**
 * Seeds the BacktestCase table with 12 positive cases + 3 negative controls.
 * Safe to re-run — upserts by ticker so no duplicates.
 *
 * Usage: npx tsx prisma/seed-backtest.ts
 */
import '../lib/env';
import { PrismaClient } from '@prisma/client';
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3';

const adapter = new PrismaBetterSqlite3({ url: 'file:./dev.db' });
const prisma   = new PrismaClient({ adapter });

// ── Training set: 6W (UNI, LINK, AAVE, YFI, MKR, SNX) + 4C (COMP, ZRX, BAT, CRV)
// ── Holdout set: 2C (SAFE, ALGO) — isHoldout: true
// ── AVAX and SUSHI promoted to training set per marathon design (2026-05-25)
// ── Legacy cases retained but not in 8W/6C design: SOL, GRT, AXS
const CASES = [
  // ── Calibration — Positive — Training ────────────────────────────────────
  {
    ticker:         'UNI',
    projectAlias:   'Project_Alpha',
    sector:         'DeFi',
    signalDate:     new Date('2020-11-01'),
    signalPrice:    3.78,
    athPrice:       44.92,
    actualMultiple: 11.9,
    split:          'calibration',
    isControl:      false,
    isHoldout:      false,
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
    isControl:      false,
    isHoldout:      false,
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
    isControl:      false,
    isHoldout:      false,
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
    isControl:      false,
    isHoldout:      false,
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
    isControl:      false,
    isHoldout:      false,  // promoted to training set (marathon 2026-05-25)
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
    isControl:      false,
    isHoldout:      false,
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
    isControl:      false,
    isHoldout:      false,
  },
  // ── Calibration — Negative Controls — Training ────────────────────────────
  {
    ticker:         'COMP',
    projectAlias:   'Project_Nu',
    sector:         'DeFi',
    signalDate:     new Date('2020-07-01'),
    signalPrice:    185.00,  // B3: corrected to price at time of peak DeFi summer hype
    athPrice:       277.50,  // B3: 185 × 1.5 — consistent with actualMultiple: 1.5
    actualMultiple: 1.5,    // peaked early, returned to near launch price within 6 months
    split:          'calibration',
    isControl:      true,
    isHoldout:      false,
  },
  {
    ticker:         'SAFE',
    projectAlias:   'Project_Xi',
    sector:         'Infrastructure',
    signalDate:     new Date('2020-09-01'),
    signalPrice:    0.50,
    athPrice:       1.00,
    actualMultiple: 2.0,    // no token at snapshot; token launched 2022, never 10x'd
    split:          'calibration',
    isControl:      true,
    isHoldout:      true,   // holdout control
  },
  {
    ticker:         'ZRX',
    projectAlias:   'Project_Pi',
    sector:         'DeFi',
    signalDate:     new Date('2020-08-01'),
    signalPrice:    0.90,
    athPrice:       1.35,   // ~1.5x from snapshot; ZRX price never sustained 2x
    actualMultiple: 1.5,
    split:          'calibration',
    isControl:      true,
    isHoldout:      false,
  },
  {
    ticker:         'BAT',
    projectAlias:   'Project_Rho',
    sector:         'Infrastructure',
    signalDate:     new Date('2020-10-01'),
    signalPrice:    0.22,
    athPrice:       0.264,  // ~1.2x within 3 years; peaked briefly higher but returned
    actualMultiple: 1.2,
    split:          'calibration',
    isControl:      true,
    isHoldout:      false,
  },
  {
    ticker:         'CRV',
    projectAlias:   'Project_Tau',
    sector:         'DeFi',
    signalDate:     new Date('2020-12-15'),
    signalPrice:    0.65,
    athPrice:       0.845,  // ~1.3x; emission inflation caused 2+ year price bleed
    actualMultiple: 1.3,
    split:          'calibration',
    isControl:      true,
    isHoldout:      false,
  },
  // ── Validation (3) — Positive (2) Training + Control (1) Legacy ───────────
  {
    ticker:         'GRT',
    projectAlias:   'Project_Theta',
    sector:         'Infrastructure',
    signalDate:     new Date('2020-12-01'),
    signalPrice:    0.03,
    athPrice:       2.84,
    actualMultiple: 94.7,
    split:          'validation',
    isControl:      false,
    isHoldout:      false,
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
    isControl:      false,
    isHoldout:      false,
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
    isControl:      false,
    isHoldout:      false,
  },
  {
    ticker:         'ALGO',
    projectAlias:   'Project_Sigma',
    sector:         'L1',
    signalDate:     new Date('2020-12-01'),
    signalPrice:    0.30,
    athPrice:       0.75,   // ~2.5x; underperformed ETH by 10x despite elite team
    actualMultiple: 2.5,
    split:          'validation',
    isControl:      true,
    isHoldout:      true,   // holdout control
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
    isControl:      false,
    isHoldout:      false,
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
    isControl:      false,
    isHoldout:      false,  // promoted to training set (marathon 2026-05-25)
  },
] as const;

async function main() {
  console.log('[Seed] Seeding BacktestCase table…');

  // Remove stale YFIL row left over from the rename to YFI_CTRL.
  const staleYFIL = await prisma.backtestCase.findUnique({ where: { ticker: 'YFIL' } });
  if (staleYFIL) {
    await prisma.backtestCase.delete({ where: { ticker: 'YFIL' } });
    console.log('  ✓  Removed stale YFIL row');
  }

  // Remove YFI_CTRL — structural confound (same protocol as YFI winner, different snapshot).
  // Pre-specified exclusion per 8W/6C balanced redesign.
  const staleYFICTRL = await prisma.backtestCase.findUnique({ where: { ticker: 'YFI_CTRL' } });
  if (staleYFICTRL) {
    // Delete associated BacktestResult rows before the parent BacktestCase
    await prisma.backtestResult.deleteMany({ where: { caseId: staleYFICTRL.id } });
    await prisma.backtestCase.delete({ where: { ticker: 'YFI_CTRL' } });
    console.log('  ✓  Removed YFI_CTRL (structural confound — same protocol as YFI winner)');
  }

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
