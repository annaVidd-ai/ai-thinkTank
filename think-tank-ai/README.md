# ThinkTank AI

Blockchain intelligence pipeline that detects elite-developer activity clusters, runs a bull/bear debate via reasoning models, scores the signal, and maps it to a tradable ticker.

---

## Pipeline

```
WEAVER_SWEEP → SCOUT_NARRATIVE → DEBATE (3 rounds) → SCORE → MAP → Alert
```

| Step | Model | Role |
|------|-------|------|
| SCOUT_NARRATIVE | GLM `glm-4.7-flash` | Narrative context from on-chain/GitHub activity |
| DEBATE_ANALYST | DeepSeek `deepseek-reasoner` | Bull case (3 rounds) |
| DEBATE_SKEPTIC | DeepSeek `deepseek-reasoner` | Bear case (3 rounds) |
| SCORE | DeepSeek `deepseek-reasoner` | Quantitative scoring (signalStrength / timing / upside) |
| MAP | Anthropic `claude-haiku-4-5-20251001` | Maps asset → tradable ticker → Alert |

---

## Command Reference

### Worker

The pipeline is processed by a background worker. All commands run from the project root.

```bash
npm run worker:start    # start worker in background (logs → worker.log)
npm run worker:stop     # stop worker
npm run worker:status   # check if worker is running (shows PID)
npm run worker:logs     # stream live log output — Ctrl+C to exit
```

---

### Database

```bash
# Apply schema changes to SQLite
npx prisma db push

# Regenerate Prisma client after schema changes
npx prisma generate

# Seed the 15 backtest cases (safe to re-run — upserts by ticker)
npx tsx prisma/seed-backtest.ts

# Open Prisma Studio (visual DB browser) at http://localhost:5555
npx prisma studio
```

---

### Backtest Engine

```bash
# Run specific cases (blinded + unblinded, 3 runs each)
npx tsx run-backtest.ts --cases UNI
npx tsx run-backtest.ts --cases COMP,SAFE,YFIL

# Run only blinded or only unblinded
npx tsx run-backtest.ts --cases UNI --type blinded
npx tsx run-backtest.ts --cases UNI --type unblinded

# Change number of runs (default: 3)
npx tsx run-backtest.ts --cases UNI --runs 1     # quick smoke test
npx tsx run-backtest.ts --cases UNI --runs 5     # higher confidence

# Print the bias report from existing DB data (no new runs)
npx tsx run-backtest.ts --report-only

# Report-only with a specific batch size (default: 3)
npx tsx run-backtest.ts --report-only --runs 5

# Run the full suite — all 15 cases (6–12 hours)
npx tsx run-backtest.ts

# Run with macOS notification on completion
npx tsx run-backtest.ts --cases SAFE --runs 3 && osascript -e 'display notification "Backtest done" with title "ThinkTank"'
```

**Backtest cases by split:**

| Split | Positive cases | Control cases |
|-------|---------------|---------------|
| Calibration | UNI, LINK, AAVE, SOL, AVAX, MATIC, YFI | COMP, SAFE |
| Validation | GRT, AXS, MKR | YFIL |
| Verification | SNX, SUSHI | — |

---

### Tests

```bash
# Unit tests — LLM validation layer (no worker needed)
npx tsx test_llm_retry.ts

# End-to-end pipeline test (worker must be running)
npm run worker:start
npx tsx test_pipeline.ts
npm run worker:stop

# Individual component tests
npx tsx test.ts           # basic smoke test
npx tsx test_debate.ts    # debate manager
npx tsx test_neo4j.ts     # Neo4j connection
npx tsx test_weaver.ts    # Weaver sweep
```

---

### TypeScript

```bash
# Check for type errors (no output = clean)
npx tsc --noEmit
```

---

### Git

```bash
git status
git log --oneline -10
git push
```

---

## Environment Variables

Copy `.env.example` to `.env` and fill in:

```
GLM_API_KEY=          # ZhipuAI (Scout / Narrative)
GLM_API_BASE=         # default: https://open.bigmodel.cn/api/paas/v4
DEEPSEEK_API_KEY=     # DeepSeek (Analyst / Skeptic / Score)
DEEPSEEK_API_BASE=    # default: https://api.deepseek.com
ANTHROPIC_API_KEY=    # Anthropic (MAP / ticker resolution)
NEO4J_URI=            # e.g. bolt://localhost:7687
NEO4J_USERNAME=
NEO4J_PASSWORD=
```

---

## Typical Workflow

```bash
# 1. Start worker
npm run worker:start

# 2. Run a backtest
npx tsx run-backtest.ts --cases COMP --runs 3

# 3. Watch progress in another terminal
npm run worker:logs

# 4. Check the report
npx tsx run-backtest.ts --report-only

# 5. Stop worker when done
npm run worker:stop
```
