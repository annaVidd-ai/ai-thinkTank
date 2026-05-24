/**
 * Model assignments for every pipeline task type.
 *
 * Required environment variables:
 *   GLM_API_KEY        — ZhipuAI API key
 *   GLM_API_BASE       — ZhipuAI base URL  (default: https://open.bigmodel.cn/api/paas/v4)
 *   DEEPSEEK_API_KEY   — DeepSeek API key
 *   DEEPSEEK_API_BASE  — DeepSeek base URL (default: https://api.deepseek.com)
 *   ANTHROPIC_API_KEY  — Anthropic API key
 */

import type { LLMConfig } from './llmClient';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Returns the env-var value. Empty string if unset — callLLM will throw a
 *  clear error rather than leaking undefined into the SDK constructor. */
function env(name: string): string {
  return process.env[name] ?? '';
}

// ---------------------------------------------------------------------------
// Named config objects (one per logical role)
// ---------------------------------------------------------------------------

/** GLM — Scout / data structuring */
export const SCOUT_CONFIG: LLMConfig = {
  provider: 'openai-compatible',
  model:    'glm-4.7-flash',
  baseURL:  env('GLM_API_BASE') || 'https://open.bigmodel.cn/api/paas/v4',
  apiKey:   env('GLM_API_KEY'),
};

/** GLM — Narrative scout */
export const NARRATIVE_CONFIG: LLMConfig = {
  provider: 'openai-compatible',
  model:    'glm-4.7-flash',
  baseURL:  env('GLM_API_BASE') || 'https://open.bigmodel.cn/api/paas/v4',
  apiKey:   env('GLM_API_KEY'),
};

/** Claude Sonnet — Debate analyst (BULL) — model diversity: different provider from SKEPTIC */
export const ANALYST_CONFIG: LLMConfig = {
  provider:  'anthropic',
  model:     'claude-sonnet-4-6',
  apiKey:    env('ANTHROPIC_API_KEY'),
  maxTokens: 4096,
};

/**
 * ⚠️ `deepseek-reasoner` resolves to v4-flash as of May 22, 2026.
 * DeepSeek does not offer separate model IDs for flash vs pro.
 * Monitor response.model in logs to detect future remapping.
 */
/** DeepSeek-R1 — Debate sceptic (BEAR) */
export const SKEPTIC_CONFIG: LLMConfig = {
  provider: 'openai-compatible',
  model:    'deepseek-reasoner',
  baseURL:  env('DEEPSEEK_API_BASE') || 'https://api.deepseek.com',
  apiKey:   env('DEEPSEEK_API_KEY'),
};

/**
 * Baseline verification (Δ=0.017) confirmed v4-flash cannot
 * meaningfully discriminate winners from controls. Option 1:
 * switch this to Claude Sonnet for the smoke test:
 *   provider:  'anthropic',
 *   model:     'claude-sonnet-4-6',
 *   apiKey:    env('ANTHROPIC_API_KEY'),
 *   maxTokens: 4096,
 */
/** Claude Sonnet — Quant scoring (switched from deepseek-reasoner for stronger evidence reasoning) */
export const SCORE_CONFIG: LLMConfig = {
  provider:  'anthropic',
  model:     'claude-sonnet-4-6',
  apiKey:    env('ANTHROPIC_API_KEY'),
  maxTokens: 4096,
};

/** Claude Haiku — Asset mapper (short JSON output, 1024 tokens sufficient) */
export const MAPPER_CONFIG: LLMConfig = {
  provider:  'anthropic',
  model:     'claude-haiku-4-5-20251001',
  apiKey:    env('ANTHROPIC_API_KEY'),
  maxTokens: 1024,
};
