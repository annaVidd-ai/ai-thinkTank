# Project Status — Node Zero (v0.5.0)
**Last updated:** 2026-05-24 | **Phase:** Marathon Complete — Recalibration Needed | **Budget:** ~€9/mo

### Vision
AI agents that spot **paradigm-shifting profit opportunities before they go mainstream** (100x-1000x returns). Alpha = Information Asymmetry. Track builders (GitHub) and on-chain wallets, not talkers (social). Detect the footprint *before* the narrative forms.

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
| Analyst | Claude Sonnet 4.6 | Argue bullish case in debate | n/a (deprecated) |
| Skeptic | deepseek-reasoner → **v4-flash** ⚠️ | Argue bearish case — 5 failure-mode categories | n/a |
| Quant | deepseek-reasoner → **v4-flash** ⚠️ | 4-dimension scoring (signalStrength, timing, upside, failureRisk) | n/a |
| Mapper | Claude Haiku 4.5 | Generate tiered alerts with ticker | n/a (deprecated) |

⚠️ **DeepSeek alias change (confirmed 2026-05-24):** `deepseek-reasoner` now routes to `deepseek-v4-flash` (not R1). Confirmed via `response.model` live API call. Config sends `deepseek-reasoner`; DeepSeek serves flash. This is the most likely cause of the discrimination regression in the full marathon.

### 5-Phase Pipeline
1. **Extraction:** 3 Scouts → raw GitHub + on-chain data → structured JSON
2. **Graph:** Weaver → Knowledge subgraph from Scout data
3. **Debate:** Analyst (Claude Sonnet) vs Skeptic (DeepSeek flash) — 3 rounds with structured failure_modes output
4. **Scoring:** Quant scores 4 dimensions including failureRisk (inverted: high risk = lower total score)
5. **Alert:** Mapper generates tiered alert if score ≥ 0.70

### Scoring Dimensions
| Dimension | Weight | Description |
|---|---|---|
| signalStrength | 0.30 | Developer activity, commit quality, elite builders |
| timing | 0.2625 | Information asymmetry window, adoption cycle position |
| upside | 0.1875 | Market cap runway for 10x, value accrual potential |
| failureRisk | 0.25 | Probability of catastrophic failure (INVERTED: high = lower score) |

**Formula:** `totalScore = (signalStrength × 0.30) + (timing × 0.2625) + (upside × 0.1875) + ((1 − failureRisk) × 0.25)`

### Backtest Results

#### Full 15-Case Marathon (2026-05-24) — FAILED SUCCESS CRITERIA
| Case | Set | Type | Blinded | Unblinded | Bias |
|---|---|---|---|---|---|
| UNI | calibration | Pos | 0.653 | 0.625 | 0.96 ✓ |
| LINK | calibration | Pos | 0.625 | 0.697 | 1.11 ✓ |
| AAVE | calibration | Pos | 0.651 | 0.647 | 1.00 ✓ |
| SOL | calibration | Pos | 0.616 | 0.644 | 1.05 ✓ |
| AVAX | calibration | Pos | 0.604 | 0.659 | 1.09 ✓ |
| MATIC | calibration | Pos | 0.512 | 0.646 | 1.26 ✓ |
| YFI | calibration | Pos | 0.660 | 0.657 | 1.00 ✓ |
| COMP | calibration | **Ctrl** | 0.425 | 0.456 | 1.07 ✓ |
| SAFE | calibration | **Ctrl** | 0.636 | 0.640 | 1.01 ✓ |
| GRT | validation | Pos | 0.657 | 0.703 | 1.07 ✓ |
| AXS | validation | Pos | 0.639 | 0.644 | 1.01 ✓ |
| MKR | validation | Pos | **0.709** | 0.637 | 0.90 ✓ |
| YFI_CTRL | validation | **Ctrl** | 0.614 | 0.625 | 1.02 ✓ |
| SNX | verification | Pos | 0.672 | 0.657 | 0.98 ✓ |
| SUSHI | verification | Pos | 0.616 | 0.610 | 0.99 ✓ |

