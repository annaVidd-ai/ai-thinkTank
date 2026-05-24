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
  provider:   'openai-compatible' | 'anthropic';
  model:      string;
  baseURL?:   string;      // required for openai-compatible
  apiKey:     string;
  maxTokens?: number;      // Anthropic only; defaults to 1024 when not set
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
// Temperature guards
// ---------------------------------------------------------------------------

/**
 * Models that do NOT support the `temperature` parameter.
 * Passing temperature to these models causes an immediate API error.
 *
 * deepseek-reasoner: DeepSeek-R1 reasoning model. Its internal sampling
 *   during chain-of-thought is not user-configurable via temperature.
 */
const MODELS_WITHOUT_TEMPERATURE = new Set(['deepseek-reasoner']);

// ---------------------------------------------------------------------------
// Provider-specific callers
// ---------------------------------------------------------------------------

async function callOpenAICompatible(
  config: LLMConfig,
  system: string,
  user: string,
  temperature?: number,
): Promise<string> {
  const client = new OpenAI({
    apiKey: config.apiKey,
    baseURL: config.baseURL,
  });

  // Only pass temperature when the model supports it and a value was provided.
  const supportsTemp = !MODELS_WITHOUT_TEMPERATURE.has(config.model);

  const response = await client.chat.completions.create({
    model: config.model,
    messages: [
      { role: 'system', content: system },
      { role: 'user',   content: user   },
    ],
    ...(supportsTemp && temperature !== undefined ? { temperature } : {}),
  });

  return response.choices[0]?.message?.content ?? '';
}

async function callAnthropic(
  config: LLMConfig,
  system: string,
  user: string,
  _temperature?: number,
): Promise<string> {
  // Note: temperature intentionally NOT forwarded to the Anthropic API.
  // Claude models released after Opus 4.6 (including Sonnet 4.6 and Haiku 4.5+)
  // have deprecated temperature support. The SDK rejects any value other than
  // 1.0 with a 400 error. The _temperature parameter is accepted for API
  // consistency but silently ignored here.
  const client = new Anthropic({ apiKey: config.apiKey });

  const response = await client.messages.create({
    model:         config.model,
    max_tokens:    config.maxTokens ?? 1024,
    // Top-level cache_control: Anthropic automatically places the cache
    // breakpoint on the last cacheable block in the request (system prompt +
    // conversation history). Covers the full growing context, not just the
    // system block. Anthropic SDK only — openai-compatible path is untouched.
    cache_control: { type: 'ephemeral' },
    system,
    messages: [{ role: 'user', content: user }],
  });

  // Cache verification log — remove after confirming cache hits
  const { cache_creation_input_tokens: cacheWrite, cache_read_input_tokens: cacheRead } = response.usage;
  console.log(
    `[LLM:cache] model=${config.model}` +
    ` in=${response.usage.input_tokens}` +
    ` cache_write=${cacheWrite ?? 0}` +
    ` cache_read=${cacheRead ?? 0}` +
    ` out=${response.usage.output_tokens}`,
  );

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
  temperature?: number,
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
          ? await callOpenAICompatible(config, system, user, temperature)
          : await callAnthropic(config, system, user, temperature);

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
