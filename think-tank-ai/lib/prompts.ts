/**
 * Zod schemas and system-prompt builders for every LLM call in the pipeline.
 *
 * Every system prompt ends with:
 *   "Respond with raw JSON only. No markdown. No explanation outside the JSON."
 *
 * Every schema wraps its z.object() in z.preprocess() so that:
 *   - Common alternate field names from reasoning models are normalised
 *   - A bare string response is wrapped into the expected shape where applicable
 * This makes the validation layer resilient to minor naming variations while
 * still enforcing the full shape via Zod after preprocessing.
 */

import { z } from 'zod';
import { getPrompt, getTemperature } from './promptLoader';

export { getTemperature };

// ---------------------------------------------------------------------------
// Preprocessing helpers
// ---------------------------------------------------------------------------

/**
 * Given a raw parsed value, attempts to extract a string from common
 * field names that LLMs might use instead of `argument`.
 * Returns `{ argument: <found string> }` or the original value unchanged.
 */
function normaliseArgument(raw: unknown): unknown {
  if (typeof raw === 'string') return { argument: raw };
  if (typeof raw !== 'object' || raw === null) return raw;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.argument === 'string') return raw; // already correct
  for (const key of [
    'response', 'content', 'text', 'reply', 'statement',
    'bear_argument', 'bull_argument', 'position', 'rebuttal',
    'point', 'case', 'view',
  ]) {
    if (typeof obj[key] === 'string') return { argument: obj[key] };
  }
  return raw;
}

// ---------------------------------------------------------------------------
// Schemas
// ---------------------------------------------------------------------------

/**
 * Matches the GraphPayload interface in graphOperations.ts.
 * Optional fields use .nullable() so LLMs can output null for absent data;
 * callers convert null → undefined before passing to upsertEntities().
 *
 * Uses a discriminated union for events so the inferred TypeScript type
 * matches GraphEvent exactly (no cast required at call sites).
 */
export const ScoutSchema = z.object({
  developer: z
    .object({ id: z.string(), name: z.string(), isElite: z.boolean() })
    .nullable(),
  wallet: z
    .object({ id: z.string(), isElite: z.boolean() })
    .nullable(),
  repository: z
    .object({ id: z.string(), url: z.string() })
    .nullable(),
  contract: z
    .object({ id: z.string() })
    .nullable(),
  /**
   * Discriminated union: ensures correct TS types and that FUNDED events
   * always carry `amount` while STARRED/DEPLOYED do not.
   */
  events: z.array(
    z.discriminatedUnion('type', [
      z.object({
        type: z.literal('STARRED'), actorId: z.string(),
        assetId: z.string(), createdAt: z.string(),
      }),
      z.object({
        type: z.literal('DEPLOYED'), actorId: z.string(),
        assetId: z.string(), createdAt: z.string(),
      }),
      z.object({
        type: z.literal('FUNDED'), actorId: z.string(),
        assetId: z.string(), createdAt: z.string(), amount: z.number(),
      }),
    ]),
  ),
});

export type ScoutOutput = z.infer<typeof ScoutSchema>;

/** Narrative intelligence report produced by GLM during SCOUT_NARRATIVE. */
export const NarrativeSchema = z.preprocess((raw) => {
  if (typeof raw !== 'object' || raw === null) return raw;
  const obj = raw as Record<string, unknown>;
  // Some models use "description" or "analysis" instead of "summary"
  if (!obj.summary) {
    for (const k of ['description', 'analysis', 'assessment', 'narrative', 'overview']) {
      if (typeof obj[k] === 'string') { obj.summary = obj[k]; break; }
    }
  }
  // Normalise sentiment to lowercase
  if (typeof obj.sentiment === 'string') {
    obj.sentiment = obj.sentiment.toLowerCase();
  }
  return obj;
}, z.object({
  mentions:  z.number().int().nonnegative(),
  sentiment: z.enum(['bullish', 'bearish', 'neutral']),
  summary:   z.string().max(500),
}));

export type NarrativeOutput = z.infer<typeof NarrativeSchema>;

/**
 * Single debate turn (rounds 1–2 for both Analyst and Skeptic).
 * Preprocessing normalises common alternate field names from reasoning models.
 */
export const DebateTurnSchema = z.preprocess(
  normaliseArgument,
  z.object({ argument: z.string() }),
);

export type DebateTurnOutput = z.infer<typeof DebateTurnSchema>;

/**
 * Final round Skeptic verdict (round 3 only).
 * Preprocessing normalises `argument` field and common verdict aliases.
 */
