# ThinkTank AI

Blockchain intelligence pipeline that detects elite-developer activity clusters, runs a bull/bear debate via reasoning models, scores the signal, and maps it to a tradable ticker.

---

## Pipeline

```
WEAVER_SWEEP → SCOUT_NARRATIVE → DEBATE (3 rounds) → SCORE → MAP → Alert
```

| Step | Model | Role |
|------|-------|------|
| SCOUT_NARRATIVE | GLM `glm-4-plus` | Narrative context from on-chain/GitHub activity |
| DEBATE_ANALYST | DeepSeek `deepseek-reasoner` | Bull case (3 rounds) |
| DEBATE_SKEPTIC | DeepSeek `deepseek-reasoner` | Bear case (3 rounds) |
| SCORE | DeepSeek `deepseek-reasoner` | Quantitative scoring (signalStrength / timing / upside) |
| MAP | Anthropic `claude-haiku-4-5-20251001` | Maps asset → tradable ticker → Alert |

---

## Worker Commands

The pipeline is processed by a background worker. Run all commands from the project root.

```bash
npm run worker:start    # start worker in background (logs → worker.log)
npm run worker:stop     # stop worker
npm run worker:status   # check if worker is running
npm run worker:logs     # tail live log output (Ctrl+C to exit)
```

---

## Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Environment Variables

Copy `.env.example` to `.env` and fill in your keys:

```
GLM_API_KEY=          # ZhipuAI
GLM_API_BASE=         # default: https://open.bigmodel.cn/api/paas/v4
DEEPSEEK_API_KEY=     # DeepSeek
DEEPSEEK_API_BASE=    # default: https://api.deepseek.com
ANTHROPIC_API_KEY=    # Anthropic
NEO4J_URI=            # e.g. bolt://localhost:7687
NEO4J_USERNAME=
NEO4J_PASSWORD=
```

---

## Testing

```bash
# Unit tests — LLM validation layer (no worker needed)
npx tsx test_llm_retry.ts

# End-to-end pipeline test (worker must be running)
npm run worker:start
npx tsx test_pipeline.ts
npm run worker:stop
```
