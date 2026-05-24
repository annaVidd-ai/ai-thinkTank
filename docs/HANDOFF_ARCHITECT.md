# Architect Handoff — Session → Session

**Generated:** 2026-05-25
**Session context:** Marathon failed (Δ=0.076). Three post-marathon prompt fixes all made things worse. Prompt-only approach has hit a ceiling.

---

## ⚠️ Current State — STUCK

The marathon failed discrimination targets (Δ=0.076 vs target ≥0.15). Three attempted prompt fixes all made things WORSE. The Quant prompt is now in a modified state (Fix A+ worked examples + evidence_type schema). **These changes should be reverted before any further testing.**

### What the Next Session MUST Do First

1. **Revert all post-marathon prompt changes** — restore Quant and Skeptic prompts to their pre-Fix-A state (the state that produced Δ=0.198 in the 3-case smoke test and Δ=0.076 in the full marathon)
2. **Do NOT attempt more prompt tweaks.** Three iterations proved the problem is not solvable by adjusting the Quant's anchoring text or the Skeptic's evidence classification
3. **Evaluate non-prompt approaches** (see Options below)

---

## Full Marathon Results (15 cases, 90 runs)

| Metric | Result | Target | Status |
|---|---|---|---|
| Δ (winners avg − controls avg) | 0.076 | ≥ 0.15 | ❌ |
| Winners avg (blinded) | 0.634 | ≥ 0.80 | ❌ |
| Controls avg (blinded) | 0.558 | < 0.70 | ✅ |
| Bias ratio | 1.034 | ≈ 1.0 | ✅ |
| Winners above 0.70 | 1/12 (MKR=0.709) | All | ❌ |
| SAFE control score | 0.636 | < 0.70 | ✅ |

### Per-case marathon scores (blinded, N=3 median)
| Case | Type | Score | | Case | Type | Score |
|---|---|---|---|---|---|---|
| UNI | winner | 0.653 | | CRV | winner | 0.672 |
| LINK | winner | 0.625 | | SNX | winner | 0.668 |
| AAVE | winner | 0.651 | | MKR | winner | **0.709** |
| ETH | winner | 0.659 | | YFI | winner | 0.680 |
| SOL | winner | 0.658 | | COMP | control | 0.425 |
| AVAX | winner | 0.656 | | SAFE | control | 0.636 |
| DOT | winner | 0.655 | | YFI_CTRL | control | 0.614 |

Score compression: all winners clustered 0.625–0.709, controls 0.425–0.636.

---

## Post-Marathon Fix Attempts — ALL FAILED

