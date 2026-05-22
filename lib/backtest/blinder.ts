/**
 * Hindsight Blinder
 *
 * Replaces all identifying information in backtest payloads and narrative text
 * with neutral aliases so the LLM cannot use its training knowledge to "know"
 * which project succeeded. Without blinding, the backtest is meaningless.
 *
 * Blinding covers:
 *   1. Project names and variations (case-insensitive)
 *   2. Actor/developer names
 *   3. Token ticker symbols (prefixed and bare)
 *   4. GitHub organisations and repo paths
 *   5. URLs and domains (Patch 1 — prevents URL-based identification)
 *   6. Explorer addresses → anonymised labels
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
// Core text blinder
// ---------------------------------------------------------------------------

/**
 * Blinds a free-form text string by replacing all project names, actor names,
 * token tickers, GitHub orgs, and URLs/domains with neutral aliases.
 * Uses case-insensitive, word-boundary-aware replacement where possible.
 */
export function blindText(text: string, entry: AliasEntry): string {
  let result = text;

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

  // 3. Replace block explorer URLs containing addresses
  //    e.g. "etherscan.io/address/0x1f98..." → "explorer.example/address/ADDR_REDACTED"
  result = result.replace(
    /https?:\/\/(?:etherscan\.io|bscscan\.com|polygonscan\.com|snowtrace\.io|solscan\.io|explorer\.solana\.com|sohnoscan\.io)\/address\/(0x[0-9a-fA-F]+|[1-9A-HJ-NP-Za-km-z]{32,44})/g,
    'explorer.example/address/ADDR_REDACTED',
  );

  // 4. Replace remaining generic Etherscan/explorer base URLs
  result = result.replace(
    /https?:\/\/(?:etherscan\.io|bscscan\.com|polygonscan\.com|snowtrace\.io|solscan\.io|explorer\.solana\.com)[^\s,)"]*/g,
    'explorer.example',
  );

  // 5. Replace remaining github.com paths (catch-all for any leftover org refs)
  for (const org of entry.githubOrgs) {
    result = result.replace(new RegExp(`\\b${escapeRegex(org)}\\b`, 'gi'), entry.alias);
  }

  // 6. Replace project name variations (longest first to avoid partial matches)
  const sortedNames = [...entry.projectNames].sort((a, b) => b.length - a.length);
  for (const name of sortedNames) {
    result = result.replace(new RegExp(escapeRegex(name), 'gi'), entry.alias);
  }

  // 7. Replace token ticker with $ prefix  e.g. "$UNI" → "$TOKEN_A"
  const ticker = Object.entries(loadAliasMap()).find(([, e]) => e === entry)?.[0];
  if (ticker) {
    result = result.replace(new RegExp(`\\$${escapeRegex(ticker)}\\b`, 'g'), entry.tokenAlias);
    // bare ticker as standalone word (e.g. "UNI governance") — more conservative
    result = result.replace(
      new RegExp(`\\b${escapeRegex(ticker)}\\b`, 'g'),
      entry.tokenAlias,
    );
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
 * Blinds a full CasePayload — replaces names in structured fields
 * and runs blindText on the narrative.
 */
export function blindPayload(payload: CasePayload, entry: AliasEntry): BlindedPayload {
  // Blind developers
  const blindedDevs = payload.developers.map((dev) => ({
    ...dev,
    name:     entry.actorAliases[dev.name] ?? blindText(dev.name, entry),
    activity: blindText(dev.activity, entry),
  }));

  // Blind assets
  const blindedAssets = payload.assets.map((asset) => ({
    ...asset,
    name: blindText(asset.name, entry),
    url:  blindAssetUrl(asset.url, entry),
  }));

  // Blind events
  const blindedEvents = payload.events.map((event) => ({
    ...event,
    actor: entry.actorAliases[event.actor] ?? blindText(event.actor, entry),
    asset: blindText(event.asset, entry),
  }));

  // Blind narrative
  const blindedNarrative = blindText(payload.narrativeAtSnapshot, entry);

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
 */
export function blindNarrativeContext(narrative: string, entry: AliasEntry): string {
  return blindText(narrative, entry);
}

// ---------------------------------------------------------------------------
// URL helpers
// ---------------------------------------------------------------------------

/**
 * Blinds a single asset URL:
 *   github.com/Org/repo  → github.com/Project_Alpha/repo
 *   etherscan.io/address/0x…  → explorer.example/address/ADDR_REDACTED
 *   Other project domains → project-alias.io/...
 */
function blindAssetUrl(url: string, entry: AliasEntry): string {
  // GitHub repos
  for (const org of entry.githubOrgs) {
    const repoMatch = url.match(new RegExp(`(?:github\\.com/)?${escapeRegex(org)}/([\\w\\-\\.]+)`, 'i'));
    if (repoMatch) {
      return `github.com/${entry.alias}/${repoMatch[1]}`;
    }
  }

  // Block explorer addresses
  if (/etherscan\.io|bscscan\.com|polygonscan\.com|snowtrace\.io|solscan\.io|explorer\.solana\.com/i.test(url)) {
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
