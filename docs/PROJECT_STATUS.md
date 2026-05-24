# Project Status — Node Zero (v0.5.0)
**Last updated:** 2026-05-25 | **Phase:** Backtest Calibration | **Budget:** ~€9/mo

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
| Quant | DeepSeek-R1 | 4-dimension scoring (signalStrength, timing, upside, failureRisk) | 0.3 |
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

**Conclusion: Prompt-only approach has hit a ceiling. Non-prompt approaches needed (model change, N increase, or threshold recalibration). See HANDOFF_ARCHITECT.md for options.**

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
| 12 | File-based system prompts + temperature config + few-shot examples | 0.114 → 0.115) | ✅ Complete |
| 13 | Structured Skeptic output (failure_modes) + Quant anchoring example (improved Δ from 0.114 → 0.198) | ✅ Complete |

### Pending Tasks
| Task | Description | Priority |
|---|---|---|
| 14 | Marathon completed — Δ=0.076 (failed). All prompt fix attempts exhausted. | High |
| 15 | Try Skeptic micro-fix: CONCRETE for confirmed non-existence ("no token issued") — one-line change, low risk | Medium |
| 16 | Evaluate non-prompt approaches: Quant model → Claude Sonnet, N increase (3→5), or threshold recalibration | High |
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
5. **Prompts in modified state** — Quant and Skeptic prompts have failed Fix A/A+/evidence_type changes applied. Must revert before further testing.
