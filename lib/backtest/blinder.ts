/**
 * Hindsight Blinder
 *
 * Replaces all identifying information in backtest payloads and narrative text
 * with neutral aliases so the LLM cannot use its training knowledge to "know"
 * which project succeeded. Without blinding, the backtest is meaningless.
 *
 * Blinding covers:
 *   0. Dates → relative offsets from snapshot (A1)
 *   1. Project names and variations (case-insensitive)
 *   2. Actor/developer names
 *   3. Token ticker symbols (prefixed and bare, case-insensitive — A2)
 *   4. GitHub organisations and repo paths
 *   5. URLs and domains
 *   6. Block explorer addresses (expanded pattern — C6)
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AliasEntry {
  alias:        string;                    // e.g. "Project_Alpha"
  tokenAlias:   string;                    // e.g. "$TOKEN_A"
  projectNames: string[];                  // all name variants to replace
  domains:      string[];                  // project-specific domains
  githubOrgs:   string[];                  // GitHub org names
  actorAliases: Record<string, string>;    // "Real Name" → "Dev_XX"
}

export type AliasMap = Record<string, AliasEntry>;   // keyed by ticker

/** Minimal graph-like payload used by the runner */
export interface CaseDeveloper {
  name:     string;
  isElite:  boolean;
  activity: string;
}

export interface CaseAsset {
  name: string;
  type: string;
  url:  string;
}

export interface CaseEvent {
  type:   string;
  actor:  string;
  asset:  string;
  date:   string;
  amount?: number;
}

export interface CasePayload {
  developers: CaseDeveloper[];
  assets:     CaseAsset[];
  events:     CaseEvent[];
  narrativeAtSnapshot: string;
}

export interface BlindedPayload {
  developers: CaseDeveloper[];
  assets:     CaseAsset[];
  events:     CaseEvent[];
  narrativeAtSnapshot: string;
}

// ---------------------------------------------------------------------------
// Date anonymisation helpers (A1)
// ---------------------------------------------------------------------------

const MONTHS_FULL = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
];
const MONTHS_ABBR = [
  'Jan','Feb','Mar','Apr','May','Jun',
  'Jul','Aug','Sep','Oct','Nov','Dec',
];

/**
 * Returns a human-readable relative label for `targetDate` with respect to `snapshot`.
 * - Within 30 days:  "T-15d" / "T+3d"
 * - Within 1 year:   "~2 months before snapshot" / "~1 month after snapshot"
 * - Beyond 1 year:   "~2 years before snapshot" / "~1 year after snapshot"
 */
function relativeLabel(targetDate: Date, snapshot: Date): string {
  const diffMs   = snapshot.getTime() - targetDate.getTime();
  const diffDays = Math.round(diffMs / (1_000 * 60 * 60 * 24));
  const absDays  = Math.abs(diffDays);

  if (absDays === 0) return 'at snapshot';

  if (absDays <= 30) {
    const sign = diffDays > 0 ? '-' : '+';
    return `T${sign}${absDays}d`;
  }

  if (absDays <= 365) {
    const months = Math.round(absDays / 30.44);
    const dir    = diffDays > 0 ? 'before' : 'after';
    return `~${months} month${months === 1 ? '' : 's'} ${dir} snapshot`;
  }

  const years = Math.round(absDays / 365.25);
  const dir   = diffDays > 0 ? 'before' : 'after';
  return `~${years} year${years === 1 ? '' : 's'} ${dir} snapshot`;
}

/**
 * Replaces date references in `text` with relative labels from `snapshot`.
 * Processes patterns most-specific first to avoid double-replacement:
 *   1. ISO dates (YYYY-MM-DD)
 *   2. Full month + year  ("August 2020")
 *   3. Abbreviated month + year  ("Aug 2020")
 *   4. Quarter + year  ("Q3 2020")
 *   5. Season + year  ("Summer 2020")
 *   6. Month + day, no year  ("August 10", "July 17th")
 *   7. Bare 4-digit year  ("2020")
 */
