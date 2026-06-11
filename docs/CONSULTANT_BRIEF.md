# ThinkTank AI — External Consultant Briefing

**Date:** 2026-06-11 | **Version reviewed:** v0.5.0 | **Purpose:** Fresh strategic and statistical perspective on the project's current crossroads

---

## 1. What the Project Is

ThinkTank AI is a blockchain intelligence pipeline that hunts for **paradigm-shifting investment opportunities before they go mainstream** (target: 10x+ returns). Core thesis: alpha = information asymmetry. Instead of tracking social sentiment ("talkers"), it tracks **builders** (elite developer activity on GitHub) and **capital** (on-chain wallet flows) — aiming to detect the footprint before the narrative forms.

First domain is crypto/DeFi, the only space where both the product (open-source code) and the money (blockchain) are fully public. The output is a scored, tradable signal: protocol → conviction score → ticker alert.

## 2. How It Works

A 6-agent LLM pipeline:

| Stage | Agent | Model | Role |
|---|---|---|---|
| Extraction | Scout ×3 | GLM-4.7-Flash | GitHub + on-chain data ingestion |
| Graph | Weaver | (graph query) | Builds knowledge subgraph (Neo4j) |
| Debate | Analyst | Claude Sonnet 4.6 | Bull case, 3 rounds |
| Debate | Skeptic | DeepSeek-R1 | Bear case, structured failure modes |
| Scoring | Quant | Claude Sonnet 4.6 | 4-dimension score |
| Alert | Mapper | Claude Haiku 4.5 | Tiered alert + ticker |

**Scoring:** `totalScore = (signalStrength × 0.30) + (timing × 0.2625) + (upside × 0.1875) + ((1 − failureRisk) × 0.25)`

**Critical empirical finding:** signalStrength and failureRisk carry 55% of the weight but contribute **zero discrimination** — they score nearly uniform (~0.72 and ~0.82–0.88) across winners and losers alike. All discrimination comes from timing + upside. The normalized **T+U sub-score** `(0.2625×T + 0.1875×U) / 0.45` is now the primary calibration metric.

## 3. Validation Methodology

Walk-forward backtest on historical DeFi cases, each run **blinded** through a 9-step anonymization (dates, names, tickers, wallets, amounts, outcome language) to prevent hindsight bias. Each case runs N=6, median taken. Bias ratio (blinded vs unblinded) ≈ 1.03, so blinding works.

Current design: 8 training winners (UNI, LINK, AAVE, MKR, SNX, YFI, SUSHI, AVAX) and 4 training controls (COMP, ZRX, BAT, CRV) — all 2020 DeFi Summer era — plus a holdout set that was kept locked during prompt iteration.

## 4. Results Journey (Condensed)

| Milestone | Δ (winners − controls) | Takeaway |
|---|---|---|
| Original 3-case smoke test | 0.198 | Promising — but later found to be on DeepSeek v4-pro |
| Full 15-case marathon | 0.076 | Failed target (≥0.15); scores compressed |
| Three prompt-fix attempts | 0.065 / −0.004 / 0.062 | All worse — prompt-only approach hit a ceiling |
| Baseline re-verification | 0.017 | Root cause: provider silently downgraded v4-pro → v4-flash |
| Quant switched to Claude Sonnet | ~0.02 | Model swap alone didn't help |
| Test A: multiplicative risk formula | 0.063 | Worse — reverted to additive |
| Test B: Analyst constraint* | 0.094 | Best prompt-level result |
| 8W/6C redesign + marathon (72 runs) | **0.165 TotalScore / 0.397 T+U** | Targets met on training set |

*Test B blocked the Analyst from using protocol adoption metrics (TVL, DAUs) to rebut tokenomics concerns — forcing separation of "good protocol" from "good token investment." This single change drives most of the discrimination.

**Cost discipline:** the 72-run marathon cost ~$7 total. Monthly budget ~€9.

## 5. The Holdout Result — and the Central Problem

The holdout (7 unseen cases, mixed eras) was unlocked for diagnosis and is now **burned** (cannot be reused for threshold design):

| Case | Truth | T+U | Outcome |
|---|---|---|---|
| RNDR, PENDLE, INJ | Winners (2021–22 bear era) | 0.355–0.408 | **All missed** |
| DYDX, ALGO | Controls | 0.192–0.350 | Correctly filtered |
| ENS, SAFE | Controls | 0.508 | Correctly filtered, barely |

**Diagnosis: regime dependence.** The pipeline discriminates directionally in every era (controls always score lower), but absolute T+U levels are calibrated to 2020 DeFi Summer (winner avg ~0.69). Bear-market winners succeed through subtler, narrative-driven mechanisms (T+U avg ~0.39) and land below the training-derived threshold.

Two structurally ambiguous cases worth knowing:

- **CRV (control) scores like a winner** on TotalScore (0.551). Its veCRV governance mechanics may represent real alpha that tokenomics later extinguished — its "control" label is itself debatable.
- **SUSHI (winner) is the softest** (0.471), only 0.08 above the cleanest control.

## 6. Proposed Next Step: v0.2 Tier System

A draft spec (pending review) proposes:

1. **Tiered alerts from training data only:** Tier 1 / High Conviction (T+U ≥ 0.5667, the SVM midpoint), Tier 2 / Watchlist (0.52–0.5667, floor = CRV's ceiling), Trash (< 0.52). In-sample: Tier 1 = 100% precision, 62.5% recall; combined T1+T2 = 88.9% precision, 100% recall.
2. **Regime Pre-Scorer:** a cheap Haiku-based classifier labels the market regime (defi_summer, bear, l1_season, ai_narrative, sideways); tier thresholds become regime-conditional.
3. **Training expansion:** reincorporate the burned holdout cases as training data, add 2023–24 cases (TIA, SEI) for regime diversity.
4. **Pre-registered validation:** a fresh 6–8 case holdout spanning ≥2 regimes, selected before any runs; pass = tier-weighted accuracy ≥ 0.70.

Estimated cost: ~$15 total.

## 7. Questions We'd Like Your Perspective On

**Statistical:**

1. Is a tier boundary anchored on a single outlier control (CRV's T+U ≈ 0.52) defensible, or should it be percentile-based? The Tier 2 band is only 0.047 wide.
2. Is tier-weighted accuracy a sound primary validation metric, or would raw accuracy / F1 be more honest?
3. Is reincorporating burned holdout cases into training legitimate, given we've seen their 3-run scores?
4. Are 5 regime labels too many for ~20 training cases? Should we start binary (bull/bear)?

**Strategic:**

5. What 2023–24 project had narrative heat but failed to deliver sustained alpha (candidate control)?
6. What should a human actually *do* with a Tier 2 "Watchlist" alert? What information should accompany it?
7. Should CRV be reclassified as a "conditional winner" (DeFi Summer only)? This would reshape tier boundaries significantly.
8. Nominations for the new holdout: 6–8 cases, ≥3 winners, ≥3 controls, ≥2 regimes, none previously used.

**Open-ended:**

9. Two scoring dimensions (55% of weight) are dead weight for discrimination. Re-weight, redesign, or drop them?
10. Is regime-conditional thresholding the right fix for regime dependence — or is there a smarter architecture (e.g., relative ranking within a candidate universe instead of absolute thresholds)?
11. What failure mode are we not seeing?

## 8. Constraints

- Solo director; AI agents fill architect/developer/consultant roles
- Budget: ~€9/month operating, ~$15 for the full v0.2 program
- Small-N reality: every threshold rests on ≤12 training cases; statistical humility required
- Stack: Next.js 16 / TypeScript / Prisma–SQLite / Neo4j (free tier)