export const DebateFinalSchema = z.preprocess((raw) => {
  if (typeof raw !== 'object' || raw === null) return raw;
  const obj = raw as Record<string, unknown>;

  // Normalise argument field (same candidates as DebateTurnSchema)
  if (!obj.argument) {
    for (const k of [
      'response', 'content', 'text', 'reply', 'statement',
      'bear_argument', 'conclusion', 'closing_argument',
    ]) {
      if (typeof obj[k] === 'string') { obj.argument = obj[k]; break; }
    }
  }

  // Normalise verdict: accept "agreed"/"deadlocked" case-insensitively,
  // and map semantic aliases (e.g. "agree", "consensus" → "agreed")
  if (typeof obj.verdict === 'string') {
    const v = obj.verdict.toLowerCase();
    if (['agree', 'agreed', 'consensus', 'accepted', 'yes'].includes(v)) {
      obj.verdict = 'agreed';
    } else {
      obj.verdict = 'deadlocked';
    }
  }

  // Normalise finalThesis field
  if (!obj.finalThesis) {
    for (const k of ['final_thesis', 'thesis', 'outcome', 'position', 'conclusion', 'final_position']) {
      if (typeof obj[k] === 'string') { obj.finalThesis = obj[k]; break; }
    }
  }

  return obj;
}, z.object({
  argument:    z.string(),
  verdict:     z.enum(['agreed', 'deadlocked']),
  finalThesis: z.string(),
}));

export type DebateFinalOutput = z.infer<typeof DebateFinalSchema>;

/**
 * Quantitative score produced by DeepSeek-R1. Each dimension is 0–1.
 * Preprocessing clamps values that the model may report slightly outside [0,1]
 * and normalises common field aliases.
 */
export const ScoreSchema = z.preprocess((raw) => {
  if (typeof raw !== 'object' || raw === null) return raw;
  const obj = raw as Record<string, unknown>;

  // Field aliases
  const aliases: Record<string, string[]> = {
    signalStrength: ['signal_strength', 'signal', 'strength'],
    timing:         ['market_timing', 'entry_timing', 'time'],
    upside:         ['upside_potential', 'potential', 'upside_score'],
    failureRisk:    ['failure_risk', 'risk', 'structural_risk', 'failure_probability', 'risk_score'],
    reasoning:      ['explanation', 'rationale', 'analysis', 'notes', 'justification'],
  };
  for (const [canonical, alts] of Object.entries(aliases)) {
    if (obj[canonical] === undefined) {
      for (const alt of alts) {
        if (obj[alt] !== undefined) { obj[canonical] = obj[alt]; break; }
      }
    }
  }

  // Clamp numeric values to [0, 1] to handle models that output e.g. 0.95 as "95"
  for (const key of ['signalStrength', 'timing', 'upside', 'failureRisk']) {
    if (typeof obj[key] === 'number') {
      const n = obj[key] as number;
      if (n > 1 && n <= 100) obj[key] = n / 100; // percentage form
      obj[key] = Math.max(0, Math.min(1, obj[key] as number));
    }
  }

  return obj;
}, z.object({
  signalStrength: z.number().min(0).max(1),
  timing:         z.number().min(0).max(1),
  upside:         z.number().min(0).max(1),
  failureRisk:    z.number().min(0).max(1).default(0), // defaults to 0 (no risk) if absent
  reasoning:      z.string(),
}));

export type ScoreOutput = z.infer<typeof ScoreSchema>;

/** Tradable ticker + market cap estimate produced by Claude Haiku. */
export const MapperSchema = z.preprocess((raw) => {
  if (typeof raw !== 'object' || raw === null) return raw;
  const obj = raw as Record<string, unknown>;
  if (!obj.ticker) {
    for (const k of ['symbol', 'token', 'asset_ticker', 'token_symbol']) {
      if (typeof obj[k] === 'string') { obj.ticker = obj[k]; break; }
    }
  }
  if (!obj.marketCap) {
    for (const k of ['market_cap', 'marketcap', 'cap', 'market_capitalization']) {
      if (typeof obj[k] === 'string') { obj.marketCap = obj[k]; break; }
    }
  }
  return obj;
}, z.object({
  ticker:    z.string(),
  marketCap: z.string(),
}));

export type MapperOutput = z.infer<typeof MapperSchema>;

// ---------------------------------------------------------------------------
// Transcript builder (shared by debateManager + quantManager)
// ---------------------------------------------------------------------------

export interface TranscriptMessage {
  role:    string;
  content: string; // stored as JSON string in DB
  round:   number;
}

/**
 * Formats an array of DebateMessage rows into a readable transcript string.
 * Each message's content is stored as JSON; we extract the `argument` field.
 */
export function buildTranscript(messages: TranscriptMessage[]): string {
  if (messages.length === 0) return '(No prior debate messages)';

  return messages
    .slice()
    .sort((a, b) => a.round - b.round || (a.role === 'ANALYST' ? -1 : 1))
    .map((msg) => {
      let argument = msg.content;
      try {
        const parsed = JSON.parse(msg.content) as { argument?: string };
        if (parsed.argument) argument = parsed.argument;
      } catch {
        // content wasn't valid JSON — use raw string
      }
      return `[Round ${msg.round} - ${msg.role}]: ${argument}`;
    })
    .join('\n');
}