function blindDates(text: string, snapshot: Date): string {
  let result = text;

  // 1. ISO dates
  result = result.replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, (_m, y, mo, d) => {
    const date = new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d)));
    return relativeLabel(date, snapshot);
  });

  // 2. Full month name + 4-digit year
  const fullMonthRe = new RegExp(
    `\\b(${MONTHS_FULL.join('|')})\\s+(\\d{4})\\b`, 'gi',
  );
  result = result.replace(fullMonthRe, (_m, month: string, year: string) => {
    const idx  = MONTHS_FULL.findIndex((m) => m.toLowerCase() === month.toLowerCase());
    const date = new Date(Date.UTC(Number(year), idx, 1));
    return relativeLabel(date, snapshot);
  });

  // 3. Abbreviated month + 4-digit year  ("Aug 2020", "Nov. 2019")
  const abbrMonthRe = new RegExp(
    `\\b(${MONTHS_ABBR.join('|')})\\.?\\s+(\\d{4})\\b`, 'gi',
  );
  result = result.replace(abbrMonthRe, (_m, month: string, year: string) => {
    const normalized = month.replace('.', '').toLowerCase().slice(0, 3);
    const idx  = MONTHS_ABBR.findIndex((m) => m.toLowerCase() === normalized);
    const date = new Date(Date.UTC(Number(year), idx < 0 ? 0 : idx, 1));
    return relativeLabel(date, snapshot);
  });

  // 4. Quarter + year  ("Q3 2020")
  result = result.replace(/\bQ([1-4])\s+(\d{4})\b/gi, (_m, q: string, year: string) => {
    const monthStart = (Number(q) - 1) * 3;
    const date = new Date(Date.UTC(Number(year), monthStart, 1));
    return relativeLabel(date, snapshot);
  });

  // 5. Season + year  ("Summer 2020", "Fall 2019")
  result = result.replace(
    /\b(Spring|Summer|Fall|Autumn|Winter)\s+(\d{4})\b/gi,
    (_m, season: string, year: string) => {
      const starts: Record<string, [number, number]> = {
        spring: [2, 21], summer: [5, 21], fall: [8, 22], autumn: [8, 22], winter: [11, 21],
      };
      const [mo, day] = starts[season.toLowerCase()] ?? [0, 1];
      const date = new Date(Date.UTC(Number(year), mo, day));
      return relativeLabel(date, snapshot);
    },
  );

  // 6. Month + day (no year)  — assumes snapshot year; rolls back 1 yr if result is >6 months future
  const monthDayRe = new RegExp(
    `\\b(${MONTHS_FULL.join('|')})\\s+(\\d{1,2})(?:st|nd|rd|th)?\\b`, 'gi',
  );
  result = result.replace(monthDayRe, (_m, month: string, day: string) => {
    const idx  = MONTHS_FULL.findIndex((m) => m.toLowerCase() === month.toLowerCase());
    const snapshotYear = snapshot.getUTCFullYear();
    let date = new Date(Date.UTC(snapshotYear, idx, Number(day)));
    if (date.getTime() - snapshot.getTime() > 183 * 24 * 60 * 60 * 1_000) {
      date = new Date(Date.UTC(snapshotYear - 1, idx, Number(day)));
    }
    return relativeLabel(date, snapshot);
  });

  // 7. Bare 4-digit years  — word boundary ensures we don't match inside larger numbers
  result = result.replace(/\b((?:19|20)\d{2})\b/g, (_m, year: string) => {
    const date = new Date(Date.UTC(Number(year), 0, 1));
    return relativeLabel(date, snapshot);
  });

  return result;
}

// ---------------------------------------------------------------------------
// Core text blinder
// ---------------------------------------------------------------------------

/**
 * Blinds a free-form text string by replacing all project names, actor names,
 * token tickers, GitHub orgs, URLs/domains, and dates with neutral aliases.
 *
 * Pass `snapshotDate` to enable date anonymisation (A1).
 */
export function blindText(text: string, entry: AliasEntry, snapshotDate?: Date): string {
  let result = text;

  // 0. Date anonymisation — convert absolute dates to relative offsets (A1)
  if (snapshotDate) {
    result = blindDates(result, snapshotDate);
  }

  // 1. Replace GitHub org paths in URLs first (before generic org replacement)
  //    e.g. "github.com/Uniswap/v2-core" → "github.com/Project_Alpha/core"
  for (const org of entry.githubOrgs) {
    result = result.replace(
      new RegExp(`github\\.com/${escapeRegex(org)}/([\\w\\-\\.]+)`, 'gi'),
      `github.com/${entry.alias}/$1`,
    );
  }

  // 2. Replace project-specific domains and URLs
  //    e.g. "app.uniswap.org" → "app.project-alpha.io"
  for (const domain of entry.domains) {
    const domainAlias = `${entry.alias.toLowerCase().replace(/_/g, '-')}.io`;
    result = result.replace(new RegExp(escapeRegex(domain), 'gi'), domainAlias);
  }

  // 3. Replace block explorer URLs containing addresses (C6: expanded pattern)
  //    Covers etherscan, bscscan, polygonscan, snowtrace, solscan, arbiscan,
  //    basescan, gnosisscan, and any other *scan.{io,com,org} explorer.
  result = result.replace(
    /https?:\/\/(?:\w+scan\.(?:io|com|org)|explorer\.solana\.com)\/address\/(0x[0-9a-fA-F]+|[1-9A-HJ-NP-Za-km-z]{32,44})/g,
    'explorer.example/address/ADDR_REDACTED',
  );

  // 4. Replace remaining generic explorer base URLs (C6: same expanded pattern)
  result = result.replace(
    /https?:\/\/(?:\w+scan\.(?:io|com|org)|explorer\.solana\.com)[^\s,)"']*/g,
    'explorer.example',
  );

  // 5. Replace remaining github.com org paths (catch-all)
  for (const org of entry.githubOrgs) {
    result = result.replace(new RegExp(`\\b${escapeRegex(org)}\\b`, 'gi'), entry.alias);
  }

  // 6. Replace project name variations (longest first to avoid partial matches)
  const sortedNames = [...entry.projectNames].sort((a, b) => b.length - a.length);
  for (const name of sortedNames) {
    result = result.replace(new RegExp(escapeRegex(name), 'gi'), entry.alias);
  }

  // 7. Replace token ticker — case-insensitive (A2 fix: was 'g', now 'gi')
  const ticker = Object.entries(loadAliasMap()).find(([, e]) => e.alias === entry.alias)?.[0]; // C7 fix
  if (ticker) {
    result = result.replace(new RegExp(`\\$${escapeRegex(ticker)}\\b`, 'gi'), entry.tokenAlias);
    result = result.replace(new RegExp(`\\b${escapeRegex(ticker)}\\b`, 'gi'), entry.tokenAlias);
  }

  // 8. Replace actor names (longest first)
  const sortedActors = Object.entries(entry.actorAliases)
    .sort(([a], [b]) => b.length - a.length);
  for (const [realName, codeName] of sortedActors) {
    result = result.replace(new RegExp(escapeRegex(realName), 'gi'), codeName);
  }

  return result;
}

