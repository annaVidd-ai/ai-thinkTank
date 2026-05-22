/**
 * Generic LLM router with Zod validation + single retry on parse/schema failure.
 *
 * Dispatch rules
 * ──────────────
 * provider === 'openai-compatible'  →  openai SDK with custom baseURL
 * provider === 'anthropic'          →  @anthropic-ai/sdk
 *
 * Response pipeline
 * ─────────────────
 * 1. Call provider SDK
 * 2. cleanResponse()  — strip <think> CoT blocks + markdown code fences
 * 3. JSON.parse()
 * 4. schema.parse()   — Zod validation
 * On SyntaxError / ZodError → retry once.
 * On second failure → throw descriptive error (worker marks task FAILED).
 * Non-parse API errors (network, auth) → throw immediately (no retry waste).
 */

import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { z, ZodError } from 'zod';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface LLMConfig {
  provider: 'openai-compatible' | 'anthropic';
  model: string;
  baseURL?: string;  // required for openai-compatible
  apiKey: string;
}

// ---------------------------------------------------------------------------
// Response cleaning
// ---------------------------------------------------------------------------

/**
 * Strips DeepSeek chain-of-thought <think>…</think> blocks (when present in
 * the content field) and markdown code fences that models sometimes emit
 * despite instructions.
 */
export function cleanResponse(text: string): string {
  let cleaned = text
    // DeepSeek-R1 <think> blocks that occasionally leak into content
    .replace(/<think>[\s\S]*?<\/think>\s*/g, '')
    .trim();

  // ```json … ``` or ``` … ```
  cleaned = cleaned
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/, '')
    .trim();

  return cleaned;
}

// ---------------------------------------------------------------------------
// Parse + validate (exported so tests can exercise it directly)
// ---------------------------------------------------------------------------

/**
 * Cleans, JSON-parses, and Zod-validates a raw LLM response string.
 * Throws SyntaxError (bad JSON) or ZodError (schema mismatch) on failure.
 */
export function parseAndValidate<T>(rawText: string, schema: z.ZodSchema<T>): T {
  const cleaned = cleanResponse(rawText);
  const parsed = JSON.parse(cleaned); // throws SyntaxError on bad JSON
  return schema.parse(parsed);        // throws ZodError on schema mismatch
}

// ---------------------------------------------------------------------------
// Provider-specific callers
// ---------------------------------------------------------------------------

async function callOpenAICompatible(
  config: LLMConfig,
  system: string,
  user: string,
): Promise<string> {
  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
  });

  const response = await client.chat.completions.create({
    model: config.model,
    messages: [
      { role: 'system', content: system },
      { role: 'user',   content: user   },
    ],
  });

  return response.choices[0]?.message?.content ?? '';
}

async function callAnthropic(
  config: LLMConfig,
  system: string,
  user: string,
): Promise<string> {
  const client = new Anthropic({ apiKey: config.apiKey });

  const response = await client.messages.create({
    model:      config.model,
    max_tokens: 1024,
    system,
    messages: [{ role: 'user', content: user }],
  });

  if (!response.content.length) {
    throw new Error('[LLM] Anthropic returned empty content array');
  }

  const block = response.content[0];
  if (block.type !== 'text') {
    throw new Error(`[LLM] Unexpected Anthropic content block type: "${block.type}"`);
  }

  return block.text;
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Calls the appropriate LLM provider, validates the response against `schema`,
 * and retries exactly once on parse/validation failure.
 *
 * Throws on:
 *   - Missing API key (pre-flight check)
 *   - Non-parse API errors (network, auth) — thrown immediately, no retry
 *   - Two consecutive parse/validation failures — throws descriptive error
 */
export async function callLLM<T>(
  config: LLMConfig,
  system: string,
  user: string,
  schema: z.ZodSchema<T>,
): Promise<T> {
  if (!config.apiKey) {
    throw new Error(
      `[LLM] Missing API key for model "${config.model}". ` +
      `Set the appropriate environment variable in .env.`,
    );
  }

  let lastError: unknown;

  for (let attempt = 1; attempt <= 2; attempt++) {
    try {
      const raw =
        config.provider === 'openai-compatible'
          ? await callOpenAICompatible(config, system, user)
          : await callAnthropic(config, system, user);

      return parseAndValidate(raw, schema);
    } catch (err) {
      if (err instanceof ZodError || err instanceof SyntaxError) {
        lastError = err;
        if (attempt === 1) {
          console.warn(
            `[LLM] Attempt 1 failed (${err instanceof ZodError ? 'ZodError' : 'SyntaxError'}) ` +
            `for model "${config.model}". Retrying once…`,
          );
          console.warn(
            '[LLM] Validation details:',
            err instanceof ZodError ? JSON.stringify(err.issues) : String(err),
          );
          continue;
        }
        // attempt 2 also failed — fall through to throw below
      } else {
        // API / network error — no point retrying, re-throw immediately
        throw err;
      }
    }
  }

  const errorKind = lastError instanceof ZodError ? 'schema validation' : 'JSON parsing';
  const errorDetails =
    lastError instanceof ZodError
      ? JSON.stringify((lastError as ZodError).issues, null, 2)
      : String(lastError);

  throw new Error(
    `[LLM] ${errorKind} failed after 2 attempts for model "${config.model}".\n${errorDetails}`,
  );
}
