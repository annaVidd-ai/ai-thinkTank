# Cost Tracking — ThinkTank AI Pipeline

**Last updated:** 2026-05-25

Token usage is logged automatically in `think-tank-ai/logs/worker.log` as `[LLM:cache]` lines for every Anthropic call. DeepSeek (Skeptic) is not logged — see separate section below.

---

## Pricing Reference

| Provider | Model | Input | Cache write | Cache read | Output |
|----------|-------|-------|-------------|------------|--------|
| Anthropic | claude-sonnet-4-6 | $3.00/M | $3.75/M | $0.30/M | $15.00/M |
| Anthropic | claude-haiku-4-5-20251001 | $0.80/M | — | — | $4.00/M |
| DeepSeek | deepseek-reasoner (v4-flash) | ~$0.55/M | — | — | ~$2.19/M |
| ZhipuAI | glm-4.7-flash | ~$0.05/M | — | — | ~$0.05/M |

*DeepSeek and GLM prices are approximate — check provider dashboards for current rates.*

---

## Per-Call Structure (one pipeline run)

Each backtest run fires these Anthropic calls in order:

| Call | Agent | Tokens (typical) | Notes |
|------|-------|-----------------|-------|
| Analyst R1 | claude-sonnet-4-6 | in ~800, out ~600 | Always cold — no cache reuse across debates |
| Analyst R2 | claude-sonnet-4-6 | in 3, cw ~1900, out ~800 | Writes R1 exchange to cache |
| Analyst R3 | claude-sonnet-4-6 | in 3, cw ~3000, out ~900 | Writes R1+R2 exchange to cache |
| Quant | claude-sonnet-4-6 | in 3, cw ~5000–7000, out ~95 | Writes full transcript; low output (JSON score) |
| Mapper | claude-haiku-4-5-20251001 | in ~315, out ~22 | No caching; very cheap |
| Skeptic R1–R3 | deepseek-reasoner | ~2000 in, ~800 out each | Not in Anthropic logs; 3 calls per run |

**Cache behaviour:** The `cache_control: ephemeral` breakpoint accumulates the growing debate transcript across R1→R2→R3→Quant within a single run. It does NOT persist across runs (each debate is a fresh context). The ~800-token cold hit on every Analyst R1 is the system prompt + narrative charged as regular input.

---

## Measured Per-Run Costs

Data from 2026-05-25 pilot (ZRX/BAT/CRV/ALGO) and marathon (UNI):

| Run | Case | Type | Analyst R1 | R2 | R3 | Quant | Haiku | **Total** |
|-----|------|------|-----------|----|----|-------|-------|---------|
| UNI r1 | winner | marathon | $0.0121 | $0.0197 | $0.0270 | $0.0225 | $0.0003 | **$0.082** |
| UNI r2 | winner | marathon | $0.0127 | $0.0182 | $0.0240 | $0.0219 | $0.0004 | **$0.077** |
| BAT r1 | control | pilot | $0.0115 | $0.0198 | $0.0259 | $0.0235 | $0.0003 | **$0.081** |
| BAT r2 | control | pilot | $0.0111 | $0.0212 | $0.0275 | $0.0237 | $0.0003 | **$0.084** |
| CRV r1 | control (complex) | pilot | $0.0200 | $0.0291 | $0.0350 | $0.0282 | $0.0003 | **$0.113** |
| CRV r2 | control (complex) | pilot | $0.0140 | $0.0275 | $0.0370 | $0.0284 | $0.0004 | **$0.107** |

**Range:** $0.077 – $0.113 per run  
**Average:** ~$0.091 per run  
**CRV is the outlier** — its veCRV complexity drives longer Analyst responses (~1200 tokens vs ~700 for BAT/UNI), inflating R3 and cache sizes.

---

## Marathon Cost Projections

| Run count | Est. Anthropic cost | Est. DeepSeek cost | Est. total |
|-----------|--------------------|--------------------|------------|
| 12 runs (pilot) | ~$1.10 | ~$0.10 | ~$1.20 |
| 72 runs (8W/6C training marathon) | ~$6.50 | ~$0.50 | ~$7.00 |
| 144 runs (full 18-case × blinded+unblinded) | ~$13.00 | ~$1.00 | ~$14.00 |

*Projections assume $0.091/run avg Anthropic + $0.007/run DeepSeek.*

---

## Cost Gate

Director threshold: **$0.30/run** for Sonnet Quant — if exceeded, switch Quant back to DeepSeek v4-flash.

Current measured average: **$0.091/run** — 3.3× below threshold. Safe to continue with Sonnet Quant.

**Why Sonnet Quant matters for cost:** The Quant call itself is cheap ($0.022–0.028/run) because output is tiny (~95 tokens of JSON). The bulk of cost is the Analyst R2+R3 calls ($0.018–0.037 each) that write the growing debate context to cache. Switching Quant to DeepSeek saves ~$0.025/run but risks returning to Δ=0.017 discrimination (known regression from Task 15/16).

---

## Token Log Format

Every Anthropic call in `logs/worker.log`:
```
[YYYY-MM-DD][HH:MM:SS] [LLM:cache] model=<model> in=<n> cache_write=<n> cache_read=<n> out=<n>
```

To extract and review:
```bash
grep "\[LLM:cache\]" logs/worker.log | grep "\[2026-05-25\]"
```