// ---------------------------------------------------------------------------
// Payload blinder
// ---------------------------------------------------------------------------

/**
 * Blinds a full CasePayload — replaces names in structured fields,
 * blinds event dates relative to snapshot, and runs blindText on the narrative.
 *
 * Pass `snapshotDate` to enable date anonymisation (A1).
 */
export function blindPayload(
  payload:      CasePayload,
  entry:        AliasEntry,
  snapshotDate?: Date,
): BlindedPayload {
  // Blind developers
  const blindedDevs = payload.developers.map((dev) => ({
    ...dev,
    name:     entry.actorAliases[dev.name] ?? blindText(dev.name, entry, snapshotDate),
    activity: blindText(dev.activity, entry, snapshotDate),
  }));

  // Blind assets
  const blindedAssets = payload.assets.map((asset) => ({
    ...asset,
    name: blindText(asset.name, entry, snapshotDate),
    url:  blindAssetUrl(asset.url, entry),
  }));

  // Blind events — dates anonymised to relative offsets when snapshotDate is provided (A1)
  const blindedEvents = payload.events.map((event) => ({
    ...event,
    actor: entry.actorAliases[event.actor] ?? blindText(event.actor, entry, snapshotDate),
    asset: blindText(event.asset, entry, snapshotDate),
    date:  snapshotDate ? blindDates(event.date, snapshotDate) : event.date,
  }));

  // Blind narrative
  const blindedNarrative = blindText(payload.narrativeAtSnapshot, entry, snapshotDate);

  return {
    developers: blindedDevs,
    assets:     blindedAssets,
    events:     blindedEvents,
    narrativeAtSnapshot: blindedNarrative,
  };
}

/**
 * Blinds a standalone narrative string (e.g. the curated narrativeAtSnapshot
 * when passed directly to the debate without using the full payload).
 *
 * Pass `snapshotDate` to enable date anonymisation (A1).
 */
export function blindNarrativeContext(
  narrative:     string,
  entry:         AliasEntry,
  snapshotDate?: Date,
): string {
  return blindText(narrative, entry, snapshotDate);
}

// ---------------------------------------------------------------------------
// URL helpers
// ---------------------------------------------------------------------------

/**
 * Blinds a single asset URL:
 *   github.com/Org/repo  → github.com/Project_Alpha/repo
 *   *scan.io/address/0x… → explorer.example/address/ADDR_REDACTED
 *   Other project domains → project-alias.io/...
 */
function blindAssetUrl(url: string, entry: AliasEntry): string {
  // GitHub repos
  for (const org of entry.githubOrgs) {
    const repoMatch = url.match(
      new RegExp(`(?:github\\.com/)?${escapeRegex(org)}/([\\w\\-\\.]+)`, 'i'),
    );
    if (repoMatch) {
      return `github.com/${entry.alias}/${repoMatch[1]}`;
    }
  }

  // Block explorer addresses (C6: expanded catch-all)
  if (/\w+scan\.(?:io|com|org)|explorer\.solana\.com/i.test(url)) {
    return 'explorer.example/address/ADDR_REDACTED';
  }

  // Project-specific domains
  const domainAlias = `${entry.alias.toLowerCase().replace(/_/g, '-')}.io`;
  for (const domain of entry.domains) {
    if (url.includes(domain)) return domainAlias;
  }

  return url; // unknown URL — leave as-is (doesn't identify project)
}

// ---------------------------------------------------------------------------
// Alias map loader (lazy singleton)
// ---------------------------------------------------------------------------

let _aliasMap: AliasMap | null = null;

export function loadAliasMap(): AliasMap {
  if (_aliasMap) return _aliasMap;
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  _aliasMap = require('./aliases.json') as AliasMap;
  return _aliasMap;
}

export function getAliasEntry(ticker: string): AliasEntry {
  const map   = loadAliasMap();
  const entry = map[ticker];
  if (!entry) throw new Error(`[Blinder] No alias entry for ticker "${ticker}"`);
  return entry;
}

// ---------------------------------------------------------------------------
// Utility
// ---------------------------------------------------------------------------

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
