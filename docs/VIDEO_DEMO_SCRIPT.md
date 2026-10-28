# Gridbricks REint AI — 10-Minute Video Demonstration Script

> 📺 **YouTube Video Walkthrough**: [https://www.youtube.com/watch?v=90gMVkPn1Xk](https://www.youtube.com/watch?v=90gMVkPn1Xk)  
> ⚡ **Recommended Playback Speed**: Please watch in **2x speed** (or 1.5x) for optimal pacing and time efficiency.

## PRE-FLIGHT SETUP (Do This Before Recording)

* **Tab 1 (Browser):** [https://assignment-grid-bricks.vercel.app/](https://assignment-grid-bricks.vercel.app/) (Full screen, 100% zoom)
* **Tab 2 (Browser):** [https://github.com/deadheaven07/gb-uk-wind-eval/actions](https://github.com/deadheaven07/gb-uk-wind-eval/actions) (Green CI checkmark ready)
* **Window 2 (VS Code):**
  * **Editor:** Open `backend/app/services/elexon_service.py`
  * **Terminal:** Cleared, ready to paste commands
* **Stopwatch:** Start when you speak. Transition from Part 1 to Part 2 at **4:45**.

---

## PART 1: CLIENT PITCH TO THE TRADING DESK (0:00 – 4:45)

### [0:00 – 0:55] The 11:00 UTC D-1 Trading Dilemma

🎬 **ACTION:** Show browser on live app. Hover mouse over Header (**"Cutoff: 11:00 UTC D-1 Day-Ahead Auction Deadline"**) and green **"Connected to Elexon BMRS"** pill.

Good morning, team.

If you sit on a UK wholesale electricity trading desk, your most critical commercial deadline of the day is **11:00 UTC on Day D-minus-1**. That is when the EPEX SPOT and Nord Pool UK Day-Ahead auctions close their order books.

Every morning, you face the exact same high-stakes question across tomorrow's 48 half-hour settlement periods:

**How much dispatchable thermal power — gas or biomass — must you procure in the Day-Ahead market to cover consumer demand, beyond what intermittent wind will deliver?**

Wind is your volatile wildcard.

If you trust an over-optimistic wind forecast by even 1,000 megawatts during a 17:30 winter evening peak, you under-procure thermal power. In real time, your portfolio is caught short. National Grid ESO has to balance that deficit with emergency reserves — slapping you with punitive **System Buy Price cashout penalties** that spike to **£150, £250, or even £400 per megawatt-hour**.

On the flip side, if you panic and over-commit expensive thermal generation, you burn costly gas and dump excess power at depressed cashout prices.

Most tools on the market are just backward-looking charts showing past errors. Today, I am proud to present **Gridbricks REint AI** — an active decision-intelligence platform that turns quantified wind forecast uncertainty into an immediate, capacity-constrained thermal procurement order.

---

### [0:55 – 2:05] The January 2026 Executive Scorecard

🎬 **ACTION:** Slowly pan mouse left-to-right across the 5 Executive KPI Cards:
`MAE 2,126 MW` $\rightarrow$ `RMSE 2,620 MW` $\rightarrow$ `Mean Bias +1,840 MW` $\rightarrow$ `Peak vs Off-Peak -186 MW` $\rightarrow$ `Horizon Decay +14.98%`.

Let’s look at the hard empirical reality of **January 2026** — a volatile winter month across all **1,488 half-hour settlement periods** in Great Britain.

Look at our **Executive Scorecard**:

First, **Mean Absolute Error (MAE)** is **2,126 megawatts**, or **18.36% of actual generation**. Across a 30-minute settlement period, that is **1,063 megawatt-hours** of volume risk per interval.

Second, **Root Mean Square Error (RMSE)** is **2,620 megawatts** — carrying a **+495 megawatt quadratic tail penalty**. Why does RMSE matter to risk managers? Because grid operations can easily absorb ten small 50-megawatt errors. But one sudden **2,500-megawatt drop-off** during a storm front triggers emergency reserves and maximum cashout penalties.

Third — and most critical — look at our **Mean Bias of +1,840 megawatts**. Raw Day-Ahead forecasts ran persistently higher than actual metered generation in **over 84% of intervals**.

As UK power analysts, we know this isn't just weather error. Much of this **+1.8 gigawatt gap** is **transmission network curtailment** — Scottish wind turbines constrained down by National Grid ESO due to **B6 boundary bottlenecks**.

And backtests prove that waiting for late-night updates barely helps. The solution isn't waiting — the solution is **systematic statistical de-biasing and risk buffering at 11:00 UTC D-minus-1**.

---

### [2:05 – 3:15] Interactive Time Series & Causal P10–P90 Corridor

🎬 **ACTION:** Scroll to the main chart.

1. Click the **"Storm (1-7)"** preset button.
2. Drag the bottom brush slider to zoom into **January 3rd**.
3. Hover over the chart tooltip (**Actual Outturn** vs **Day-Ahead Forecast**) and point to the **blue shaded P10–P90 band**.

Here in the interactive time series, we align actual metered generation from **Elexon FUELHH** (the solid Navy line) against the latest Day-Ahead forecast from **WINDFOR** locked before the 11:00 UTC cutoff (the amber dashed line).

Look at **Week 1 during Storm Goretti**:

On January 3rd, wind generation ramped violently from **4,000 megawatts to over 16,000 megawatts**. The forecast predicted the storm would arrive hours earlier than it physically did. A desk without a safety margin was exposed to massive deficit penalties.

Now consider **Week 2 during the mid-month Dunkelflaute lull**:

High pressure settled over the UK. Wind collapsed below **2,500 megawatts** for eight straight days while heating demand surged. Absolute errors were smaller, but because grid margins were paper-thin, cashout spikes hit their peak.

Notice this **blue shaded band** — that is our **dynamic P10 to P90 uncertainty corridor**.

Basic tools apply a static monthly standard deviation, which leaks future storm volatility backward into early-month forecasts. Our corridor is **strictly causal**. It uses rolling trailing quantiles to give shift traders an honest visual envelope of where wind generation will realistically land.

---

### [3:15 – 4:45] Thermal Procurement & Risk Buffer Engine

🎬 **ACTION:** Scroll down to **"Trader Decision Tool (Thermal Procurement)"**.

1. Point to inputs: **Expected Demand = `34,000 MW`**, **Wind Forecast = `8,500 MW`**.
2. Click **"P90 (90%)"**.
3. Point to the **3 Output Cards** and the **Balancing Mechanism Sensitivity Matrix** below.

Now, here is the capability that separates **Gridbricks REint AI** from standard analytics dashboards: our **Thermal Procurement & Risk Buffer Engine**.

Imagine you are the shift trader at 10:30 AM tomorrow.

Evening peak demand is forecast at **34,000 megawatts**, and your Day-Ahead wind forecast is **8,500 megawatts**.

A naive spreadsheet calculation says:
**34,000 minus 8,500 equals 25,500 megawatts** of thermal power.

If you bid that unbuffered number, you face an **84.4% probability of a wind deficit**.

Here is how our engine solves this:

* **First**, from the empirical error distribution, it calculates a **P90 Risk Safety Buffer of +4,347 megawatts**.
* **Second**, it recommends procuring **29,847 megawatts** of thermal power — which equals **14,923 megawatt-hours** for the 30-minute settlement period.
* **Third**, your shortfall risk drops from **84.4% down to just 10.0%**.

Look at the **Balancing Mechanism Sensitivity Matrix** below:

At a typical winter cashout penalty of **£150 per megawatt-hour**, this P90 buffer delivers **£61,085 in net savings per half-hour**, cutting your Value-at-Risk by **94.8%**. Under extreme scarcity at **£350 per megawatt-hour**, net savings exceed **£249,000 in a single half-hour period**.

And if your thermal fleet has a physical cap — say **28,000 megawatts** — the engine caps the order and fires an **Unserved Base Deficit alert** so you never fly blind.

In 30 seconds, the trader gets a capacity-checked order and an audit-ready rationale.

---

## PART 2: TECH LEAD ARCHITECTURE & CODE REVIEW (4:45 – 9:40)

### [4:45 – 5:50] System Architecture & Production Stack

🎬 **ACTION:** Switch to **VS Code**. Show the file explorer on the left: `backend/`, `frontend/`, `docker-compose.yml`, `pyproject.toml`, `.github/workflows/ci.yml`.

Thank you, trading team. Now let’s pivot to our internal engineering architecture review.

My goal was to build a system that is production-grade, mathematically verified, and 100% free of look-ahead data leakage.

Here is the stack:

* **Backend (`backend/`):** Python 3.11 and **FastAPI** with async REST endpoints, strictly validated using **Pydantic v2** schemas in `backend/app/schemas/forecast.py`.
* **Vectorized Analytics (`analytics_service.py`):** Vectorized **NumPy and Pandas** pipelines. All rolling quantiles, diurnal profiles, and financial matrices execute in sub-millisecond time with zero N+1 overhead.
* **Dual-Tier Storage (`elexon_service.py`):** **Apache Parquet via PyArrow** for fast columnar scans paired with **SQLite** for relational lookups.
* **Frontend (`frontend/`):** **React 18, TypeScript, Vite, Tailwind CSS, and Recharts**. We use ref-based request tracking (`latestRequestId`) to eliminate async slider race conditions.
* **Infrastructure:** Multi-stage Dockerfiles, single-command `docker compose up --build`, and GitHub Actions CI.

---

### [5:50 – 7:15] Zero Look-Ahead Leakage & Causal Rolling Quantiles

🎬 **ACTION:** Open `backend/app/services/elexon_service.py`.

1. Scroll to **Line 290** (`_reconcile_and_apply_gate_closure`).
2. At 6:40, scroll to **Line 470** (`_post_process_aligned_df`).

Let’s look at the most important domain requirement in the codebase: **eliminating look-ahead bias**.

In the UK power market, two deadlines must never be confused:

1. The **Day-Ahead Auction Deadline** at **11:00 UTC on Day D-minus-1**.
2. The physical **Balancing Mechanism Gate Closure** at **T-minus-1 hour**.

Look at `_reconcile_and_apply_gate_closure` on line 290:

For every delivery period on Day D, we enforce a strict boundary:
`da_cutoff = (D - 1) at 11:00:00 UTC`.

Any forecast with a `publishTime` after 11:00 UTC is strictly disqualified from Day-Ahead evaluation. If no valid forecast exists prior to cutoff, we preserve `None` — we never backfill later forecasts or inject synthetic zeros.

We also handle a subtle fallback edge case: if a half-hour candidate was published after 11:00 UTC, it is rejected, and the reconciler cleanly falls back to an eligible hourly candidate published before cutoff.

Now look at `_post_process_aligned_df` on line 470 for our **Causal Uncertainty Corridor**:

We compute rolling 48-period (24-hour) non-parametric quantiles — Q10 and Q90 — on the actual-minus-forecast residual.

Notice this key line:
`r_series.shift(1)`

We lag the residual series by 1 period so that interval *t*’s own outcome is strictly excluded from interval *t*’s uncertainty band. And initial warm-up periods under 12 intervals return `NaN` rather than leaking future values backward.

---

### [7:15 – 8:25] Resilient Ingestion, Atomic Caching & Provenance

🎬 **ACTION:** Scroll in `elexon_service.py` to `_get_with_backoff`, `_save_to_cache`, and `_read_metadata`.

Next, let's look at API resilience and cache atomicity.

The public Elexon BMRS API is subject to rate limits and intermittent network drops.

1. **Bounded Exponential Backoff (`_get_with_backoff`):** We parse HTTP 429 `Retry-After` headers, retry on 5xx server errors, and fail fast on 4xx client errors.
2. **Atomic Cache Writes (`_save_to_cache`):** In containerized deployments, writing directly to live cache files risks corrupted reads. We serialize to `.parquet.tmp`, `.db.tmp`, and `.json.tmp` first, then execute an atomic OS-level swap using `os.replace`.
3. **Strict Data Provenance (`_read_metadata`):** When reloading from cache, the service marks `isCached = True` while preserving the exact upstream provenance (`isSynthetic: false`, `source: ELEXON_LIVE`). It never disguises fallback data as live Elexon telemetry.

---

### [8:25 – 9:40] Automated Test Suite, Linting & CI/CD

🎬 **ACTION:**

1. Click into the **VS Code Terminal**.
2. Run: `ruff check backend/`
3. Run: `PYTHONPATH=backend pytest backend/tests/ -v`
4. Switch to Browser Tab 2 (**GitHub Actions**) showing the green build.

Finally, let’s verify our test suite and code quality checks.

In `backend/tests/test_analytics.py`, we built **27 deterministic unit and integration tests** covering:

* Exact MAE, RMSE, and bias calculations against known test vectors.
* Strict look-ahead rejection in `test_all_forecasts_after_cutoff_strictly_rejected`.
* Candidate fallback logic, causal `shift(1)` isolation, atomic cache writes, thermal capacity capping, and API validation.

Let’s run our linter first:
*(Run `ruff check backend/`)*
**Zero errors.**

Now let’s run the full pytest suite:
*(Run `PYTHONPATH=backend pytest backend/tests/ -v`)*
**All 27 tests pass in just over 4 seconds with zero skipped assertions.**

On the frontend, `npm run lint` runs strict TypeScript checking (`tsc --noEmit`) with zero compilation errors.

And on GitHub, our Actions CI pipeline automatically runs Ruff, pytest, TypeScript checks, and production Vite builds on every push — 100% green.

The application is deployed and live on Vercel, backed by Render, with full Docker support.

Thank you for watching, and I welcome your review.

