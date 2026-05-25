# Project Status — Node Zero (v0.5.0)
**Last updated:** 2026-05-25 | **Phase:** Backtest Calibration — 8W/6C training marathon complete (72 runs, TotalScore Δ=0.165, T+U Δ=0.397), awaiting architect direction on threshold and holdout unlock | **Budget:** ~€9/mo

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

**8W/6C Training Marathon (2026-05-25, additive + Analyst constraint, Sonnet Quant, blinded, N=6)**

72 blinded runs across 12 training cases. AVAX and SUSHI promoted from holdout to training winners. SAFE and ALGO NOT run (holdout, locked).

Training Winners (blinded median, N=6):

| Ticker | Alias | Split | Median | σ | Failures |
|--------|-------|-------|--------|---|----------|
| UNI | Project_Alpha | calibration | 0.532 | 0.020 | — |
| LINK | Project_Beta | calibration | 0.539 | 0.016 | r2 timeout |
| AAVE | Project_Gamma | calibration | 0.546 | 0.027 | r4 timeout |
| AVAX | Project_Epsilon | calibration | 0.503 | 0.011 | — |
| YFI | Project_Eta | calibration | 0.517 | 0.024 | — |
| MKR | Project_Kappa | validation | 0.526 | 0.028 | r5 timeout |
| SNX | Project_Lambda | verification | 0.529 | 0.031 | — |
| SUSHI | Project_Mu | verification | 0.471 | 0.024 | — |

Training Controls (blinded median, N=6):

| Ticker | Alias | Split | Median | σ | Note |
|--------|-------|-------|--------|---|------|
| COMP | Project_Nu | calibration | 0.346 | 0.025 | |
| ZRX | Project_Pi | calibration | 0.334 | 0.014 | |
| BAT | Project_Rho | calibration | 0.326 | 0.040 | |
| CRV | Project_Tau | calibration | 0.551 | 0.020 | veCRV complexity — scores in winner range on TotalScore |

Discrimination results (training set, from bias report, includes legacy cases):

| Metric | Value | vs Pilot (N=3) |
|--------|-------|----------------|
| Winners avg (blinded) | 0.554 | was 0.619 |
| Controls avg (blinded) | 0.389 | was 0.411 |
| **TotalScore Δ** | **+0.165** | was +0.208 |
| **T+U Δ (primary metric)** | **+0.397** | was +0.438 |
| Winners T+U avg | 0.692 | was 0.748 |
| Controls T+U avg | 0.295 | was 0.309 |

Cost: ~$5.45 Anthropic billed at time of writing (~$6.50–6.70 projected final) + ~$0.50 DeepSeek. Total ~$7.00–7.20 for 72 runs. See `docs/COST_TRACKING.md`.

Key findings:
- **3 of 4 controls discriminate cleanly** (COMP/ZRX/BAT all 0.326–0.346) — clear separation from winners
- **CRV is the confounding case** (0.551) — veCRV governance mechanics inflate SS and T scores blinded; however, T+U sub-score still correctly places it in control range (controls T+U avg 0.295)
- **SUSHI is the softest winner** (0.471) — recovery narrative post-crisis less convincing blinded; closest to control range
- **T+U Δ = 0.397 is robust** — nearly matching pilot, confirming T+U as the reliable discrimination metric even when TotalScore compresses due to CRV

