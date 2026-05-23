# Dashboard Guide

The dashboard is your window into what the AI system is doing in real time. It refreshes automatically every 10 seconds — you don't need to reload the page.

---

## The Big Picture

The system watches crypto projects for early signs that serious builders and smart money are quietly converging on something *before* the mainstream notices. When it detects that, it generates an **Alert** — a signal that a project might be worth paying attention to.

The pipeline has 5 stages, in order:

```
DETECTED → NARRATIVE → DEBATE → SCORED → ALERTED
```

Each tab in the dashboard shows a different part of this process.

---

## Tabs

### Pipeline

Shows every project currently being processed, with its current stage.

| Status | What's happening |
|---|---|
| **DETECTED** | The graph scanner found unusual developer/capital activity |
| **NARRATIVE** | An AI is summarising what's known about the project |
| **DEBATE** | Two AIs are arguing — one bullish, one bearish |
| **SCORED** | A third AI has rated the project 0–1 |
| **ALERTED** | Score passed the threshold → an Alert was created |

If a cluster is stuck at any stage for a long time, it likely means an AI call failed and will be retried automatically.

---

### Alerts

The output. Each alert means a project cleared every stage and scored above the threshold (default: 0.70).

| Field | What it means |
|---|---|
| **Ticker** | The project's token symbol (e.g. `$ETH`) |
| **Score** | 0–1 overall rating. Higher = stronger signal |
| **Thesis** | One-line verdict from the debate (e.g. `CAUTIOUSLY_BULLISH`) |
| **Market Cap** | Rough size estimate at signal time |

**Important:** An alert is a *signal*, not a recommendation. It means the system detected early activity worth watching — not that the project will go up.

---

### Debates

The raw argument log. For each project, two AIs debated across 3 rounds:

- **Analyst (Claude Sonnet)** — argues the bull case: why this could 10x
- **Skeptic (DeepSeek-R1)** — argues the bear case: why it could fail

After round 3, the Skeptic delivers a verdict:
- **AGREED** — concedes the bull case is strong enough
- **DEADLOCKED** — fundamental disagreement remains

You can click any debate to read the full transcript. The arguments are grounded in the project's actual developer and capital data — not general opinion.

---

### Backtest

This tab shows how *honest* the scoring is — whether the system scores projects it had no way of knowing would succeed differently from ones that didn't.

| Term | What it means |
|---|---|
| **Blinded** | Score given with date information hidden (simulates not knowing the outcome) |
| **Unblinded** | Score given with full context (used to sanity-check the blinded score) |
| **Bias Ratio** | Blinded ÷ Unblinded. Should be close to 1.0 — means no cheating |
| **Winners** | Projects that historically delivered 10x+ returns |
| **Controls** | Projects that looked promising but didn't deliver |
| **Δ (Delta)** | Average winner score minus average control score. Higher = better discrimination |

**What you want to see:**
- Bias ratio near 1.0 (no hindsight bias)
- Winners scoring clearly higher than controls (Δ ≥ 0.15 is the target)

---

### Config

The scoring knobs. You can adjust:

| Setting | What it does |
|---|---|
| **Alert Threshold** | Minimum score to generate an alert. Default: 0.70 |
| **signalStrength** | Weight given to developer activity quality |
| **timing** | Weight given to how early we are vs mainstream awareness |
| **upside** | Weight given to market cap runway for a 10x return |
| **failureRisk** | Weight given to structural failure risk (inverted: high risk = lower score) |

All weights must add up to 1.0. Don't change these unless you know what you're adjusting — wrong weights invalidate backtest comparisons.

---

## What "Running a Marathon" Means

A *marathon* (or *mini-marathon*) is a test run where the system scores a set of known historical projects — some that 10x'd, some that didn't — with dates hidden. It's how we measure whether the scoring is actually any good.

When a marathon is running, you'll see the Pipeline tab fill up with projects named `Project_Alpha`, `Project_Beta`, etc. — those are the anonymised test cases.
