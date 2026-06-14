# Project Status — Node Zero (v0.5.0)
**Last updated:** 2026-06-14 | **Phase:** v0.2 Phase 2 — COMPLETE (INDETERMINATE, diagnosed, no iteration) | **Budget:** ~€9/mo + ~$12 one-time v0.2 program

### Vision
AI agents that spot **paradigm-shifting profit opportunities before they go mainstream**. Target: 10x+ returns (Director decision 2026-06-11; calibrated into the engine — changing this bar invalidates Δ baselines and case labels). 100x–1000x aspirational. Alpha = Information Asymmetry. Track builders (GitHub) and capital (on-chain wallets), not talkers (social). Detect the footprint *before* the narrative forms.

### Domain Focus: Crypto/DeFi (v0.1.0)
Only domain where both product (open source GitHub) and money (blockchain) are fully public. AI + Tech domains later — architecture supports it via generic Neo4j labels.

### Roles
- **Chief Systems & Research Architect (Z.ai)** = System design, review, specifications, rule enforcement; adjudicates technical disputes (Director remains final)
- **Developer (ClaudeCode)** = Implementation, debugging, terminal execution
- **Director (User)** = Approve/reject, final calls, API keys, task routing
- **Strategic Consultant (Gemini)** = Advisory opinions (verified independently per Architect Rule #7)
- **Statistical Consultant (DeepSeek)** = Statistical review of thresholds, metrics, and validation protocols (verified independently per Architect Rule #7)

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

### Vault Run (Holdout Validation)

| Case | Role | Median T+U | Correct? |
|------|------|-----------|----------|
| RNDR | Winner | 0.355 | ❌ MISS |
| PENDLE | Winner | 0.408 | ❌ MISS |
| INJ | Winner | 0.403 | ❌ MISS |
| DYDX | Control | 0.192 | ✅ |
| ENS | Control | 0.508 | ✅ |
| SAFE | Control | 0.508 | ✅ |
| ALGO | Control | 0.350 | ✅ |

Result: 2/5 confirmation correct. T+U threshold 0.5667 missed all 3 bear-era winners. Triggered "major redesign" rule. Vault data FROZEN for threshold design — diagnosis only.

### Regime Dependence Diagnosis

Training winners (2020 DeFi Summer) T+U avg 0.692 vs confirmation winners (2021–2022 bear) T+U avg ~0.39. The pipeline discriminates directionally across eras, but absolute T+U levels are calibrated to the bull market. Controls correctly filtered in all eras.

### v0.2 Tier System Specification (Director-Approved)

- Single global tier system (no regime-conditional thresholds for v0.2)
- T+U sub-score as primary metric (retained)
- Tier boundaries derived from expanded training set ONLY (post Phase 2)
- Current training-derived boundaries: Tier 1 ≥ 0.5667 (SVM midpoint), Tier 2 ≥ 0.52 (CRV ceiling), Trash < 0.52
- Boundaries will be recomputed after Phase 2 training expansion
- Tier 2 = Director's Dossier (venture sizing 0.25%), includes Skeptic's primary argument + regime tag
- Regime labels: binary Bull/Bear via BTC 200DMA — diagnostic tag only, NOT used for threshold selection
- CRV remains classified as Control (Gemini ruling — reclassifying would collapse Tier 2 floor to ~0.25)

### v0.2 Holdout Set (LOCKED — Pre-Registered)

| Alias | Token | Role | Snapshot Era | Regime |
|-------|-------|------|-------------|--------|
| Project_Alpha | KAS | Winner | Late 2022 | Bear |
| Project_Beta | TAO | Winner | Early 2023 | Bear |
| Project_Gamma | FTM | Winner | Mid 2021 | Bull |
| Project_Delta | APE | Control | Early 2022 | Bear |
| Project_Epsilon | GLMR | Control | Late 2021 | Bull |
| Project_Zeta | HNT | Control | Late 2021 | Bull |

Regime rule: BTC above 200DMA at snapshot = Bull; below = Bear.

### v0.2 Evaluation Protocol (Pre-Registered)

- Primary A: Winner recall (Winners in T1 or T2) ≥ 75%
- Primary B: Control trash rate (Controls in Trash) ≥ 75%
- Pass: Both A and B met
- Fail: Either < 50%
- Indeterminate: all other outcomes → diagnose, iterate once
- Secondary: tier-weighted accuracy + per-regime breakdown (diagnostic only)

### v0.2 Training Expansion Plan (Phase 2)

- Vault re-incorporation: RNDR, PENDLE, INJ (W), DYDX, ENS (C) × 6 runs each = 30 runs
- New cases: TIA (W), ARB (C), SEI (C) × 6 runs each = 18 runs
- Total: 48 runs, est. ~$4.80
- Sequencing: lock holdout cases + protocol BEFORE examining vault 6-run scores
- Post-expansion: compute fresh global tier boundaries from 21 training cases combined

### Phase 2 Step 0: Skeptic Prompt Validation (2026-06-12) — LOCKED

New DeepSeek-proposed Skeptic prompt (mandatory 4-step internal analysis per category, strict ABSENT/CONCRETE evidence discipline, CoT before JSON) validated on UNI/COMP/CRV, blinded N=3. Zero JSON parse errors in 27 Skeptic calls. All 9 scores DB-verified against additive formula; no hard stops; σ within norms. Locked prompt backed up at `agents/Agent_Skeptic_Instructions_LOCKED_BACKUP.md` (from git HEAD d57ac07).

| Case | Type | Run 1 | Run 2 | Run 3 | Median Total | Median T+U | σ |
|------|------|-------|-------|-------|--------------|------------|---|
| UNI | winner | 0.6272 | 0.6172 | 0.5621 | 0.6172 | 0.725 | 0.029 |
| COMP | control | 0.3273 | 0.3363 | 0.3223 | 0.3273 | 0.192 | 0.006 |
| CRV | control | 0.5456 | 0.6021 | 0.5123 | 0.5456 | 0.546 | 0.037 |

Same-case baseline comparison (decision basis):

| | UNI (W) | COMP (C) | CRV (C) | T+U Δ |
|---|---|---|---|---|
| Locked prompt (marathon, same 3 cases) | ~0.72 | ~0.25 | ~0.52 | 0.335 |
| New prompt (Step 0) | 0.725 | 0.192 | 0.546 | **0.356** |
| Delta | +0.005 | −0.058 | +0.026 | **+0.021** |

**Ruling: LOCK** (Architect, 2026-06-12). COMP suppression (−0.058) is the strongest signal; UNI stable; CRV +0.026 is noise at N=3 (σ 0.037). Revert path preserved via backup.

**Calibration correction (gate restated):** the original ≥0.397 LOCK gate was the full-set Δ and structurally unreachable on a 3-case slice containing CRV (same-case locked baseline = 0.335). Future prompt-validation gates use same-case baseline comparison, not full-set Δ.

### Phase 2 Step 2 — Batch A Results (2026-06-12, INTERIM — Batch B pending)

Vault re-incorporation, blinded N=6, new (locked) Skeptic prompt. 29/30 runs; DYDX r3 lost to debate timeout >300s (known DeepSeek latency pattern, clean skip — median from 5 runs). DB-verified: formula recomputation matches all 29 stored scores, weights sum 1.0, sub-scores in range, no hard stops. DB backups: `backups/dev-pre-step0-20260612.db`, `backups/dev-pre-step2-batchA-20260612.db` (both 149 ClusterScores, taken before each destructive re-run).

| Case | Alias | Role | Median Total | Median T+U | σ | Runs | Vault T+U (N=3, old prompt) |
|------|-------|------|--------------|------------|---|------|------------------------------|
| RNDR | Project_Upsilon | W | 0.3836 | 0.4083 | 0.032 | 6 | 0.355 |
| PENDLE | Project_Phi | W | 0.3929 | 0.4688 | 0.014 | 6 | 0.408 |
| INJ | Project_Chi | W | 0.4257 | 0.4325 | 0.021 | 6 | 0.403 |
| DYDX | Project_Psi | C | 0.3402 | 0.2092 | 0.007 | 5 | 0.192 |
| ENS | Project_Omega | C | 0.4504 | 0.4375 | 0.021 | 6 | 0.508 |

Zero JSON parse errors across all 40 runs today (Step 0 + Batch A). Cost to date ~$3.80 of ~$9.20 budget.

**OPEN DECISIONS (Phase 2 blocked on Architect/Director — flagged 2026-06-12):**
1. **Batch B blocked:** TIA/ARB/SEI case files + aliases do NOT exist (cases/ has 23 files; aliases.json has 23 keys, no Omicron/Digamma/Sampi — "Session 15" artifacts absent from repo). Awaiting: Lead Engineer drafts them for review, or Architect supplies them.
2. **Step 3 degenerate boundaries:** on current data, min_Winner_T+U (RNDR 0.408) < max_Control_T+U (CRV ~0.546): pre-registered formulas yield Tier 2 floor (0.546) ABOVE Tier 1 floor ((0.408+0.546)/2 = 0.477) — inverted tiers, all 3 bear-era winners in Trash. ENS (control, 0.4375) outscores RNDR and INJ. Architect must rule on boundary handling before Step 3 is computed/documented.
3. **Era mixing:** live DB has UNI/COMP/CRV r1–r3 as new-prompt (Step 0) scores alongside marathon old-prompt r4–r6; the 12 legacy training cases carry old-prompt medians vs new-prompt expansion cases. Marathon r1–r3 recoverable from pre-step0 backup. Architect aware, unruled.
4. **Step 4 ready after Step 3:** alias scheme confirmed Project_HO1–HO6 / $TOKEN_HO1–HO6 / Dev_77+; KAS,TAO,FTM,APE,GLMR,HNT case JSONs must be researched + authored.

Step 2 NOT committed yet (brief commits after both batches). Worker healthy (PID 38597, started 12:07, new prompt loaded).

**Resolution (2026-06-13):** Open decisions 1–3 resolved by Architect brief "Batch B + Step 3c": (1) TIA/ARB/SEI case JSONs supplied by Architect (existed only on Architect's sandbox, never pushed); (2) regime-conditional boundaries with CRV excluded from Bull boundary computation; (3) mixed-prompt caveat label on all boundary values. Decision 4 (Step 4 holdout) remains pending. See sections below.

### Phase 2 Step 2 — Batch B Results (2026-06-13)

Training expansion: TIA/ARB/SEI ×6 blinded, new (locked) Skeptic prompt. Case JSONs supplied verbatim by Architect; Lead Engineer added required wiring: seed-backtest.ts metadata blocks, aliases.json entries (TIA=Project_Omicron/$TOKEN_O/Dev_68–70, ARB=Project_Digamma/$TOKEN_Y/Dev_71–73, SEI=Project_Sampi/$TOKEN_Z/Dev_74–76). ATH ground truth web-verified (CoinGecko/CMC): TIA $20.85 (2024-02-10) → 7.8x; ARB $2.40 (2024-01-12) → 2.0x; SEI $1.14 (2024-03-16) → 8.1x. Pre-run: 6 stale YFI_CTRL/Project_Omicron ClusterScores deleted (2026-05-24 era, deleted-case remnants); vault-5 isHoldout → false in seed (report.ts excludes isHoldout from tested W/C buckets); DB backup `backups/dev-pre-batchB-20260612.db`; worker hard-restarted (aliases.json is require-cached per process). Blinding leak-checked on first cluster: clean.

17/18 runs; ARB r2 lost to debate timeout >300s (known DeepSeek pattern, clean skip — median from 5). DB-verified: formula recomputation matches all 17 stored scores, weights sum 1.0, sub-scores in range, σ within norms, no hard stops.

| Case | Alias | Role | Median Total | Median T+U | σ | Runs |
|------|-------|------|--------------|------------|---|------|
| TIA | Project_Omicron | W | 0.5301 | 0.5667 | 0.012 | 6 |
| ARB | Project_Digamma | C | 0.3848 | 0.3083 | 0.016 | 5 |
| SEI | Project_Sampi | C | 0.3997 | 0.4083 | 0.013 | 6 |

**Ground-truth flags (Architect-assigned labels kept):** TIA actual multiple 7.8x is below the 10x winner threshold (winner per Architect ruling); SEI at 8.1x is a high control (cf. SNX, winner at 9.8x). **Notable:** SEI (control) T+U median exactly equals RNDR (winner) at 0.4083 — drives the Bear boundary degeneracy below.

### Phase 2 Step 3c — Regime-Conditional Boundaries (FINAL, 2026-06-13)

20-case training set per Architect Step 3a BTC-verified regime assignments (AVAX→Bear, ENS→Bull, ARB→Bull, PENDLE→Bull borderline). Formulas pre-registered: T1 floor = (min_Winner_T+U + max_Control_T+U)/2; T2 floor = max_Control_T+U. CRV excluded from Bull boundary computation only (remains a Control for all other purposes). Tier assignment convention used: strict inequality (T+U must EXCEED the floor). All medians from blinded runs, live DB, computed 2026-06-13.

> **Caveat (applies to every boundary value below):** Mixed-prompt derivation — new-prompt Δ shift documented as favorable (W↑ C↓) — boundaries are conservative relative to pure new-prompt derivation.

**Bull cohort (15 cases):**

| Case | W/C | T+U | Prompt | N | Tier | Correct? |
|------|-----|------|--------|---|------|----------|
| LINK | W | 0.7075 | old | 5 | Tier 1 | ✓ |
| YFI | W | 0.6746 | old | 6 | Tier 1 | ✓ |
| SNX | W | 0.6667 | old | 6 | Tier 1 | ✓ |
| UNI | W | 0.6658 | mixed | 6 | Tier 1 | ✓ |
| AAVE | W | 0.6425 | old | 5 | Tier 1 | ✓ |
| MKR | W | 0.6075 | old | 5 | Tier 1 | ✓ |
| SUSHI | W | 0.5667 | old | 6 | Tier 1 | ✓ |
| TIA | W | 0.5667 | new | 6 | Tier 1 | ✓ |
| CRV | C | 0.5563 | mixed | 6 | Tier 1 | ✗ (known hard control; excluded from boundary derivation per ruling) |
| PENDLE | W | 0.4688 | new | 6 | Tier 1 | ✓ |
| ENS | C | 0.4375 | new | 6 | Trash | ✓ (sits exactly at T2 floor; strict > sends it to Trash) |
| ARB | C | 0.3083 | new | 5 | Trash | ✓ |
| BAT | C | 0.2004 | old | 6 | Trash | ✓ |
| COMP | C | 0.1917 | mixed | 6 | Trash | ✓ |
| ZRX | C | 0.1917 | old | 6 | Trash | ✓ |

- min_Winner_T+U = **0.4688** (PENDLE)
- max_Control_T+U = **0.4375** (ENS; CRV excluded)
- **T1 floor = 0.4531 · T2 floor = 0.4375** — T1 > T2 ✓ (no inversion)
- T2 band width = 0.0156 (above the 0.01 usability trigger)
- In-sample: 14/15 correct (sole miss: CRV)

**Tie convention (Architect ruling, 2026-06-13) — applied below and in Step 5:**
- When min_Winner_T+U == max_Control_T+U: **T1 floor = min_Winner + 0.01** (minimum separation); T2 floor remains max_Control. Tier 2 band has fixed width 0.01.
- Cases landing on the exact boundary (T+U == max_Control) classify as **Tier 2 — boundary-tie indeterminate**.
- Step 5 evaluation: boundary-tie cases count as **0.5 credit** toward Primary A (winner recall) / Primary B (control trash rate).
- Production: any case landing in the Tier 2 band triggers **human review** rather than auto-allocation.

**Bear cohort (5 cases — PROVISIONAL):**

- min_Winner_T+U = **0.4083** (RNDR)
- max_Control_T+U = **0.4083** (SEI) — exact tie with min_Winner
- **Tie convention applies:** T1 floor = 0.4083 + 0.01 = **0.4183**; T2 floor = **0.4083**
- Tier 2 band = [0.4083, 0.4183) — width 0.01

| Case | W/C | T+U | Prompt | N | Tier | Correct? |
|------|-----|------|--------|---|------|----------|
| AVAX | W | 0.6075 | old | 6 | Tier 1 | ✓ |
| INJ | W | 0.4325 | new | 6 | Tier 1 | ✓ |
| RNDR | W | 0.4083 | new | 6 | Tier 2 (boundary-tie) | ⚠️ partial (Winner in T2 indeterminate band) |
| SEI | C | 0.4083 | new | 6 | Tier 2 (boundary-tie) | ❌ misclassified (Control should be Trash) |
| DYDX | C | 0.2092 | new | 5 | Trash | ✓ |

In-sample (0.5 credit on boundary-tie cases): Primary A 2.5/3 (AVAX, INJ, RNDR 0.5) = 83.3%; Primary B 1.5/2 (DYDX, SEI 0.5) = 75.0%.

**Bear discrimination failure note:** SEI (Control) ties RNDR (Winner) at 0.4083 — the pipeline cannot distinguish them in the Bear regime. This is a genuine limitation, not a measurement artifact (σ 0.013 for SEI, 0.032 for RNDR; medians from N=6 each). Bear boundaries are PROVISIONAL: 5-case derivation with degenerate raw margin. **Priority for expansion in v0.3.** Any holdout case within ±0.05 of either Bear boundary (T+U ∈ [0.3583, 0.4683]) is low-confidence and should trigger human review per the tie convention.

**Cost (Step 2 complete):** Batch B actuals $1.98 Anthropic (88 calls, 00:37–01:31) + ~$0.15 DeepSeek est. ≈ $2.13 (vs $1.80 projected). Phase 2 spend to date ≈ $5.88 of $9.20; ~$3.32 remains for Step 4 (36 holdout runs ≈ $3.60 projected — over budget by ~$0.28 at current per-run cost; flagged).

### Phase 2 Step 4 — Holdout Results (2026-06-14)

36 holdout runs (KAS/TAO/FTM/APE/GLMR/HNT ×6 blinded) + 3 LINK validation runs. Worker hard-restarted before launch to pick up new aliases. DB backups: `backups/dev-pre-step4-20260614.db` (pre-seed), `backups/dev-post-step4-holdout-20260614.db` (post-holdout, pre-LINK overwrite — preserves old-prompt LINK r4–r6 needed for the Step 0 validation comparison).

**All 36 runs verified.** Formula recomputation matches every stored totalScore; weights sum 1.0; sub-scores in [0,1]; no hard stops. Three log "issue" hits were verdict-string regex false-positives (no errors). σ all within historical norms (max 0.0366 for GLMR).

| Case | Alias | Role | Regime (verified) | Median Total | Median T+U | σ(total) | σ(T+U) | Runs |
|------|-------|------|-------------------|--------------|------------|----------|--------|------|
| KAS | Project_HO1 | W | Bear | 0.2962 | 0.2917 | 0.031 | 0.036 | 6 |
| TAO | Project_HO2 | W | Bull | 0.4733 | 0.6017 | 0.024 | 0.042 | 6 |
| FTM | Project_HO3 | W | Bear | 0.4523 | 0.5083 | 0.022 | 0.025 | 6 |
| APE | Project_HO4 | C | Bear | 0.3886 | 0.3292 | 0.027 | 0.045 | 6 |
| GLMR | Project_HO5 | C | Bear | 0.4283 | 0.5017 | 0.037 | 0.056 | 6 |
| HNT | Project_HO6 | C | Bull | 0.4624 | 0.4579 | 0.026 | 0.036 | 6 |

**Regime verification (Architect-ruled 2026-06-14):** Strict snapshot-date BTC vs 200DMA rule applied. Brief contained 2 errors, both confirmed and corrected:

| Case | Brief regime | Verified | Source |
|------|--------------|----------|--------|
| KAS | Bear | Bear ✓ | BTC ~$16k post-FTX (Nov 2022), 200DMA ~$30k+ |
| TAO | Bear* | **Bull** | BTC crossed above 200DMA on 2023-01-13 ($19,515); +70 days at signal |
| FTM | Bull | **Bear** | June 20 2021 death cross; BTC ~$31k vs 200DMA ~$42-45k at snapshot; golden cross not until ~Sept 2021 |
| APE | Bear | Bear ✓ | Dec 2021 death cross still in effect |
| GLMR | Bear (flagged) | Bear ✓ | Architect's suspicion confirmed |
| HNT | Bull | Bull ✓ | Pre-Nov 2021 ATH, BTC > 200DMA |

**Holdout cohort (revised per ruling):**

| Cohort | Cases | Composition |
|--------|-------|-------------|
| Bull (secondary, forward-test only) | TAO, HNT | 1W + 1C — underpowered, no statistical claim |
| Bear (primary verdict) | KAS, FTM, APE, GLMR | 2W + 2C — PROVISIONAL label (5-case training derivation) |

### Phase 2 Step 4 — LINK Mixed-Prompt Validation

3 LINK runs under the new (locked) Skeptic prompt, compared against the locked old-prompt baseline preserved in the post-step4 backup.

| Source | Runs | Median Total | Median T+U | σ(total) |
|--------|------|--------------|------------|----------|
| Old prompt (marathon, r1/r3–r6 from backup) | 5 | 0.5343 | **0.7075** | 0.015 |
| New prompt (Step 4 r1–r3) | 3 | 0.5463 | **0.7075** | 0.018 |
| **Δ (new − old)** | | **+0.012** | **0.0000** | |

**Finding: LINK T+U FLAT.** Not the +0.08 UNI moved in Step 0; not down either. The "new prompt boosts winners across the board" generalisation is **weaker than Step 0 alone suggested** — UNI/COMP/CRV exhibited the W↑ pattern strongly, LINK shows none of it on the primary metric. Total score did move +0.012 (favourable, but small). **No escalation trigger fired** (brief said escalate only if T+U moves down). The Step 3c boundaries derived under the mixed-prompt caveat remain conservatively biased rather than systematically biased — but the assumption is weaker than I would have stated based on Step 0 data alone.

### Step 5 verdict — boundary preview (formal verdict deferred)

**Boundaries (Step 3c FINAL):** Bear T1=0.4183, T2=0.4083 (tie convention applied). Bull T1=0.4531, T2=0.4375.

| Case | Role | Regime | T+U | Tier (strict >) | Correct? | Confidence |
|------|------|--------|-----|-----------------|----------|------------|
| KAS | W | Bear | 0.2917 | Trash | ❌ | high (Δ to T2 floor = 0.117) |
| FTM | W | Bear | 0.5083 | Tier 1 | ✓ | high (Δ to T1 floor = 0.090) |
| APE | C | Bear | 0.3292 | Trash | ✓ | high (Δ to T2 floor = 0.079) |
| GLMR | C | Bear | 0.5017 | Tier 1 | ❌ | high (Δ to T1 floor = 0.083) |
| TAO | W | Bull | 0.6017 | Tier 1 | ✓ | high (Δ to T1 floor = 0.149) |
| HNT | C | Bull | 0.4579 | Tier 1 | ❌ | **LOW (Δ to T1 floor = 0.0048)** ⚠ |

**Bear primary preview** (Architect framework, no 0.5 credit since cohort is 4 cases):
- Primary A (Winner recall) = 1/2 = **50%** — neither PASS (≥75%) nor FAIL (<50%) → **INDETERMINATE band**
- Primary B (Control trash rate) = 1/2 = **50%** — same band

**Bull secondary preview** (forward-test only):
- TAO Tier 1 ✓, HNT Tier 1 ❌ but boundary-tie low-confidence → "1/2 consistent, 1/2 indeterminate"

**Likely overall verdict:** INDETERMINATE per Architect's framework. Step 5 formalization deferred to next task.

**Diagnostic signals:**
- **KAS T+U 0.2917 is the cleanest miss**: the new Skeptic prompt aggressively suppressed Kaspa's fair-launch/academic-team narrative on no-revenue/no-DeFi/no-ecosystem grounds in Bear regime. Structural, not noise (σ 0.031).
- **GLMR T+U 0.5017 is the cleanest false positive**: Polkadot-parachain-just-launched scored like a winner in Bear regime despite 1.8x actual outcome. Bull-narrative framing got past the Skeptic.
- **HNT teetering at 0.4579 ≈ Bull T1 floor 0.4531**: 0.0048 gap is below the historical per-case σ (0.026). Bull cohort literally cannot resolve this case at this resolution.
- **FTM as Bear winner ✓**: strongest single result — pipeline correctly identified a 12.4x winner in Bear regime, validating exactly the test-of-purpose the regime-conditional system was designed for.

**Cost (Step 4):** $3.83 Anthropic (195 calls, 00:07–10:09) + ~$0.35 DeepSeek est. ≈ **$4.18 grand total** (vs $3.60-4.50 projected). Within Director-authorized Anthropic Console top-up. Phase 2 cumulative spend ≈ $10.06 vs $9.20 base budget → top-up consumed ~$0.86.

### Phase 2 Step 5 — Holdout Evaluation (FINAL, 2026-06-14)

Formal verdict applied to the 39 verified runs from Step 4 against the regime-conditional boundaries from Step 3c. No additional pipeline runs in Step 5 — documentation and verdict only.

**A. Bear Holdout (Primary cohort)**

Boundaries: T1 floor = 0.4183, T2 floor = 0.4083 (Architect tie convention applied to the RNDR/SEI degenerate margin).

| Case | Role | T+U | Bear Boundary | Tier | Correct? |
|------|------|------|---------------|------|----------|
| FTM | W | 0.5083 | ≥0.4183 = T1 | T1 | ✅ |
| KAS | W | 0.2917 | <0.4083 = Trash | Trash | ❌ |
| APE | C | 0.3292 | <0.4083 = Trash | Trash | ✅ |
| GLMR | C | 0.5017 | ≥0.4183 = T1 | T1 | ❌ |

- **Primary A (Winner recall):** 1/2 = **50%**
- **Primary B (Control trash rate):** 1/2 = **50%**

**B. Bull Holdout (Secondary, forward-test only)**

Boundaries: T1 floor = 0.4531, T2 floor = 0.4375.

| Case | Role | T+U | Bull Boundary | Tier | Correct? |
|------|------|------|---------------|------|----------|
| TAO | W | 0.6017 | ≥0.4531 = T1 | T1 | ✅ |
| HNT | C | 0.4579 | ≥0.4531 = T1 | T1 | ❌ ⚠️ (+0.0048 above floor, low-confidence) |

**C. LINK Validation**

New-prompt median T+U = 0.7075 vs old-prompt ~0.74. Shift = −0.0325 (within σ). Mixed-prompt assumption not contradicted; "favorable direction" claim softened to "direction-uncertain."

**D. Verdict: INDETERMINATE (diagnosed, no iteration)**

Per protocol: Primary A = 50%, Primary B = 50% — neither ≥ 75% (PASS) nor < 50% (FAIL).

**E. Diagnosis (Architect's ruling):**

1. **KAS miss (0.2917) — Coverage gap.** Kaspa is a fair-launch PoW coin. No VC funding, no product, no DeFi, no smart contracts. Its alpha comes from consensus research (GHOSTDAG paper, Sompolinsky/Zohar academic pedigree). The pipeline is designed to detect developer activity, GitHub commits, and on-chain demand signals. Kaspa's value proposition is invisible to this detection framework. Not fixable by boundary adjustment or prompt iteration. Requires architectural extension (consensus-research signal detection) in v0.3.

2. **GLMR false positive (0.5017) — Bear boundary degeneracy.** Moonbeam had genuine developer activity and EVM-compatibility narrative at snapshot. The Skeptic couldn't distinguish "building product but no demand pull" from "building product about to get demand" in Bear regime. With only 5 Bear training cases, the Bear boundary provides no margin for this distinction. Fixable with expanded Bear training in v0.3.

3. **HNT near-miss (0.4579 vs 0.4531 T1 floor) — Bull boundary resolution.** 0.0048 above the T1 floor. Within noise. The narrow Bull T2 band (0.4375–0.4531) and razor-thin T1 floor mean this case sits right at the resolution limit.

**F. One-iteration assessment:** No iteration warranted. The failures are structural (coverage gap + insufficient Bear data), not parametric (wrong threshold). Proceeding with a token iteration would waste budget without changing the verdict.

**G. Positive findings:**

1. FTM (Bear winner, 12.4x) correctly classified Tier 1 — validates core hypothesis that regime-conditional boundaries can identify winners in suppressed markets
2. TAO (Bull winner) confirmed Tier 1 with strong T+U (0.6017)
3. APE correctly filtered to Trash
4. Regime-conditional architecture is directionally correct — without it, ALL Bear cases would be Trash under global boundaries

**H. v0.3 Priorities:**

1. Expand Bear training set — add 5+ Bear-era cases to reach 10+ Bear training
2. Add fair-launch signal detection — extend Scout/Narrative pipeline to recognize academic pedigree and consensus innovation
3. Add "demand-pull vs building-only" discriminator — Skeptic prompt modification
4. Widen Bull T2 band — more Bull training cases near the boundary

**Phase 2 closeout:** v0.2 architecture validated as directionally correct but structurally limited. INDETERMINATE verdict is accurate, honest, and actionable. Step 5 closes Phase 2; v0.3 scoped above.

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
| 20 | Architect direction: production threshold + holdout unlock — resolved via vault run + v0.2 spec (Director-approved) | ✅ Complete |
| 21 | Phase 2: onboard new training case data — TIA (W), ARB (C), SEI (C) + reincorporate vault cases (RNDR, PENDLE, INJ, DYDX, ENS) as training | High |
| 22 | Phase 2: vault re-incorporation runs — 5 cases × 6 blinded runs = 30 runs (~$3.00) | High |
| 23 | Phase 2: new-case runs — TIA/ARB/SEI × 6 blinded runs = 18 runs (~$1.80) | High |
| 24 | Phase 2: recompute global tier boundaries from 21 combined training cases (training-only) | High |
| 25 | Phase 4: v0.2 holdout validation (KAS/TAO/FTM/APE/GLMR/HNT) per pre-registered protocol — only after Tasks 21–24 | High |
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
