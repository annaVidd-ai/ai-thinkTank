# Cost Tracking — ThinkTank AI Pipeline

**Last updated:** 2026-06-13

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

---

## Phase 2 Actuals — Step 0 + Batch A (2026-06-12)

Measured from all `[LLM:cache]` lines dated 2026-06-12 in `logs/worker.log` (193 calls, 12:12–14:24). Covers Step 0 (Skeptic prompt validation, 9 runs: UNI/COMP/CRV ×3) + Batch A (vault expansion, 29 completed runs: RNDR/PENDLE/INJ/ENS ×6 + DYDX ×5; DYDX r3 lost to DeepSeek timeout).

| Model | Calls | in | cache_write | cache_read | out | Cost |
|-------|-------|-----|-------------|------------|-----|------|
| claude-sonnet-4-6 | 155 | 5,694 | 462,633 | 30,692 | 109,625 | $3.41 |
| claude-haiku-4-5-20251001 | 38 | 12,544 | 0 | 0 | 822 | $0.01 |
| **Anthropic total** | 193 | | | | | **$3.42** |
| deepseek-reasoner (est., not logged) | ~114 | ~6,000/run | — | — | ~2,400/run | ~$0.33 |
| **Grand total (38 runs)** | | | | | | **~$3.75** |

**Per-run average:** ~$0.099 (Anthropic $0.090 + DeepSeek ~$0.009) — slightly above the $0.091 May baseline; the new Skeptic prompt drives longer rebuttals/cache writes.

**Budget:** $9.20 authorized for Phase 2 → ~$5.45 remaining for Batch B (18 runs, ~$1.80) + Step 4 holdout (36 runs, ~$3.60). Projection: on budget, no headroom for re-runs beyond ~1 case.

---

## Phase 2 Actuals — Batch B (2026-06-13)

Measured from all `[LLM:cache]` lines dated 2026-06-13 in `logs/worker.log` (88 calls, 00:37–01:31). Covers Batch B training expansion: TIA ×6 + SEI ×6 + ARB ×5 (ARB r2 lost to DeepSeek timeout) = 17 completed runs.

| Model | Calls | in | cache_write | cache_read | out | Cost |
|-------|-------|-----|-------------|------------|-----|------|
| claude-sonnet-4-6 | 71 | 213 | 265,511 | 20,915 | 64,542 | $1.97 |
| claude-haiku-4-5-20251001 | 17 | 5,690 | 0 | 0 | 377 | $0.01 |
| **Anthropic total** | 88 | | | | | **$1.98** |
| deepseek-reasoner (est., not logged) | ~51 | | | | | ~$0.15 |
| **Grand total (17 runs)** | | | | | | **~$2.13** |

**Per-run average:** ~$0.125 — above the $0.099 Step 0/Batch A average; Batch B narratives are longer (~3.1k chars) and the new Skeptic prompt drives larger cache writes.

**Budget:** Phase 2 spend ≈ $5.88 of $9.20 → ~$3.32 remaining. Step 4 (36 holdout runs) projects to ~$3.60–4.50 at current per-run costs — projected overrun $0.3–1.2. **Director ruling 2026-06-13: top-up authorized on Anthropic Console** (~95% of Phase 2 spend is claude-sonnet-4-6; DeepSeek ~$0.15/Batch B is minor; GLM/Haiku negligible).

---

## Phase 2 Actuals — Step 4 Holdout + LINK Validation (2026-06-14)

Measured from all `[LLM:cache]` lines dated 2026-06-14 in `logs/worker.log` (195 calls, 00:07–10:09). Covers 36 holdout runs (KAS/TAO/FTM/APE/GLMR/HNT ×6, all completed — no timeouts) + 3 LINK validation runs = 39 runs total.

| Model | Calls | in | cache_write | cache_read | out | Cost |
|-------|-------|-----|-------------|------------|-----|------|
| claude-sonnet-4-6 | 156 | est | est | est | est | $3.83 |
| claude-haiku-4-5-20251001 | 39 | est | 0 | 0 | est | $0.01 |
| **Anthropic total** | 195 | | | | | **$3.83** |
| deepseek-reasoner (est., not logged) | ~117 | | | | | ~$0.35 |
| **Grand total (39 runs)** | | | | | | **~$4.18** |

**Per-run average:** ~$0.107 — between the $0.099 Step 0/Batch A and $0.125 Batch B averages. No DeepSeek timeouts this round (vs Batch A DYDX r3 and Batch B ARB r2). Cleanest run yet on infrastructure quality.

**Phase 2 cumulative actual:** Step 0 + Batch A ($3.75) + Batch B ($2.13) + Step 4 ($4.18) ≈ **$10.06**. Vs $9.20 base budget → top-up consumed ~$0.86 (well within authorized headroom). Director-side Anthropic Console balance should be checked before Step 5 iteration (if iteration adds ≥6 runs, plan for ≈ $0.60–0.75 more).

---

## Phase 2 Closeout — Final Tally (2026-06-14)

Step 5 is documentation/verdict only — no pipeline runs, no incremental cost. Final Phase 2 spend is therefore identical to the post-Step-4 cumulative.

| Stage | Runs | Cost |
|-------|------|------|
| Step 0 (Skeptic prompt validation) | 9 | ~$0.81 |
| Step 2 Batch A (vault re-incorporation) | 29 | ~$2.94 |
| Step 2 Batch B (TIA/ARB/SEI training expansion) | 17 | ~$2.13 |
| Step 3c (boundary computation) | 0 | $0 |
| Step 4 (36 holdout + 3 LINK) | 39 | ~$4.18 |
| Step 5 (verdict + documentation) | 0 | $0 |
| **Phase 2 TOTAL** | **94** | **~$10.06** |

**Budget vs actual:** $9.20 authorized base + Director top-up authorized 2026-06-13 → actual $10.06 → top-up consumed ~$0.86 (≈9% over base, well within authorized headroom).

**Phase 2 status: CLOSED.** v0.2 program complete. v0.3 scoping and budget request pending Director direction.