| Metric | Result | Target | Status |
|---|---|---|---|
| Δ (winners avg − controls avg, blinded) | +0.076 | ≥ 0.15 | ❌ |
| Winners avg (blinded) | 0.634 | ≥ 0.80 | ❌ |
| Controls avg (blinded) | 0.558 | < 0.70 | ✅ |
| Avg bias ratio | 1.034 | ≈ 1.0 | ✅ |
| Bias detected (ratio > 1.5) | 0 | 0 | ✅ |
| Individual winner above 0.70 | 1/12 (MKR) | All | ❌ |
| Calibration pass rate | 0.0% | ≥ 50% | ❌ |

#### 3-Case Smoke Test (2026-05-23) — PASSED (now superseded)
| Metric | Value | Target |
|---|---|---|
| Δ (winners vs controls) | 0.198 | ≥ 0.15 ✅ |
| Winners avg | 0.804 | ≥ 0.80 ✅ |
| Controls avg | 0.606 | < 0.70 ✅ |
| Bias ratio | ≈ 1.0 | ≈ 1.0 ✅ |

Note: 3-case test used only YFI (strongest winner) vs COMP + SAFE. Results did not generalise to the full 12-winner set.

### Backtest Methodology
- **15 cases:** 12 positive (real 10x+ winners) + 3 negative controls (known failures: COMP, SAFE, YFI_CTRL)
- **Dual condition:** Blinded (9-step anonymization) vs Unblinded — measures hindsight bias
- **N=3 median smoothing:** 3 runs per case per condition, take median score
- **Walk-forward split:** 7 calibration / 3 validation / 2 verification (from 12 positive cases)
- **9-step blinding:** Step 0 (dates) → Steps 1-8 (names, tickers, URLs, amounts, outcomes)

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
| 12 | File-based system prompts + temperature config + few-shot examples | ✅ Complete |
| 13 | Structured Skeptic output (failure_modes) + Quant anchoring example (Δ → 0.198 on 3-case) | ✅ Complete |
| 14 | Prompt caching — Anthropic top-level automatic mode (SDK v0.98.0) | ✅ Complete |
| — | Full 15-case marathon (90 runs, 30/30 combos, no crashes) | ✅ Complete |

### Pending Tasks
| Task | Description | Priority |
|---|---|---|
| **Root cause analysis** | Why did winners avg collapse 0.804 → 0.634? Primary hypothesis: deepseek-reasoner alias now serves v4-flash (non-deep-reasoning). Options: (a) pin to `deepseek-v4-pro`, (b) tune prompts for flash, (c) re-examine case narratives | **Critical** |
| **Re-run marathon** | After root cause fix, re-run full 90-run suite to validate Δ ≥ 0.15 | High |
| Production N=3 | Quant fires 3× concurrently, uses median for alert trigger | High |
| Tiered alerts | Tier 1 (≥0.80), Tier 2 (0.65-0.79) — currently binary 0.70 | High |
| Threshold calibration | ROC curve analysis once discrimination is restored | Medium |
| Remaining agent schemas | Expand Scout, Weaver, Analyst, Mapper schemas (currently thin) | Medium |
| Analyst structured output | Mirror Skeptic's structured output for Analyst (deferred) | Low |

### Known Issues
1. **deepseek-reasoner alias drift** — As of 2026-05-24, `deepseek-reasoner` routes to `deepseek-v4-flash` (confirmed via `response.model`). This is almost certainly the cause of the full-marathon discrimination failure. Earlier marathons (May 15–18) used `deepseek-v4-pro`. To pin the model explicitly, change SKEPTIC_CONFIG and SCORE_CONFIG to `deepseek-v4-pro`.
2. **SAFE control scores too high** — SAFE blinded 0.636 is only 0.002 below SAFE's unblinded 0.640, and sits in the winner range. Not a bias issue (ratio 1.01) but a calibration issue — the Skeptic is not finding enough structural failures in SAFE to push it below 0.50.
3. **failureRisk volatility** — Quant scores it correctly (~0.90) on some runs but reverts to ~0.50 on others. N=3 smoothing handles it in backtest; production will use N=3 too.
4. **DeepSeek flash JSON control characters** — Occasionally outputs unescaped control characters in JSON strings. Retry catches it; proper sanitizer deferred.
