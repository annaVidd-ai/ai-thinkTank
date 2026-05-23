/**
 * promptLoader.ts
 * ───────────────
 * Reads every Agent_*_Instructions.md file from the agents/ directory at
 * first use and caches the results in memory for the lifetime of the process.
 *
 * Directory resolution
 * ────────────────────
 * __dirname  →  .../thinkTank-ai/think-tank-ai/lib/
 * ../..      →  .../thinkTank-ai/
 * agents     →  .../thinkTank-ai/agents/          ← the single source of truth
 *
 * Using __dirname (provided by tsx) rather than process.cwd() ensures the
 * path is always relative to this file's location, not the caller's working
 * directory.
 *
 * Usage
 * ─────
 *   import { getPrompt } from './promptLoader';
 *   const systemPrompt = getPrompt('analyst'); // → Agent_Analyst_Instructions.md
 */

import fs   from 'fs';
import path from 'path';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const AGENTS_DIR = path.resolve(__dirname, '..', '..', 'agents');

/** Matches Agent_<Name>_Instructions.md — anchored, case-sensitive. */
const AGENT_FILE_RE = /^Agent_(\w+)_Instructions\.md$/;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface AgentPrompt {
  /** Original filename, e.g. "Agent_Analyst_Instructions.md" */
  filename: string;
  /** Full raw file content as read from disk. */
  rawContent: string;
  /**
   * Processed system prompt string.
   * Currently equal to rawContent — Step 2 will add template variable
   * injection before this value is used as an LLM system prompt.
   */
  systemPrompt: string;
}

// ---------------------------------------------------------------------------
// Module-level singleton cache
// ---------------------------------------------------------------------------

let promptCache: Map<string, AgentPrompt> | null = null;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

/**
 * Extracts a lowercase agent key from a filename.
 * Returns an empty string for non-agent files (skipped by the caller).
 *
 * Examples:
 *   Agent_Analyst_Instructions.md  →  "analyst"
 *   Agent_Skeptic_Instructions.md  →  "skeptic"
 *   Architect_Instructions.md      →  ""  (skipped)
 */
function parseAgentName(filename: string): string {
  const match = filename.match(AGENT_FILE_RE);
  return match ? match[1].toLowerCase() : '';
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Loads all agent prompts from disk on first call; returns the cached Map on
 * every subsequent call.  Thread-safe within a single Node.js process.
 *
 * @throws if the agents/ directory does not exist at the resolved path.
 */
export function loadAllPrompts(): Map<string, AgentPrompt> {
  if (promptCache) return promptCache;

  if (!fs.existsSync(AGENTS_DIR)) {
    throw new Error(
      `[PromptLoader] agents/ directory not found.\n` +
      `  Resolved path : ${AGENTS_DIR}\n` +
      `  __dirname     : ${__dirname}\n` +
      `  Verify the repository structure: agents/ must sit one level above think-tank-ai/.`,
    );
  }

  promptCache = new Map<string, AgentPrompt>();

  const entries = fs.readdirSync(AGENTS_DIR).filter((entry) => {
    if (!entry.endsWith('.md')) return false;
    return fs.statSync(path.join(AGENTS_DIR, entry)).isFile();
  });

  for (const file of entries) {
    const agentName = parseAgentName(file);
    if (!agentName) continue; // skip Architect_Instructions.md and any other non-agent .md files

    const rawContent = fs.readFileSync(path.join(AGENTS_DIR, file), 'utf-8');
    promptCache.set(agentName, {
      filename:     file,
      rawContent,
      systemPrompt: rawContent, // Step 2 will introduce template variable injection
    });
  }

  console.log(
    `[PromptLoader] Loaded ${promptCache.size} agent prompts from ${AGENTS_DIR}\n` +
    `  Agents: [${[...promptCache.keys()].sort().join(', ')}]`,
  );

  return promptCache;
}

/**
 * Returns the system prompt string for the given lowercase agent name.
 *
 * @param agentName  e.g. "analyst", "skeptic", "quant", "mapper", "scout", "weaver"
 * @throws if no prompt file was found for that agent name.
 */
export function getPrompt(agentName: string): string {
  const cache = loadAllPrompts();
  const prompt = cache.get(agentName);
  if (!prompt) {
    const available = [...cache.keys()].sort().join(', ');
    throw new Error(
      `[PromptLoader] No prompt found for agent: "${agentName}".\n` +
      `  Available agents: [${available}]`,
    );
  }
  return prompt.systemPrompt;
}

/**
 * Clears the in-memory cache and re-reads all files from disk.
 * Intended for development hot-reload or runtime prompt updates.
 */
export function reloadPrompts(): void {
  promptCache = null;
  loadAllPrompts();
}