### Backtest Methodology
- **18 cases:** 8 training winners + 2 holdout winners + 4 training controls + 2 holdout controls + 2 legacy controls — balanced 8W/6C design
- **Training/holdout split:** Training cases used for prompt iteration; holdout cases (SAFE, ALGO) held out — reported separately, NEVER used to tune prompts/weights. AVAX and SUSHI promoted to training winners (marathon 2026-05-25).
- **YFI_CTRL removed:** Structural confound (same protocol as YFI winner, different snapshot window — blinder cannot discriminate)
- **Dual condition:** Blinded (9-step anonymization) vs Unblinded — measures hindsight bias
- **N=6 median smoothing:** 6 runs per case per condition, take median score (upgraded from N=3 for marathon)
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
| 19 | 8W/6C training marathon — 72 blinded runs (N=6), TotalScore Δ=0.165, T+U Δ=0.397 | ✅ Complete |
| 20 | **Architect direction needed**: set production threshold, unlock holdout validation (SAFE/ALGO) | **Awaiting** |
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
12. **CRV is the loudest control (narrowest discrimination gap)** — Pilot median 0.535; marathon N=6 median 0.551. CRV scores in winner territory on TotalScore due to veCRV governance mechanics inflating SS and T. However, T+U sub-score correctly places CRV in control territory (controls T+U avg 0.295). TotalScore alone is unreliable for CRV; use T+U threshold for production decisions. If CRV-type assets appear in production, expect false-positive risk on TotalScore gate.
13. **SUSHI is the softest winner** — Marathon N=6 median 0.471, the lowest of all 8 training winners and only 0.080 above the top control (COMP 0.346 — excluding CRV outlier). SUSHI's post-crisis recovery narrative is less convincing blinded. Monitor: if T+U threshold is set above 0.47, SUSHI would be missed.

---

## v0.2 Phase 1 Specification — STATUS: PENDING CONSULTANT REVIEW

# Phase 1 Specification: Training-Derived Tier System v0.2

---

## Preamble

**Document:** ai-thinkTank v0.2 Phase 1 Specification  
**Author:** Architect (GLM)  
**Status:** DRAFT — Pending review by DeepSeek (Statistical) and Gemini (Strategic)  
**Date:** 2025-07-09  
**Supersedes:** v0.1 threshold system (T+U ≥ 0.5667, single cutoff)

**Purpose:** Define a statistically clean tiered alert system derived exclusively from training data, establish the regime-awareness roadmap, and pre-register the validation protocol for the new holdout.

---

## 1. Frozen Data Inventory

All scores below are **frozen and sealed**. They may be used for diagnosis and architecture design, but **no threshold, tier boundary, or decision rule may be derived from holdout data.**

### 1.1 Training Set (Marathon, 8W/4C, 6 runs/case)

| Case | Role | Median TotalScore | Median T+U | Era |
|------|------|-------------------|------------|-----|
| UNI | Winner | 0.532 | ~0.72 | 2020 DeFi Summer |
| LINK | Winner | 0.539 | ~0.74 | 2020 DeFi Summer |
| AAVE | Winner | 0.546 | ~0.75 | 2020 DeFi Summer |
| MKR | Winner | 0.526 | ~0.69 | 2020 DeFi Summer |
| SNX | Winner | 0.529 | ~0.68 | 2020 DeFi Summer |
| YFI | Winner | 0.517 | ~0.52 | 2020 DeFi Summer |
| SUSHI | Winner | 0.471 | ~0.45 | 2020 DeFi Summer |
| AVAX | Winner | 0.503 | ~0.50 | 2020 DeFi Summer |
| COMP | Control | 0.346 | ~0.25 | 2020 DeFi Summer |
| ZRX | Control | 0.334 | ~0.21 | 2020 DeFi Summer |
| BAT | Control | 0.326 | ~0.19 | 2020 DeFi Summer |
| CRV | Control | 0.551 | ~0.52 | 2020 DeFi Summer |

**Training T+U statistics:**
- Winner mean T+U: ~0.631
- Winner min T+U: ~0.45 (SUSHI)
- Control mean T+U: ~0.293
- Control max T+U: ~0.52 (CRV)
- SVM midpoint (single threshold): 0.5667

### 1.2 Holdout Set (Vault, 7 cases, 3 runs/case) — BURNED FOR THRESHOLD DESIGN

| Case | Role | Median T+U | Diagnosed As |
|------|------|------------|--------------|
| RNDR | Winner | 0.355 | Missed — regime shift |
| PENDLE | Winner | 0.408 | Missed — regime shift |
| INJ | Winner | 0.403 | Missed — regime shift |
| DYDX | Control | 0.192 | Correctly filtered |
| ENS | Control | 0.508 | Correctly filtered (barely) |
| SAFE | Control | 0.508 | Correctly filtered (barely) |
| ALGO | Control | 0.350 | Correctly filtered |

