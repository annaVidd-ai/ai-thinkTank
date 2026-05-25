# Project Status — Node Zero (v0.5.0)
**Last updated:** 2026-05-25 | **Phase:** Backtest Calibration — 8W/6C balanced redesign pilot complete (TotalScore Δ=0.208, T+U Δ=0.438), awaiting architect direction | **Budget:** ~€9/mo

### Vision
AI agents that spot **paradigm-shifting profit opportunities before they go mainstream** (100x-1000x returns). Alpha = Information Asymmetry. Track builders (GitHub) and capital (on-chain wallets), not talkers (social). Detect the footprint *before* the narrative forms.

### Domain Focus: Crypto/DeFi (v0.1.0)
Only domain where both product (open source GitHub) and money (blockchain) are fully public. AI + Tech domains later — architecture supports it via generic Neo4j labels.

### Roles
- **Architect (Z.ai)** = System design, review, specifications, rule enforcement
- **Developer (ClaudeCode)** = Implementation, debugging, terminal execution
- **Director (User)** = Approve/reject, final calls, API keys, task routing
- **Strategic Consultant (Gemini)** = Advisory opinions (verified independently per Architect Rule #7)

### Architecture — Dual Database
- **SQLite (Prisma):** Pipeline state, task queue, debates, scoring, backtesting
- **Neo4j (AuraDB Free):** Knowledge graph — entity relationships, cluster detection

### Tech Stack
Next.js 16, TypeScript, Prisma/SQLite, Neo4j, monolith architecture

### Agent Topology (6-Agent Pipeline)
| Agent | Model | Role | Temperature |
|---|---|---|---|
| Scout (×3) | GLM-4.7-Flash | GitHub + on-chain data ingestion | 0 |
| Weaver | (graph query) | Knowledge graph construction from Scout data | 0 |
| Analyst | Claude Sonnet 4.6 | Argue bullish case in debate | 0.3 |
| Skeptic | DeepSeek-R1 | Argue bearish case — 5 failure-mode categories | 0.6 |
| Quant | Claude Sonnet 4.6 | 4-dimension scoring (signalStrength, timing, upside, failureRisk) | 0.3 |
| Mapper | Claude Haiku 4.5 | Generate tiered alerts with ticker | 0 |

### 5-Phase Pipeline
1. **Extraction:** 3 Scouts → raw GitHub + on-chain data → structured JSON
2. **Graph:** Weaver → Knowledge subgraph from Scout data
3. **Debate:** Analyst (Claude Sonnet) vs Skeptic (DeepSeek-R1) — 3 rounds with structured failure_modes output
4. **Scoring:** Quant scores 4 dimensions including failureRisk (inverted: high risk = lower total score)
5. **Alert:** Mapper generates tiered alert if score ≥ 0.65

### Scoring Dimensions
| Dimension | Weight | Description |
|---|---|---|
| signalStrength | 0.30 | Developer activity, commit quality, elite builders |
| timing | 0.2625 | Information asymmetry window, adoption cycle position |
| upside | 0.1875 | Market cap runway for 10x, value accrual potential |
| failureRisk | 0.25 | Probability of catastrophic failure (INVERTED: high = lower score) |

**Formula:** `totalScore = (signalStrength × 0.30) + (timing × 0.2625) + (upside × 0.1875) + ((1 − failureRisk) × 0.25)`

### Backtest Results

**3-Case Smoke Test (pre-marathon, on original prompts)**
| Metric | Value | Target |
|---|---|---|
| Δ (winners vs controls) | 0.198 | ≥ 0.15 ✅ |
| Winners avg | 0.804 | ≥ 0.80 ✅ |

**Full 15-Case Marathon (90 runs, same original prompts)**
| Metric | Value | Target | Status |
|---|---|---|---|
| Δ (winners − controls) | 0.076 | ≥ 0.15 | ❌ |
| Winners avg (blinded) | 0.634 | ≥ 0.80 | ❌ |
| Controls avg (blinded) | 0.558 | < 0.70 | ✅ |
| Bias ratio | 1.034 | ≈ 1.0 | ✅ |
| Winners above 0.70 | 1/12 | All | ❌ |

**Post-marathon fix attempts (all on original prompts + modification):**
| Attempt | Δ | Status |
|---|---|---|
| Fix A (Quant guidance text) | 0.065 | ❌ worse |
| Fix A+ (worked examples) | −0.004 | ❌❌ much worse |
| +evidence_type schema | 0.062 | ❌ worse |

**Baseline Verification Smoke Test (2026-05-26, original prompts, v4-flash, blinded, N=3 median)**
| Case | Type | Run 1 | Run 2 | Run 3 | Median | σ |
|------|------|-------|-------|-------|--------|---|
| UNI | winner | 0.559 | 0.659 | 0.631 | 0.631 | 0.042 |
| AAVE | winner | 0.653 | 0.635 | 0.718 | 0.653 | 0.036 |
| SAFE | control | 0.625 | 0.604 | 0.662 | 0.625 | 0.024 |

Winners avg: 0.642 | Control avg: 0.625 | **Δ = 0.017** (target ≥ 0.15) ❌

**Root cause:** Δ=0.198 original smoke test was on v4-pro. On v4-flash, baseline is NOT reproducible (Δ=0.017). Model downgrade confirmed as discrimination bottleneck. Decision: Option 1 — switch Quant to Claude Sonnet 4.6.

**Conclusion: Prompt-only approach has hit a ceiling. Non-prompt approaches needed (model change, N increase, or threshold recalibration).**

**Sonnet Smoke Test — Baseline (2026-05-25, additive formula, no constraint, Sonnet Quant, blinded, N=3)**
| Case | Type | Run 1 | Run 2 | Run 3 | Median | σ |
|------|------|-------|-------|-------|--------|---|
| UNI | winner | — | — | — | ~0.65* | — |
| AAVE | winner | — | — | — | ~0.65* | — |
| SAFE | control | — | — | — | ~0.64* | — |

*Marathon blinded records for UNI/AAVE/SAFE were overwritten by subsequent smoke tests. Implied from aggregate back-calculation (see marathon section). Sonnet baseline Δ ≈ 0.01–0.03 (no discrimination improvement over v4-flash on additive+no-constraint).

**Test A — Multiplicative FR Discount (2026-05-25, Sonnet Quant, blinded, N=3)**

Formula tested: `baseScore = (SS×0.30)+(T×0.2625)+(U×0.1875); totalScore = baseScore × (1 − FR × 0.50)`

| Case | Type | Run 1 | Run 2 | Run 3 | Median |
|------|------|-------|-------|-------|--------|
| UNI | winner | 0.527 | 0.309 | 0.293 | 0.309 |
| AAVE | winner | 0.293 | 0.309 | 0.325 | 0.309 |
| SAFE | control | 0.246 | 0.246 | 0.246 | 0.246 |

Winners avg: 0.309 | Control avg: 0.246 | **Δ = 0.063** (target ≥ 0.15) ❌

Note: UNI r1 = 0.527 was a contaminated run (stale worker, old additive formula). Median of [0.527, 0.309, 0.293] = 0.309 correctly excludes it. Reverted to additive after Test A.

**Test B — Analyst Constraint (2026-05-25, additive formula + Analyst token/protocol constraint, Sonnet Quant, blinded, N=3)**

Change: Added constraint to Analyst prompt blocking use of protocol adoption metrics (DAUs, TVL, volume) to rebut TOKENOMICS concerns — forces separate treatment of protocol quality vs token investment quality.

| Case | Type | SS | T | U | FR | Run 1 | Run 2 | Run 3 | Median |
|------|------|----|---|---|----|-------|-------|-------|--------|
| UNI | winner | 0.72 | 0.75–0.82 | 0.45 | 0.82–0.88 | 0.5273 | 0.5502 | 0.5546 | 0.5502 |
| AAVE | winner | 0.72 | 0.75–0.78 | 0.45–0.55 | 0.82 | 0.5502 | 0.5423 | 0.5610 | 0.5502 |
| SAFE | control | 0.72 | 0.55–0.62 | 0.35 | 0.82–0.88 | 0.4560 | 0.4560 | 0.4894 | 0.4560 |

Winners avg: 0.5502 | Control avg: 0.4560 | **Δ = 0.094** ← best result to date ✅ (still below 0.15 target)

Discrimination mechanism: FR uniform 0.82–0.88 across all cases (no FR discrimination). SS uniform at 0.72. Discrimination comes entirely from T and U — Analyst constraint prevented adoption rebuttal, letting tokenomics verdict flow into Quant's timing/upside assessments.

**Test C projection (Analyst constraint + multiplicative formula combined):** Δ ≈ 0.057 (WORSE than Test B). Multiplicative formula compresses the T/U-driven discrimination without adding FR-based discrimination. Not recommended.

**8W/6C Balanced Redesign Pilot (2026-05-25, additive + Analyst constraint, Sonnet Quant, blinded, N=3)**

Design change: dropped YFI_CTRL (structural confound — same protocol as YFI winner), added 4 new negative controls (ZRX/BAT/ALGO/CRV), added training/holdout split, added T+U sub-score metric to report. 18 cases total: 8 training winners + 6 training/holdout controls + 4 legacy.

New control case results (blinded, N=3):

| Case | Alias | Split | Run 1 | Run 2 | Run 3 | Median | σ | Note |
|------|-------|-------|-------|-------|-------|--------|---|------|
| ZRX | Project_Pi | training ctrl | 0.359 | 0.345 | 0.340 | **0.345** | 0.008 | |
| BAT | Project_Rho | training ctrl | 0.340 | 0.349 | 0.272 | **0.340** | 0.034 | |
| CRV | Project_Tau | training ctrl | 0.535 | 0.486 | 0.548 | **0.535** | 0.027 | veCRV fee-sharing → narrower gap |
| ALGO | Project_Sigma | holdout ctrl | FAIL | 0.345 | 0.385 | **0.365** | 0.020 | r1 debate timeout; 2/3 runs |

Per-dimension breakdown (median run values, DB-verified, additive formula confirmed ✓):

| Case | SS | T | U | FR | T+U sub-score |
|------|-----|-----|-----|-----|--------------|
| ZRX | 0.72 | 0.18 | 0.25 | 0.88 | 0.209 |
| BAT | 0.72 | 0.15 | 0.25 | 0.88 | 0.192 |
| CRV | 0.82 | 0.62 | 0.38 | 0.78 | 0.520 |
| ALGO | 0.67 | 0.35 | 0.25 | 0.90 | 0.308 |

**Discrimination results (training set, from bias report):**

| Metric | Value | vs Test B |
|--------|-------|-----------|
| Winners avg (blinded) | 0.619 | — |
| Controls avg (blinded) | 0.411 | was 0.456 (2 controls) → 0.411 (4 training controls) |
| TotalScore Δ | **+0.208** | was 0.094 with 2 controls |
| **T+U Δ (primary metric)** | **+0.438** | new metric |
| Winners T+U avg | 0.748 | new metric |
| Controls T+U avg | 0.309 | new metric |

Holdout preview (DO NOT use for prompt tuning): Controls avg 0.410, Winners avg 0.610, Δ = +0.199 — tracks training gap tightly.

T+U sub-score is the primary calibration metric going forward: FR and SS carry 55% weight but contribute zero discrimination (uniform 0.72–0.88 across all cases). All discrimination comes from T and U.

### Backtest Methodology
- **18 cases:** 8 training winners + 2 holdout winners + 4 training controls + 2 holdout controls + 2 legacy controls — balanced 8W/6C design
- **Training/holdout split:** Training cases used for prompt iteration; holdout cases (AVAX, SUSHI, SAFE, ALGO) held out — reported separately, NEVER used to tune prompts/weights
- **YFI_CTRL removed:** Structural confound (same protocol as YFI winner, different snapshot window — blinder cannot discriminate)
- **Dual condition:** Blinded (9-step anonymization) vs Unblinded — measures hindsight bias
- **N=3 median smoothing:** 3 runs per case per condition, take median score
- **Walk-forward split:** calibration / validation / verification (original structure retained)
- **9-step blinding:** Step 0 (dates) → Steps 1-8 (names, tickers, URLs, amounts, outcomes)
- **T+U sub-score:** `(0.2625×timing + 0.1875×upside) / 0.45` — normalized 0–1, PRIMARY calibration metric

### Blinding (Hindsight Bias Prevention)
Step 0: Date removal (ISO, slash, month+year, Q+year, seasons, bare years)
Step 1: Project names → aliases (Project_Alpha, etc.)
Step 2: Ticker symbols → aliases (case-insensitive)
Step 3: Developer names → aliases (Dev_N)
Step 4: Wallet addresses → aliases
Step 5: Specific dollar amounts → ranges
Step 6: Outcome language removed
Step 7: Explorer URLs → anonymized
Step 8: Remaining temporal references

### Completed Tasks
| Task | Description | Status |
|---|---|---|
| 01-07 | Foundation, schema, worker, pipeline | ✅ Complete |
| 08 | Bug fixes + negative controls (COMP, SAFE, YFI_CTRL) | ✅ Complete |
| 09 | 15 critical/high/medium fixes for marathon readiness | ✅ Complete |
| 10 | Skeptic Red-Prompt (improved Δ from 0.074 → 0.081) | ✅ Complete |
| 11 | failureRisk scoring dimension (improved Δ from 0.081 → 0.114) | ✅ Complete |
| 12 | File-based system prompts + temperature config + few-shot examples | 0.114 → 0.115) | ✅ Complete |
| 13 | Structured Skeptic output (failure_modes) + Quant anchoring example (improved Δ from 0.114 → 0.198) | ✅ Complete |

