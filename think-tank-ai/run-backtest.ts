/**
 * Backtest CLI entry point
 *
 * Usage:
 *   npx tsx run-backtest.ts                                  # all cases, both types, 3 runs
 *   npx tsx run-backtest.ts --cases UNI,LINK                 # specific cases only
 *   npx tsx run-backtest.ts --type blinded                   # blinded runs only
 *   npx tsx run-backtest.ts --type unblinded                 # unblinded runs only
 *   npx tsx run-backtest.ts --cases UNI --runs 1             # quick single-case smoke test
 *   npx tsx run-backtest.ts --report-only                    # print report from existing DB data
 *
 * Prerequisites:
 *   1. Worker running:  npm run worker:start
 *   2. Cases seeded:    npx tsx prisma/seed-backtest.ts
 *   3. DB has schema:   npx prisma db push
 */

import './lib/env'; // loads .env with override:true — must be first import

// Prepend local timestamp to every console.log / console.error line
const _log = console.log.bind(console);
const _err = console.error.bind(console);
const ts = () => { const n = new Date(); return `[${n.toLocaleDateString('en-CA')}][${n.toLocaleTimeString('en-GB', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' })}]`; };
console.log   = (...a: unknown[]) => _log(ts(), ...a);
console.error = (...a: unknown[]) => _err(ts(), ...a);

import { prisma }                    from './lib/prisma';
import { runWalkForwardValidation }  from './lib/backtest/walkForward';
import { generateBiasReport, printBiasReport } from './lib/backtest/report';
import { closeDriver }               from './lib/neo4j';
import fs                            from 'fs';

// ---------------------------------------------------------------------------
// CLI argument parser
// ---------------------------------------------------------------------------

function parseArgs() {
  const args    = process.argv.slice(2);
  const parsed  = {
    cases:      [] as string[],
    type:       'both' as 'both' | 'blinded' | 'unblinded',
    runs:       3,
    reportOnly: false,
  };

  for (let i = 0; i < args.length; i++) {
    const arg  = args[i];
    const next = args[i + 1];

    if (arg === '--cases' && next) {
      parsed.cases = next.split(',').map((s) => s.trim().toUpperCase());
      i++;
    } else if (arg === '--type' && next) {
      if (next === 'blinded' || next === 'unblinded' || next === 'both') {
        parsed.type = next;
      } else {
        console.error(`[CLI] Unknown --type value "${next}". Use: blinded | unblinded | both`);
        process.exit(1);
      }
      i++;
    } else if (arg === '--runs' && next) {
      const n = parseInt(next, 10);
      if (isNaN(n) || n < 1) {
        console.error(`[CLI] --runs must be a positive integer, got "${next}"`);
        process.exit(1);
      }
      parsed.runs = n;
      i++;
    } else if (arg === '--report-only') {
      parsed.reportOnly = true;
    } else if (arg === '--help' || arg === '-h') {
      printHelp();
      process.exit(0);
    }
  }

  return parsed;
}

function printHelp() {
  console.log(`
Backtest Engine — Walk-Forward Validation

Usage:
  npx tsx run-backtest.ts [options]

Options:
  --cases  UNI,LINK      Comma-separated ticker list (default: all 12 cases)
  --type   blinded|unblinded|both   Run type (default: both)
  --runs   N             Number of runs per case (default: 3)
  --report-only          Skip running — print report from existing DB data only
  --help                 Show this help

Examples:
  npx tsx run-backtest.ts --cases UNI --runs 1         # Quick smoke test
  npx tsx run-backtest.ts --type blinded               # All cases, blinded only
  npx tsx run-backtest.ts --cases GRT,AXS,MKR          # Validation split only
  npx tsx run-backtest.ts                              # Full suite (6-12 hours)
`);
}

// ---------------------------------------------------------------------------
// Worker guard
// ---------------------------------------------------------------------------

function checkWorkerRunning(): boolean {
  if (!fs.existsSync('.worker.pid')) return false;
  const pid = parseInt(fs.readFileSync('.worker.pid', 'utf-8').trim(), 10);
  try {
    process.kill(pid, 0); // signal 0 = check existence only
    return true;
  } catch {
    return false;
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs();

  console.log('\n╔══════════════════════════════════════════════════════╗');
  console.log('║          THINKTANK AI — BACKTEST ENGINE             ║');
  console.log('╚══════════════════════════════════════════════════════╝\n');

  // Report-only mode
  if (args.reportOnly) {
    console.log('[CLI] Report-only mode — skipping runs, reading existing DB data.\n');
    const summary = await generateBiasReport(undefined, args.runs);
    printBiasReport(summary);
    return;
  }

  // Verify worker is running
  if (!checkWorkerRunning()) {
    console.error(
      '[CLI] ⚠️  Worker is NOT running. Start it first:\n' +
      '       npm run worker:start\n' +
      'Then re-run the backtest.',
    );
    process.exit(1);
  }
  console.log('[CLI] ✓ Worker is running\n');

  // Verify cases are seeded
  const caseCount = await prisma.backtestCase.count();
  if (caseCount === 0) {
    console.error(
      '[CLI] ⚠️  No backtest cases in DB. Seed them first:\n' +
      '       npx tsx prisma/seed-backtest.ts',
    );
    process.exit(1);
  }
  console.log(`[CLI] ✓ ${caseCount} backtest cases loaded\n`);

  // Determine run types
  const runTypes: ('blinded' | 'unblinded')[] =
    args.type === 'both'      ? ['blinded', 'unblinded']
    : args.type === 'blinded' ? ['blinded']
    :                           ['unblinded'];

  // Run walk-forward validation
  await runWalkForwardValidation({
    tickerFilter: args.cases.length > 0 ? args.cases : undefined,
    numRuns:      args.runs,
    runTypes,
  });

  // Generate and print bias report
  console.log('\n[CLI] Generating bias report…\n');
  const summary = await generateBiasReport(undefined, args.runs);
  printBiasReport(summary);
}

main()
  .catch((e) => {
    console.error('[CLI] Fatal error:', e instanceof Error ? e.message : String(e));
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
    await closeDriver();
  });