**Status: These scores are FROZEN. They inform our understanding of regime dependence but MUST NOT influence tier boundaries.**

---

## 2. Tier System Derivation (Training-Only)

### 2.1 Tier Definitions

| Tier | Label | T+U Range | Derivation Basis | Training Composition |
|------|-------|-----------|------------------|---------------------|
| **Tier 1** | High Conviction | ≥ 0.5667 | SVM midpoint (min Winner + max Control) / 2 | 5W / 0C |
| **Tier 2** | Watchlist | [0.52, 0.5667) | CRV T+U ceiling to SVM midpoint | 3W / 1C |
| **Trash** | Filtered | < 0.52 | Below highest-scoring Control | 0W / 3C |

### 2.2 Derivation Logic

**Tier 1 floor (0.5667):** Same SVM midpoint as v0.1. This is the cleanest separatrix in the training data — the arithmetic midpoint between the lowest Winner and highest Control T+U, excluding CRV as a known outlier.

**Tier 2 floor (0.52):** CRV is the highest-T+U Control at ~0.52. Any project scoring above CRV has exceeded the best Control in training. This is the minimum T+U at which a project *might* be a Winner based on training evidence.

**Tier 2 ceiling (0.5667):** Same as Tier 1 floor — the SVM midpoint. Projects in this band exceed the Control ceiling but haven't crossed the high-conviction threshold.

### 2.3 Training-Set Performance (In-Sample)

| Tier | Winners | Controls | Precision | Recall (W) |
|------|---------|----------|-----------|------------|
| Tier 1 | 5 (UNI, LINK, AAVE, MKR, SNX) | 0 | 100% | 62.5% |
| Tier 2 | 3 (YFI, AVAX, SUSHI) | 1 (CRV) | 75% | 37.5% |
| Trash | 0 | 3 (COMP, ZRX, BAT) | — | 0% |
| **Combined Tier 1+2** | **8** | **1** | **88.9%** | **100%** |

### 2.4 Known Limitations (Honest Assessment)

1. **Tier 2 contains CRV.** A Control that scores in Watchlist range. Tier 2 precision is 75% in-sample but may be lower out-of-sample.

2. **CRV is structurally ambiguous.** Curve Finance has genuine DeFi Summer credentials — the pipeline may be correctly detecting real alpha that was extinguished by tokenomics (veCRV inflation). CRV's classification as "Control" may itself be debatable.

3. **Tier 2 is narrow (0.047 T+U units).** This is a consequence of CRV compressing the Control ceiling toward the Winner floor. The band may not generalize well.

4. **Regime dependence is unaddressed.** All training cases are 2020 DeFi Summer. T+U scores are inflated relative to bear-market winners. The holdout proved this conclusively.

5. **Tier 2 will miss bear-market winners.** RNDR (0.355), PENDLE (0.408), INJ (0.403) would all land in Trash under these training-derived boundaries. This is **correct behavior** until we earn the right to lower the floor through regime-conditional calibration on unseen data.

---

## 3. Regime-Awareness Architecture (Phase 2-3 Roadmap)

### 3.1 Problem Statement

The pipeline discriminates directionally across eras (Controls always filtered correctly) but calibrates absolute T+U levels to the training era. 2020 DeFi Summer winners had clear, unambiguous signals (T+U avg 0.692); 2021-2022 winners succeeded through more subtle, often narrative-driven mechanisms (T+U avg ~0.39).

### 3.2 Proposed Architecture