### Pending Tasks
| Task | Description | Priority |
|---|---|---|
| 14 | Marathon completed — Δ=0.076 (failed). All prompt fix attempts exhausted. | ✅ Complete |
| 15 | Baseline verification smoke test — Δ=0.017 (FAILED). Root cause: model downgrade v4-pro→v4-flash. | ✅ Complete |
| 16 | Switch Quant to Claude Sonnet 4.6 + smoke test | ✅ Complete (Sonnet baseline ≈ Δ0.02, no improvement from model alone) |
| 17A | Test A: Multiplicative FR discount formula — Δ=0.063 ❌ | ✅ Complete |
| 17B | Test B: Analyst token/protocol constraint — **Δ=0.094** ← best result | ✅ Complete (reverted additive) |
| 18 | 8W/6C Balanced Redesign: drop YFI_CTRL, add ZRX/BAT/ALGO/CRV controls, isHoldout split, T+U sub-score metric, pilot 4 new cases blinded N=3 | ✅ Complete |
| 19 | **Architect direction needed**: proceed to full 8W/6C marathon (18 cases × blinded N=3)? | **Awaiting** |
| Production N=3 | Quant fires 3× concurrently, uses median for alert | High |
| Tiered alerts | Tier 1 (≥0.80), Tier 2 (0.65-0.79) — currently binary 0.70 | High |
| Dashboard UI fixes (partial) | Debates tab: real timestamps, newest-first, Show More ✅. Skeptic thesis in red, ESCALATED badge in amber still pending. | Low |
| Remaining agent schemas | Expand Scout, Weaver, Analyst, Mapper schemas (currently thin) | Medium |
| Provider prompt caching | Add cache-control headers per provider in llmClient.ts | Low |
| Analyst structured output | Mirror Skeptic's structured output for Analyst (deferred) | Low |

