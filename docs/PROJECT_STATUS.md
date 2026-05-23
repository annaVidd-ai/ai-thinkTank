# Project Status — Node Zero (v0.1.0)

**Last updated:** 2026-05-20 | **Phase:** Development | **Budget:** ~€9/mo

---

## Vision
AI agents that spot **paradigm-shifting profit opportunities before they go mainstream** (100x-1000x returns). Alpha = Information Asymmetry. Track builders (GitHub) and capital (on-chain wallets), not talkers (social). Detect the footprint *before* the narrative forms.

## Domain Focus: Crypto/DeFi (v0.1.0)
Only domain where both product (open source GitHub) and money (blockchain) are fully public. AI + Tech domains later — architecture supports it via generic Neo4j labels.

## Roles
- **This AI (Z.ai)** = Architect (review specs, maintain docs, flag issues, enforce standards)
- **Gemini 3.1 Pro** = Spec Writer (creates developer task specs from architecture)
- **ClaudeCode** = Developer (implements locally on Director's machine)
- **User** = Director (approve/reject, final calls, provide API keys, route between agents)

---

## Architecture

### Dual Database
- **SQLite (Prisma):** Pipeline state, task queue, debates, scoring, backtesting
- **Neo4j (AuraDB Free):** Knowledge graph — entity relationships, cluster detection

### Tech Stack
Next.js 16, TypeScript, Prisma/SQLite, Neo4j, monolith architecture

### Agent Topology

| Agent | Model | Role | Cost |
|---|---|---|---|
| Scout A | GLM-5.* (Z.ai) | GitHub + on-chain data ingestion | Free |
| Orchestrator | Claude Haiku | Map entities to Neo4j, dedup | €3 |
| Weaver | DeepSeek-R1 | Sweep Neo4j for clusters | €6 |
| Scout B | GLM-5.* (Z.ai) | Targeted narrative scan (elite actor feeds) | Free |
| Analyst | DeepSeek-R1 | Argue bull case | Shared |
| Skeptic | DeepSeek-R1 | Argue bear case | Shared |
| Quant | DeepSeek-R1 | Score against ScoringConfig | Shared |
| Mapper | Claude Haiku | Extract tradable ticker | Shared |

### 5-Phase Pipeline
1. **Extraction:** Scout A → raw GitHub + on-chain data → SQLite task queue
2. **Detection:** Orchestrator → Neo4j graph → Weaver spots high-density clusters
3. **Quality Gate:** Scout B checks narrative → Analyst vs Skeptic debate (3 rounds) → escalate to Director on disagreement
4. **Scoring:** Quant scores against configurable ScoringConfig (supports sweeps)
5. **Mapping:** Mapper extracts ticker → Dashboard alert

### Neo4j Graph Schema
- **Node Labels (generic base + domain):** `(:Actor:Elite)`, `(:Actor:Wallet)`, `(:Asset:SmartContract)`, `(:Asset:Repository)`
- **Extensible:** `(:Actor:AI_Researcher)`, `(:Asset:Patent)` for future domains
- **Edge Types:** `STARRED {createdAt}`, `DEPLOYED {createdAt}`, `FUNDED {amount, createdAt}`, `CONTRIBUTED {createdAt}`
- **Weighted TTL:** Orphaned=7d, Elite-connected=90d, Cluster=never (all configurable)

### SQLite Schema (Prisma)

```
Task          — Agent task queue (type, status, payload, result)
Cluster       — Detected Neo4j clusters (density, actorCount, status)
Debate        — Analyst vs Skeptic (status, rounds, verdict)
DebateRound   — Individual debate rounds
Opportunity   — Scored opportunities (ticker, scores, status)
ScoringConfig — Sweepable scoring weights (JSON factors, threshold)
Alert         — Director notifications (type, message, isRead)
BacktestCase  — Historical 100x cases (ticker, inceptionDate, split)
BacktestResult — Test results per config per case
```

### Scoring System
- **Signal Strength (40%):** Graph Density + Actor Elite Status
- **Timing (35%):** Secrecy (zero narrative) + Momentum (pace of connections)
- **Potential Upside (25%):** Market Cap relative to sector average
- Configurable: swap factors, change weights, sweep combinations
- Track which configs produce best results over time

### Backtesting (Walk-Forward 60/20/20)
- 10 historical cases for v0.1.0
- Director provides 100x tickers + inception dates
- `Backtest_Harvester.ts` reconstructs graph state at T-minus-7 days via historical APIs
- Run pipeline against isolated state, sweep ScoringConfig weights
- 60% calibration / 20% validation / 20% verification

### API Keys
- Gemini ✅ (free tier), Z.ai ✅ (free), DeepSeek ✅ (~€4), Anthropic ✅ (€5), OpenAI ❌ (payment issue)

### File Structure
```
src/
├── app/
│   ├── page.tsx                    # Dashboard
│   └── api/                        # REST endpoints
├── lib/
│   ├── db.ts                       # Prisma client
│   ├── neo4j.ts                    # Neo4j driver
│   ├── agents/                     # All 8 agent modules
│   ├── scoring/                    # Engine + sweep
│   ├── llm/                        # Z.ai, DeepSeek, Anthropic wrappers
│   ├── graph/                      # Cypher queries + TTL
│   └── backtest/                   # Harvester + runner
├── components/                     # Dashboard UI
└── prisma/schema.prisma
```

---

## Current Status

### Done ✅
- [x] Vision and core philosophy (Node Zero / Information Asymmetry)
- [x] Domain scoped: Crypto/DeFi only
- [x] Full architecture designed (agents, DBs, pipeline, scoring, backtesting)
- [x] All API keys secured
- [x] Budget confirmed: ~€9/month
- [x] **Task 01:** Prisma schema (AgentTask model), worker (5s polling, SCOUT/ORCHESTRATE/ANALYZE), Prisma v7 adapter pattern, smoke-tested

### In Progress 🔄
- **Task 02:** Neo4j driver + `upsertEntities()` + ORCHESTRATE worker integration (with Director)

### Next Steps 📋
1. ~~Set up Neo4j AuraDB (free tier)~~ → Director sets up, developer integrates
2. Add API keys to .env
3. ~~Set up Prisma schema + push to SQLite~~ ✅ (Task 01)
4. Build LLM wrappers (Z.ai, DeepSeek, Anthropic)
5. ~~Build Neo4j driver + graph queries~~ → In progress (Task 02)
6. Build Scout A (on-chain + GitHub ingestion)
7. ~~Build Orchestrator (map to Neo4j)~~ → In progress (Task 02)
8. Build Weaver (cluster detection)
9. Build Scout B (targeted narrative scan)
10. Build Analyst + Skeptic (debate system)
11. Build Quant (scoring engine)
12. Build Mapper (ticker extraction)
13. Build Dashboard UI
14. Build Backtest Harvester + Runner
15. Build task queue / scheduling

### Blockers 🚫
- Neo4j AuraDB not set up yet (Director action needed)
- API keys not yet in .env

### Architect Review Log
- **Task 02 v1:** Rejected `isElite` property → must be `:Elite` label for TTL indexing. Clarified `id` = canonical source ID. Renamed `insertScoutData` → `upsertEntities`.
- **Task 02 v2:** Edge `timestamp` → `createdAt` for cross-DB naming consistency.
- **Task 02 v3:** Approved.

---

## Developer Spec Convention
Every task spec sent to ClaudeCode must end with:
> "This is a CRUCIAL task. Make 100% sure your code works exactly as intended. Take all the time you need. Correctness is above all."

## Design Principles
- Concise over verbose, but never sacrifice clarity
- No hasty decisions — think before building
- Build smallest version that proves the concept, then iterate
- System must be backtestable — no trust without validation
- Alpha = Information Asymmetry. Builders + capital > narratives