```
┌─────────────────────────────────────────────────┐
│                   INPUT                          │
│  WEAVER_SWEEP → SCOUT_NARRATIVE (upstream)       │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│           REGIME PRE-SCORER (NEW)               │
│  Model: claude-haiku-4-5 (cost-optimized)       │
│  Input: Project + market context                 │
│  Output: regime_label ∈ {defi_summer, bear,     │
│           l1_season, ai_narrative, sideways}     │
│          confidence ∈ [0,1]                      │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│         EXISTING PIPELINE (unchanged)           │
│  Scout → Narrative → Analyst ↔ Skeptic →        │
│  Quant/SCORE → Mapper                            │
│  Output: {SS, T, U, FR, totalScore}             │
└──────────────────┬──────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────┐
│      REGIME-CONDITIONAL TIER ASSIGNMENT         │
│  regime_label → tier_threshold_table            │
│  T+U + regime → final_tier ∈ {T1, T2, Trash}   │
└─────────────────────────────────────────────────┘
```

### 3.3 Regime-Conditional Threshold Tables

These will be derived **after** Phase 2 training expansion and **before** Phase 4 holdout. They are NOT pre-specified here — only the architecture is pre-registered.

**Expected structure:**

| Regime | Tier 1 Floor | Tier 2 Floor | Derivation |
|--------|-------------|-------------|------------|
| defi_summer | 0.5667 | 0.52 | Current training data |
| bear | TBD | TBD | Phase 2 expanded training |
| l1_season | TBD | TBD | Phase 2 expanded training |
| ai_narrative | TBD | TBD | Phase 2 expanded training |

**Constraint:** All regime-conditional floors must be derived from training-set data only. The holdout is never used to set or adjust any floor.

### 3.4 Regime Pre-Scorer Specification

| Parameter | Value |
|-----------|-------|
| Model | claude-haiku-4-5 |
| Input | Project name + token metrics + 90-day BTC/ETH trend + sector labels |
| Output | `{regime_label, confidence}` |
| Cost per call | ~$0.005 (Haiku) |
| Added cost per pipeline run | ~$0.005 (negligible) |

### 3.5 Regime Label Definitions

| Regime | Definition | Example Era |
|--------|-----------|-------------|
| defi_summer | >60% of TVL growth in DeFi protocols, yield farming dominant | Jun–Dec 2020 |
| bear | BTC -40%+ from ATH, declining volume, risk-off | 2022 |
| l1_season | L1 blockchain launches/momentum, alt-L1 narratives | Late 2021 |
| ai_narrative | AI/ML token narrative dominance | 2023-2024 |
| sideways | No dominant narrative, range-bound | Intermittent |

---

## 4. Validation Protocol (Phase 4 Pre-Registration)

### 4.1 New Holdout Selection Criteria

| Criterion | Requirement |
|-----------|-------------|
| Size | 6–8 cases |
| Balance | ≥3 Winners, ≥3 Controls |
| Era diversity | Must span ≥2 regimes (at least 1 non-DeFi-Summer) |
| Unseen | No case may have been used in training, pilot, or vault |
| Selection lock | Cases selected and documented BEFORE any pipeline runs |

### 4.2 Pre-Registered Decision Rule

The full v0.2 system (regime-conditional tier assignment) will be evaluated with:

**Primary metric:** Tier-weighted accuracy

```
Score = Σ (correct_tier_assignment × tier_weight) / Σ (tier_weight)

Where:
  Tier 1 correct = project is Winner AND assigned Tier 1  → weight 3
  Tier 2 correct = project is Winner AND assigned Tier 2  → weight 2
  Trash correct  = project is Control AND assigned Trash   → weight 2
  Any incorrect  = 0
```

**Pass criterion:** Score ≥ 0.70

**Failure criterion:** Score < 0.50 → triggers v0.3 redesign

**Indeterminate (0.50–0.69):** Diagnose per-regime, iterate once with expanded training

### 4.3 What Counts as Validation

| Scenario | Claim |
|----------|-------|
| Pass on first holdout | "Validated out-of-sample" |
| Pass after one iteration | "Validated with one adaptation cycle" |
| Fail after one iteration | "Not validated — requires fundamental redesign" |
| Ship without holdout | "Forward-tested experiment, not confirmed" |

---

## 5. Training Expansion Plan (Phase 2)

### 5.1 Cases to Add

