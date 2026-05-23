/**
 * Centralised dotenv loader.
 *
 * Uses `override: true` so values in `.env` always win over any pre-existing
 * empty-string env vars that the shell may have set (e.g. ANTHROPIC_API_KEY="").
 *
 * Import this as the FIRST import in every process entry point (worker, tests).
 * Library modules (neo4j.ts, llmConfig.ts, …) should NOT import dotenv directly
 * — they rely on the entry point having loaded the env first.
 */
import { config } from 'dotenv';
config({ override: true });
