# Architect Handoff — Session → Session

**Generated:** 2026-05-24
**Session context:** Tasks 08–13 completed. Full 15-case marathon pending.

---

## Current State

The pipeline is **functionally complete and calibrated** on a 3-case smoke test (Δ=0.198, all success criteria met). The next major milestone is the full 15-case marathon (90 runs, ~6 hours).

## What the Next Session Needs to Know

### 1. Marathon Status
- **Not yet started.** The 15-case marathon should be the first action.
- Current config: Skeptic Red-Prompt + failureRisk dimension (0.25 weight) + Quant anchoring example + structured failure_modes + N=3 median smoothing
- Alert threshold is currently 0.70 (will change to tiered alerts post-marathon)

### 2. Marathon Expected Output
- Bias report with 15 rows (7 calibration + 3 validation + 2 verification + 3 controls)
- Key metrics to check: Δ ≥ 0.15, bias ratio ≈ 1.0, no winner regression below 0.70 blinded

### 3. Post-Marathon Decisions Needed
After the marathon results come in, the Director and Architect need to decide:
- **Threshold calibration:** Plot ROC curve from 90-run data. Set Tier 1 and Tier 2 thresholds.
- **Production N=3:** Implement concurrent Quant invocation in the worker.
- **Tiered alerts:** Update Mapper to generate Tier 1 / Tier 2 alerts instead of binary pass/fail.

### 4. Architecture Rules (All 10 + 5 Locked)
See `agents/Architect_Instructions.md` for the full set. Key rules for next session:
- **Rule #3:** Never encode known outcomes — we rejected Gemini's hardcoded penalties twice
- **Rule #5:** One change per test — every pipeline change must be tested in isolation
- **Rule #7:** No uncritical endorsement — verify other AIs' proposals independently
- **Rule #8:** Verify before sounding the alarm — don't infer from logs alone, trace code paths
- **Rule #10:** Verify against running code, not documentation — 3 errors from trusting docs over code

### 5. Key File Locations
| Purpose | Path |
|---|---|
| Agent system prompts | `agents/Agent_*_Instructions.md` |
| Prompt loader + temperature | `lib/promptLoader.ts` |
| Zod schemas + user prompt builders | `lib/prompts.ts` |
| Debate orchestration | `lib/debateManager.ts` |
| Scoring logic | `lib/quantManager.ts` |
| Blinding (9-step) | `lib/backtest/blinder.ts` |
| Backtest runner | `lib/backtest/runner.ts` |
| Backtest report | `lib/backtest/report.ts` |
| Case JSON files | `lib/backtest/cases/*.json` |
| Dashboard components | `components/dashboard/` |
| API routes | `app/api/` |
| Database client | `lib/db.ts` (re-exports `@/lib/db`) |
| Prisma schema | `prisma/schema.prisma` |
| Worker | `worker/index.ts` |

### 6. Model Assignments (Current)
| Agent | Model | Provider |
|---|---|---|
| Scout | GLM-4.7-Flash | OpenAI-compatible |
| Weaver | (graph query, no LLM) | N/A |
| Analyst | Claude Sonnet 4.6 | Anthropic |
| Skeptic | DeepSeek-R1 | OpenAI-compatible |
| Quant | DeepSeek-R1 | OpenAI-compatible |
| Mapper | Claude Haiku 4.5 | Anthropic |

### 7. Discrimination Improvement History
| Iteration | Change | Δ | Controls Avg |
|---|---|---|---|
| Marathon 1 | Baseline (3 dims, original prompts) | 0.074 | 0.757 |
| Task 10 | Skeptic Red-Prompt | 0.081 | 0.748 |
| Task 11 | +failureRisk dimension (0.25 weight) | 0.114 | 0.699 |
| Task 13a | +Structured failure_modes (Skeptic Zod schema) | 0.115 | 0.693 |
| Task 13b | +Quant anchoring example (independent scoring) | **0.198** | **0.606** |

### 8. Rejected Proposals (Do Not Revisit)
| Proposal | Source | Why Rejected |
|---|---|---|
| Hardcoded Quant penalties (no-token, high-valuation) | Gemini | Violates Rule #3 (anti-blinding). Would have killed UNI/AAVE/LINK at snapshot. |
| Tighten negative control narratives | Claude | Controls should be tempting, not obviously bad. Making them easier to reject proves nothing. |
| Accept Δ≥0.10 as "done" | Gemini | 0.10 was the warning threshold, not the target. Moving goalposts is not rigorous. |
| Binary anchors in Quant prompt | Gemini | Same class as hardcoded penalties. "If no token → failureRisk ≥ 0.8" encodes the answer. |
| Temperature=0 for all agents | Gemini | Debate agents need variance. DeepSeek-R1 reasoning models lose IQ at temp=0. |

### 9. Dashboard UI Fix (Backlog)
- `components/dashboard/debates-tab.tsx`: Skeptic's finalThesis should be displayed in **red** (not green). ESCALATED badge should be **amber/orange**. Analyst's thesis (if shown) should be **green**.