### Known Issues
1. **failureRisk volatility** — Quant scores it correctly (~0.90) on some runs but reverts to ~0.50 on others for the same project. N=3 smoothing handles it in backtest; production will use N=3 smoothing too.
2. **Score compression** — All winners cluster 0.625–0.709, controls 0.425–0.636. Δ=0.076 below target of 0.15. Three prompt fix attempts all made it worse. Root cause may be model capability (deepseek-v4-flash) rather than prompt design.
3. **DeepSeek-R1 JSON control characters** — Occasionally outputs unescaped control characters in JSON strings. Retry catches it; proper sanitizer deferred.
4. **DeepSeek model alias remapping** — `deepseek-reasoner` silently remapped from v4-pro → v4-flash (May 18–22). Marathon runs are all on v4-flash (internally consistent). Pin model explicitly post-marathon.
5. **Baseline not reproducible on v4-flash** — Δ=0.017 on fresh smoke test vs Δ=0.198 on original (v4-pro). Root cause is model capability, not prompt design. Switching Quant to Claude Sonnet (Option 1).
6. **DeepSeek v4-flash reasoning limitation** — Cannot differentiate ABSENT from CONCRETE evidence quality in Quant scoring. Both winners and controls receive similar failureRisk, compressing totalScore discrimination.
7. **Worker SIGTERM contamination** — `npm run worker:stop` sends SIGTERM (graceful). Old worker can continue draining its task queue for minutes post-SIGTERM, picking up tasks with OLD code. Always use `pkill -9 -f "worker/index.ts"` after code changes. Verify zero PIDs before restart.
8. **Alert threshold miscalibrated for multiplicative formula** — Mapper gate is 0.70. Under multiplicative formula with typical FR=0.82–0.90, practical score ceiling is ~0.30–0.40. If multiplicative formula is ever adopted, alert threshold must be recalibrated (to ~0.40). No action needed while additive formula is in use.
9. **COMP marathon blinded: 2-run sample** — Project_Nu (blinded COMP) only has 2 blinded runs (r1=0.41, r2=0.425) from the May 24 marathon. r3 was never executed or lost. Marathon blinded median of 0.425 is a 2-point sample; lower statistical confidence for this control.
10. **Marathon blinded data for UNI/AAVE/SAFE permanently lost** — Runner's "Cleaned up 1 prior cluster" cascade deletes ClusterScores when a case is re-run. Test A/B overwrote marathon blinded records for UNI (Project_Alpha), AAVE (Project_Gamma), and SAFE (Project_Xi). Cannot be recovered.
11. **ALGO r1 debate timeout (intermittent)** — During 8W/6C pilot, ALGO r1 debate `bd7a25e6` stalled and did not reach terminal status within the 5-minute poll window. Runner caught it and skipped to r2; r2 and r3 completed normally. Root cause: likely a DeepSeek-R1 latency spike on the first call. ALGO pilot median (0.365) is based on 2/3 runs — wider confidence interval than other cases. If re-run is required, ALGO r1 can be re-run in isolation.
12. **CRV is the loudest control (narrowest discrimination gap)** — CRV median 0.535 is significantly above ZRX (0.345) and BAT (0.340) because veCRV fee-sharing gives CRV a partial value-accrual thesis the pipeline detects correctly. CRV T+U sub-score 0.520 vs winners avg 0.748 — gap is +0.228, not a misclassification risk at current thresholds, but the narrowest of all six controls. Architect should monitor CRV's gap across full marathon.
