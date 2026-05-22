/**
 * Historical State Harvester
 *
 * Loads curated case data from lib/backtest/cases/{ticker}.json.
 * These files represent the graph / narrative state at T-7 (7 days before
 * the signal date) and are hand-authored from publicly known historical facts.
 *
 * The harvester does NOT rewind Neo4j — it reads from the curated JSON files
 * and formats them for the backtest runner.
 *
 * Optionally fetches the historical price from the Binance public klines API
 * at T-7. Falls back to the JSON-embedded priceAtSnapshot if the API call fails.
 */

import path from 'path';
import fs   from 'fs';
import { CasePayload } from './blinder';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface HistoricalState {
  ticker:       string;
  snapshotDate: string;      // ISO date string
  priceAtT7:    number;      // price 7 days before signal
  payload:      CasePayload; // full curated graph state (unblinded)
}

// Raw JSON file structure
interface RawCaseFile {
  ticker:              string;
  signalDate:          string;
  snapshotDate:        string;
  priceAtSnapshot:     number;
  developers: Array<{
    name:     string;
    isElite:  boolean;
    activity: string;
  }>;
  assets: Array<{
    name: string;
    type: string;
    url:  string;
  }>;
  events: Array<{
    type:   string;
    actor:  string;
    asset:  string;
    date:   string;
    amount?: number;
  }>;
  narrativeAtSnapshot: string;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Loads the curated historical state for a given ticker.
 * Optionally refreshes the price from Binance; falls back to file price.
 */
export async function harvestCase(
  ticker: string,
  fetchLivePrice = false,
): Promise<HistoricalState> {
  const raw    = loadCaseFile(ticker);
  let priceAtT7 = raw.priceAtSnapshot;

  if (fetchLivePrice) {
    try {
      priceAtT7 = await fetchHistoricalPrice(ticker, raw.snapshotDate);
    } catch (err) {
      console.warn(
        `[Harvester] Binance price fetch failed for ${ticker} at ${raw.snapshotDate} — ` +
        `using embedded price ${raw.priceAtSnapshot}. Error: ${(err as Error).message}`,
      );
    }
  }

  const payload: CasePayload = {
    developers:          raw.developers,
    assets:              raw.assets,
    events:              raw.events,
    narrativeAtSnapshot: raw.narrativeAtSnapshot,
  };

  return {
    ticker:       raw.ticker,
    snapshotDate: raw.snapshotDate,
    priceAtT7,
    payload,
  };
}

/**
 * Returns all available tickers that have a case JSON file.
 */
export function listAvailableTickers(): string[] {
  const casesDir = path.join(__dirname, 'cases');
  return fs
    .readdirSync(casesDir)
    .filter((f) => f.endsWith('.json'))
    .map((f)    => f.replace('.json', ''));
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadCaseFile(ticker: string): RawCaseFile {
  const filePath = path.join(__dirname, 'cases', `${ticker}.json`);
  if (!fs.existsSync(filePath)) {
    throw new Error(`[Harvester] No case file found for ticker "${ticker}" at ${filePath}`);
  }
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf-8')) as RawCaseFile;
  return raw;
}

/**
 * Fetches the daily open price for a token from Binance public klines API.
 * Uses the {ticker}USDT pair. Returns the open price of the kline at snapshotDate.
 */
async function fetchHistoricalPrice(ticker: string, snapshotDate: string): Promise<number> {
  const startMs = new Date(snapshotDate).getTime();
  const url     =
    `https://api.binance.com/api/v3/klines` +
    `?symbol=${ticker}USDT&interval=1d&startTime=${startMs}&limit=1`;

  const res = await fetch(url);
  if (!res.ok) {
    throw new Error(`Binance API error: ${res.status} ${res.statusText}`);
  }

  const data = (await res.json()) as unknown[][];
  if (!data || data.length === 0) {
    throw new Error(`No kline data returned for ${ticker}USDT at ${snapshotDate}`);
  }

  // kline format: [openTime, open, high, low, close, volume, ...]
  const openPrice = parseFloat(data[0][1] as string);
  if (isNaN(openPrice) || openPrice <= 0) {
    throw new Error(`Invalid price returned: ${data[0][1]}`);
  }

  return openPrice;
}