// ---------------------------------------------------------------------------
// System prompt getters — read from agents/*.md via promptLoader
// ---------------------------------------------------------------------------

/** Reads Agent_Scout_Instructions.md at first call; cached for process lifetime. */
export const getScoutSystemPrompt     = (): string => getPrompt('scout');

/** Reads Agent_Weaver_Instructions.md at first call; cached for process lifetime. */
export const getNarrativeSystemPrompt = (): string => getPrompt('weaver');

/** Reads Agent_Analyst_Instructions.md at first call; cached for process lifetime. */
export const getAnalystSystemPrompt   = (): string => getPrompt('analyst');

/** Reads Agent_Skeptic_Instructions.md at first call; cached for process lifetime. */
export const getSkepticSystemPrompt   = (): string => getPrompt('skeptic');

/** Reads Agent_Quant_Instructions.md at first call; cached for process lifetime. */
export const getScoreSystemPrompt     = (): string => getPrompt('quant');

/** Reads Agent_Mapper_Instructions.md at first call; cached for process lifetime. */
export const getMapperSystemPrompt    = (): string => getPrompt('mapper');

// ---------------------------------------------------------------------------
// User-prompt builders
// ---------------------------------------------------------------------------

export function buildScoutUser(rawPayload: string): string {
  return `Structure the following raw activity data into the GraphPayload schema.\n\nRaw data:\n${rawPayload}`;
}

export function buildNarrativeUser(assetId: string, assetType: string): string {
  return `Asset ID:   ${assetId}\nAsset Type: ${assetType}\n\nMultiple elite developers are converging on this asset. Assess whether this project shows early momentum signals — growing attention before mainstream awareness. Estimate weekly mention volume and sentiment trend.\nRespond with {"mentions": <int>, "sentiment": "bullish"|"bearish"|"neutral", "summary": "<≤200 chars>"}.`;
}

export function buildAnalystUser(
  round: number,
  transcript: string,
  narrativeContext: string,
): string {
  return `Debate round ${round} of 3.\n\nNarrative context (early momentum assessment):\n${narrativeContext || 'Not available.'}\n\nPrior transcript:\n${transcript}\n\nArgue why this project has strong 10x potential. Focus on structural signals, early momentum, and contrarian edge. Respond to the skeptic's prior points where applicable.\nRemember: respond with {"argument": "..."} only.`;
}

export function buildSkepticUser(
  round: number,
  transcript: string,
  narrativeContext: string,
  isFinal: boolean,
): string {
  if (isFinal) {
    return `Debate round ${round} of 3 — FINAL ROUND.\n\nNarrative context (early momentum assessment):\n${narrativeContext || 'Not available.'}\n\nFull debate transcript:\n${transcript}\n\nThis is the final round. Conclude the debate on whether this project can deliver 10x returns.\nYou MUST respond with ONLY this exact JSON structure:\n{"argument": "your closing argument", "verdict": "agreed" or "deadlocked", "finalThesis": "SHORT_THESIS_LABEL"}\n\nUse "agreed" if you accept the bull case (even conditionally). Use "deadlocked" if fundamental disagreement remains.\nfinalThesis examples: "CAUTIOUSLY_BULLISH", "STRONG_BUY", "NEUTRAL", "STRUCTURAL_RISKS_REMAIN", "DEADLOCKED"`;
  }

  return `Debate round ${round} of 3.\n\nNarrative context (early momentum assessment):\n${narrativeContext || 'Not available.'}\n\nPrior transcript:\n${transcript}\n\nChallenge the analyst's 10x thesis. Be specific — address false momentum, structural risks, competition, or market conditions.\nRemember: respond with {"argument": "..."} only.`;
}

export function buildScoreUser(
  assetId: string,
  assetType: string,
  verdict: string,
  narrativeContext: string,
  transcript: string,
): string {
  return `Asset ID:        ${assetId}\nAsset Type:      ${assetType}\nDebate Verdict:  ${verdict}\n\nNarrative context (early momentum assessment):\n${narrativeContext || 'Not available.'}\n\nDebate transcript:\n${transcript}\n\nScore the early momentum signal and 10x potential. Apply the timing scoring rules strictly — zero mentions = LOW timing (0.1-0.2), mainstream coverage = LOW timing (0.1-0.2), acceleration phase = HIGH timing (0.8-1.0).\nReturn {"signalStrength": X, "timing": X, "upside": X, "reasoning": "..."}.`;
}

export function buildMapperUser(
  assetId: string,
  assetType: string,
  thesis: string,
): string {
  return `Asset ID:   ${assetId}\nAsset Type: ${assetType}\nThesis:     ${thesis}\n\nDerive a tradable ticker and estimate market cap. Return {"ticker": "$XXXX", "marketCap": "..."}.`;
}