### Attempt 1: Fix A — Quant ABSENT/CONCRETE guidance text
**Diagnosis:** Quant anchoring example maps 3+ concerns → FR=0.90 regardless of evidence quality.
**Change:** Added guidance text to Quant prompt: "ABSENT concerns → FR 0.55–0.65, CONCRETE concerns → FR 0.85–0.95"
**Result:** Δ = 0.065 (worse than marathon's 0.076)
**Why it failed:** Added guidance text but left the old worked example (FR=0.90) intact. LLMs follow examples over instructions.

### Attempt 2: Fix A+ — Replaced worked examples
**Diagnosis:** LLMs follow examples over instructions. Need worked examples that demonstrate the ABSENT/CONCRETE distinction.
**Change:** Replaced single FR=0.90 example with two examples: Example A (ABSENT, FR=0.35) + Example B (CONCRETE, FR=0.90)
**Result:** Δ = −0.004 (SAFE scored HIGHER than winners)
**Why it failed:** Example A described vague unknowns, but UNI/AAVE have structured `[CATEGORY]`-tagged concerns from formal debates. The Quant correctly judged these as "more serious than Example A's mild unknowns" and scored FR=0.85+. Meanwhile SAFE's Analyst argued compellingly for institutional adoption, giving SAFE high upside scores.

### Attempt 3: evidence_type schema + updated Skeptic definitions
**Diagnosis:** The Skeptic outputs concerns with formal `[CATEGORY]` markers regardless of evidence quality. The Quant can't distinguish ABSENT from CONCRETE because the format makes both look equally serious. Added `evidence_type` field to Skeptic's Zod schema.
**Change:** Added `evidence_type: ABSENT|CONCRETE|MIXED` + `evidence_type_reasoning` to Skeptic's failure_modes Zod schema. Updated Skeptic instructions with classification guide.
**Result:** Δ = 0.062 (worse again)
**Why it failed:** The Skeptic correctly tagged SAFE's concerns as ABSENT ("no token, no revenue, no governance") → Quant lowered SAFE's FR → SAFE score rose. The classification was mechanically correct but semantically wrong: "no token exists" is confirmed non-existence (CONCRETE), not a data gap (ABSENT). A proposed fix to update ABSENT/CONCRETE definitions was NOT applied (session stopped before running it).

### Summary table
| Config | UNI FR | AAVE FR | SAFE FR | Δ | Winners Avg |
|---|---|---|---|---|---|
| Original (marathon) | ~0.80 | ~0.80 | ~0.90 | 0.076 | 0.634 |
| Fix A (guidance text) | 0.70 | 0.85 | 0.90 | 0.065 | 0.669 |
| Fix A+ (worked examples) | 0.85 | 0.90 | 0.90 | −0.004 | 0.647 |
| + evidence_type schema | — | — | — | 0.062 | 0.632 |

**Each fix reduced differentiation. The prompt-only approach has hit a ceiling.**

---

## Current State of Prompts (NEEDS REVERT)

The Quant and Skeptic prompts are currently in a MODIFIED state from the failed fix attempts:
- **Quant prompt:** Has ABSENT/CONCRETE guidance text (from Fix A) + two worked examples (from Fix A+). Should be reverted to the original single-example format.
- **Skeptic Zod schema:** Has `evidence_type` and `evidence_type_reasoning` fields. Should be reverted to remove these fields.
- **Skeptic instructions:** Has evidence_type classification guide. Should be reverted.

The original prompts (pre-Fix-A) are the ones that produced Δ=0.076 in the marathon. They're the best-known baseline for any further changes.

---

## Options for the Next Session

### Option 1: Switch Quant model from DeepSeek-v4-flash to Claude Sonnet
**Rationale:** The Quant needs to reason about evidence quality — "is this concern based on missing data or confirmed failure?" DeepSeek-v4-flash may lack the reasoning capacity for this nuance. Claude Sonnet (already used for the Analyst) has stronger structured reasoning.
**Cost impact:** Sonnet is ~15× more expensive than v4-flash for the Quant. Estimated: ~$0.50/marathon for Quant alone (was ~$0.20 on flash). Still within budget.
**Risk:** Model change is a bigger variable than prompt change. Per Rule #13, test in isolation.
**How to test:** Revert prompts to original → switch only the Quant model to Sonnet → 3-case smoke test → if Δ≥0.10, full marathon.

### Option 2: Re-run the original 3-case smoke test to verify baseline
**Rationale:** The original Δ=0.198 smoke test was only 3 cases × 3 runs. It might have been lucky. Re-running with the ORIGINAL (reverted) prompts would confirm whether Δ=0.198 is reproducible or was noise. If the original config can still produce Δ=0.198 on 3 cases, the problem might be that the marathon exposed variance that 3 cases don't capture — suggesting N=5 or N=7 instead of N=3.
**Cost:** 9 runs, ~$0.30.

### Option 3: Accept Δ=0.076 and recalibrate thresholds
**Rationale:** The system DOES discriminate (0.076 > 0), just not at the 0.15 target. With 12 winners avg 0.634 and 3 controls avg 0.558, a threshold of 0.62 would catch most winners while filtering some controls. This is a pragmatic approach if further optimization proves costly.
**Risk:** Low discrimination means more false positives. Tiered alerts help but don't eliminate the risk.

### Option 4: Increase N from 3 to 5 or 7
**Rationale:** The Quant's failureRisk is volatile (known issue #1). N=3 median may not be enough smoothing. More reps could reduce variance and widen Δ.
**Cost:** 5× per case = 150 runs for marathon. ~$8-10.
**Risk:** May not help if the problem is systematic (Quant always scores FR high) rather than noisy.

### Recommended Option Sequencing

1. **Option 2 first** (re-run original baseline, 9 runs, ~$0.30) — Cheap sanity check. If the original prompts still produce Δ≈0.198 on 3 cases, the problem is variance at scale, not the model. That would point to Option 4 (increase N). If the baseline can't reproduce Δ≈0.198, move to step 2.
2. **Option 1 second** (switch Quant to Sonnet) — If the original prompts can't reproduce the smoke test result, the model is likely the bottleneck. Sonnet has stronger structured reasoning for nuanced evidence quality assessment. Revert prompts to original, switch only the Quant model to Sonnet, run 3-case smoke test.
3. **Option 4 third** (increase N) — Only if Option 2 shows the baseline IS reproducible on 3 cases but variance destroys it at 15-case scale. Increase N from 3 to 5 or 7.
4. **Option 3 last** (accept and recalibrate) — Only if Options 1-2-4 all fail. Don't accept prematurely.

---

## Architecture Rules (All 15 + 5 Locked)
See `ARCHITECT_INSTRUCTIONS.md` for the full set. Key rules for this phase:
- **Rule #10:** Verify against running code, not documentation
- **Rule #12:** Never encode known outcomes
- **Rule #13:** One change per test
- **Rule #14:** No uncritical endorsement
- **Rule #15:** Verify before sounding the alarm

---

## Key File Locations
| Purpose | Path |
|---|---|
| Agent system prompts | `agents/Agent_*_Instructions.md` |
| Prompt loader + temperature | `lib/promptLoader.ts` |
| Zod schemas + user prompt builders | `lib/prompts.ts` |
| Debate orchestration | `lib/debateManager.ts` |
| Scoring logic | `lib/quantManager.ts` |
| Blinding (9-step) | `lib/backtest/blinder.ts` |
| Backtest runner | `lib/backtest/runner.ts` |
| Case JSON files | `lib/backtest/cases/*.json` |
| Dashboard components | `components/dashboard/` |
| API routes | `app/api/` |
| Database client | `lib/db.ts` |
| Prisma schema | `prisma/schema.prisma` |
| Worker | `worker/index.ts` |

## Model Assignments (Current)
| Agent | Model | Provider | Notes |
|------|---|---|---|
| Scout | GLM-4.7-Flash | Z.ai | Free |
| Weaver | (graph query, no LLM) | N/A | |
| Analyst | Claude Sonnet 4.6 | Anthropic | Prompt caching enabled |
| Skeptic | deepseek-reasoner → v4-flash | DeepSeek | **PIN EXPLICITLY** |
| Quant | deepseek-reasoner → v4-flash | DeepSeek | **PIN EXPLICITLY. Consider switching to Sonnet (Option 1)** |
| Mapper | Claude Haiku 4.5 | Anthropic | Prompt caching enabled |

## DeepSeek Model Conflation — IMPORTANT
`deepseek-reasoner` silently remapped from v4-pro → v4-flash between May 18–22. All runs since Task 10 are on v4-flash. Pin model explicitly post-marathon.

## Prompt Caching — Implemented
- Anthropic prompt caching enabled (automatic mode, top-level `cache_control: { type: "ephemeral" }`)
- System prompts are short (~300 tokens) — below Sonnet's 1,024-token minimum for standalone cache
- Cache writes activate from debate round 2+. No inter-run cache hits.
- Net cost impact is small.

## Rejected Proposals (Do Not Revisit)
| Proposal | Source | Why Rejected |
|---|---|---|
| Hardcoded Quant penalties (no-token, high-valuation) | Gemini | Violates Rule #12 (anti-blinding) |
| Tighten negative control narratives | Claude | Controls should be tempting, not obviously bad |
| Accept Δ≥0.10 as "done" | Gemini | 0.10 was warning threshold, not target |
| Binary anchors in Quant prompt | Gemini | Same class as hardcoded penalties |
| Temperature=0 for all agents | Gemini | Debate agents need variance |
| YAML instead of JSON for agent output | Gemini | Breaks Zod schemas, DeepSeek trained on JSON |
| Dual-channel output (CMD::ACTION) | Gemini | Our agents don't issue commands |
| Condensed protocol for dumb agents | Gemini | Scouts are free-tier |
| Fix A: Quant ABSENT/CONCRETE guidance text | Z.ai | Δ went from 0.076→0.065. Made worse. |
| Fix A+: Two worked examples (FR=0.35 / FR=0.90) | Z.ai | Δ went to −0.004. Much worse. |
| evidence_type Zod schema in Skeptic | Z.ai | Δ went to 0.062. Worse. |

## Discrimination Improvement History (Complete)
| Iteration | Change | Δ | Winners Avg | Controls Avg | Model |
|---|---|---|---|---|---|
| Marathon 1 | Baseline (3 dims, original prompts) | 0.074 | — | 0.754 | v4-pro |
| Task 10 | Skeptic Red-Prompt | 0.081 | — | 0.748 | v4-flash* |
| Task 11 | +failureRisk dimension (0.25 weight) | 0.114 | — | 0.699 | v4-flash |
| Task 13a | +Structured failure_modes (Skeptic Zod schema) | 0.115 | — | 0.693 | v4-flash |
| Task 13b | +Quant anchoring example (independent scoring) | 0.198 | 0.804 | 0.606 | v4-flash |
| Full marathon | 90 runs, same config | 0.076 | 0.634 | 0.558 | v4-flash |
| Fix A | Quant ABSENT/CONCRETE guidance | 0.065 | 0.669 | — | v4-flash |
| Fix A+ | Two worked examples | −0.004 | 0.647 | — | v4-flash |
| +evidence_type | Skeptic schema + classification | 0.062 | 0.632 | — | v4-flash |

*Task 10 conflates model switch + prompt change.

## DeepSeek Monthly Spend (May 2026)
| Period | Model | Cost (USD) | Requests |
|---|---|---|---|
| May 15–18 | deepseek-v4-pro | $0.495 | 314 |
| May 22–25 | deepseek-v4-flash | ~$1.00+ | 2,100+ |
Marathon + fix attempts total cost: ~$5-7 (Anthropic ~$3-4, DeepSeek ~$2).

## Anthropic Credit Issue
- Credits ran out during initial marathon attempt. Director topped up.
- **Monitor credit balance** — marathon burns ~$3 Anthropic in ~6 hours.

## Dashboard UI Fix (Backlog)
- `components/dashboard/debates-tab.tsx`: Skeptic's finalThesis in **red**, ESCALATED badge in **amber/orange**, Analyst thesis in **green**.

## Post-Marathon Checklist (Once Δ Target is Met)
- [ ] Pin DeepSeek model explicitly in config
- [ ] Threshold calibration: ROC curve from marathon data
- [ ] Production N=3: Concurrent Quant invocation (Locked Decision Rule #4)
- [ ] Tiered alerts: Tier 1 (≥0.80), Tier 2 (0.65-0.79) (Locked Decision Rule #5)
- [ ] Dashboard UI fixes
- [ ] Walk-forward validation (7/3/2 split)