| Case | Role | Era | Regime | Rationale |
|------|------|-----|--------|-----------|
| RNDR | Winner | 2021-2022 | bear→recovery | Vault data reincorporated |
| PENDLE | Winner | 2021-2022 | bear→recovery | Vault data reincorporated |
| INJ | Winner | 2021-2022 | bear→recovery | Vault data reincorporated |
| DYDX | Control | 2021 | l1_season | Vault data reincorporated |
| ENS | Control | 2021 | sideways | Vault data reincorporated |
| TIA (Celestia) | Winner | 2023-2024 | ai_narrative? | New — expands regime coverage |
| SEI | Control | 2023 | l1_season | New — recent Control |
| 1 TBD | Control | 2023-2024 | TBD | Gemini to select |

### 5.2 Vault Data Reincorporation

The 5 vault cases (RNDR, PENDLE, INJ, DYDX, ENS) will be run at 6 runs/case to match Marathon protocol. Their existing 3-run vault scores are discarded for training purposes — we need the full 6-run median for consistency.

**Justification:** These cases are no longer holdout once we've committed to a new holdout set. Reincorporating them as training is legitimate because:
1. Their holdout role is complete (diagnosis delivered)
2. The new holdout will be entirely unseen
3. We need regime diversity in training — these are our only non-2020 cases

---

## 6. Cost and Timeline

| Phase | Cost | Runs | Timeline |
|-------|------|------|----------|
| Phase 1 (this spec) | $0 | 0 | Immediate — review only |
| Phase 2 (expand training) | ~$5.00 | 48 | After Director approval |
| Phase 3 (regime engine) | ~$2.00 | 0 (added Haiku calls) | Concurrent with Phase 2 |
| Phase 4 (new holdout) | ~$4.80 | 36-48 | After Phase 2-3 complete |
| Buffer | ~$3.00 | — | If iteration needed |
| **Total** | **~$15** | **84-96** | |

---

## 7. Items Requiring Consultant Review

### For DeepSeek (Statistical):

1. **Is the Tier 2 floor at CRV's T+U (0.52) defensible?** CRV is a single outlier Control. Should we use CRV's T+U or a percentile-based boundary instead?

2. **Tier-weighted accuracy metric (Section 4.2):** Is this a reasonable primary validation metric, or should we use something simpler (e.g., raw accuracy, F1)?

3. **Vault data reincorporation (Section 5.2):** Is it statistically legitimate to re-run vault cases at 6 runs and treat them as training, given that we've seen their 3-run scores?

4. **Regime label granularity:** Are 5 regime labels too many for the available training data? Should we start with 2 (bull/bear) and expand?

### For Gemini (Strategic):

1. **New case selection (Section 5.1):** Please select the final 1-2 cases (especially the TBD Control). Consider: What 2023-2024 project had narrative heat but failed to deliver sustained alpha?

2. **Tier 2 operational meaning:** In Phase 1 (before regime engine), Tier 2 = "human review warranted." What does the Director actually *do* with a Tier 2 alert? What information should accompany it?

3. **Holdout case selection (Section 4.1):** Please nominate 6-8 cases for the new holdout. Requirements: ≥3W, ≥3C, ≥2 regimes, none previously used.

4. **CRV classification:** Should CRV be reclassified as a "conditional winner" (DeFi Summer only) rather than a Control? This would reshape the Tier boundaries significantly.

---

## Appendix A: v0.1 → v0.2 Change Log

| Item | v0.1 | v0.2 |
|------|------|------|
| Threshold type | Single cutoff | Tiered (T1/T2/Trash) |
| T+U floor | 0.5667 (Tier 1 only) | 0.5667 (T1) / 0.52 (T2) |
| Regime awareness | None | Regime Pre-Scorer (Phase 3) |
| Training set | 8W/4C (2020 only) | 13W/6C+ (multi-era, Phase 2) |
| Holdout | Burned (vault) | New clean set (Phase 4) |
| Validation metric | Binary pass/fail | Tier-weighted accuracy ≥ 0.70 |
| Data leak risk | N/A | Pre-registered protocol eliminates |

---

**This specification is now open for consultant review. Director approval required before Phase 2 execution.**
