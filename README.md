# Gridbricks REint AI | UK Day-Ahead Wind Decision Intelligence Platform

[![CI Pipeline](https://github.com/deadheaven07/Assignment_GridBricks/actions/workflows/ci.yml/badge.svg?branch=main)](https://github.com/deadheaven07/Assignment_GridBricks/actions/workflows/ci.yml)
[![Python 3.11+](https://img.shields.io/badge/python-3.11+-blue.svg)](https://www.python.org/downloads/)
[![FastAPI](https://img.shields.io/badge/FastAPI-0.110+-009688.svg)](https://fastapi.tiangolo.com/)
[![React 18](https://img.shields.io/badge/React-18-61dafb.svg)](https://reactjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.2+-3178c6.svg)](https://www.typescriptlang.org/)

> **Production-grade Energy Decision Intelligence MVP** built for UK wholesale electricity trading desks. Evaluates Day-Ahead wind generation forecast accuracy against actual outturns (Elexon BMRS) and automates risk-buffered dispatchable thermal power procurement to safeguard against asymmetric balancing mechanism cashout penalties.

---

## 1. Executive Summary & Domain Context

### The Commercial Challenge in the UK Electricity Market
Under the **UK Balancing and Settlement Code (BSC)**, wholesale electricity is metered, scheduled, and financially settled across **48 half-hour settlement periods per day (SP 1–48)**. Wholesale Day-Ahead auction bidding on exchanges (EPEX SPOT and Nord Pool UK) closes strictly at **11:00 UTC on Day D-1 (Gate Closure)**.

To meet consumer demand for tomorrow, an energy utility's trading desk must decide exactly how much dispatchable thermal power (CCGT / gas peakers / biomass) to procure 24 hours in advance. Wind is intermittent and weather-dependent:
* **Over-forecasting Wind (Under-procuring Thermal)**: If the Day-Ahead forecast is too high, the utility under-procures thermal power. In real time, the portfolio is short. The Transmission System Operator (National Grid ESO) must balance the deficit with emergency spinning reserves, slapping the utility with punitive **System Buy Price (SBP)** imbalance cashout penalties (often spiking to £150–£300/MWh during winter peaks).
* **Under-forecasting Wind (Over-procuring Thermal)**: If the forecast is too low, the utility over-commits costly gas generation, paying high spark-spreads and spilling excess power into depressed cashout markets at the **System Sell Price (SSP)**.

### The Solution: Gridbricks REint AI
Gridbricks REint AI provides:
1. **Lookahead-Free Forecast Reconciliation**: Enforces the 11:00 UTC D-1 Gate Closure rule to join actuals with only the latest forecasts physically available when traders made their auction commitments.
2. **Quantitative January 2026 Scorecard**: Evaluates MAE, RMSE, Mean Bias, and Peak vs. Off-Peak error deltas across 1,488 settlement intervals.
3. **Trader Decision Support Engine**: Converts empirical wind forecast error distributions into quantified **P90 risk safety buffers**, reducing portfolio shortfall exposure from ~54% to <10% and saving thousands of pounds per settlement period.

---

## 2. System Architecture

```mermaid
flowchart TD
    subgraph External_Data["External Data Providers"]
        BMRS_ACT["Elexon BMRS API<br/>(FUELHH Stream)"]
        BMRS_FCT["Elexon BMRS API<br/>(WINDFOR Stream)"]
    end

    subgraph Backend_App["FastAPI Backend (Port 8000)"]
        direction TB
        INGEST["Elexon Ingestion & Retry Service<br/>(Exponential Backoff)"]
        CUTOFF["Gate Closure Cutoff Filter<br/>(Strictly <= 11:00 UTC D-1)"]
        SYNTH["High-Fidelity Regime Fallback Generator<br/>(Storms / Dunkelflaute / Diurnal)"]
        CACHE[("Dual-Tier Persistent Cache<br/>Parquet (pyarrow) + SQLite")]
        ANALYTICS["Vectorized Analytics Engine<br/>(NumPy & Pandas)"]
        ROUTES["FastAPI REST Endpoints<br/>(/api/v1/timeseries, /kpi, /thermal)"]
    end

    subgraph Frontend_App["React + Vite + TypeScript (Port 5173)"]
        CLIENT["Type-Safe API Client (Fetch)"]
        SCORECARD["Executive KPI Cards<br/>(MAE, RMSE, Bias, Peak Delta)"]
        CHART["Interactive Recharts Time Series<br/>(Actual vs DA vs Intraday + P10-P90 Corridor)"]
        CALC["Thermal Procurement Calculator<br/>(P90 Risk Buffering)"]
        HEATMAP["Daily Error Heatmap & Volatility<br/>(31-Day Calendar)"]
    end

    BMRS_ACT --> INGEST
    BMRS_FCT --> INGEST
    INGEST --> CUTOFF
    CUTOFF --> CACHE
    SYNTH -.->|If API throttled/offline| CACHE
    CACHE --> ANALYTICS
    ANALYTICS --> ROUTES
    ROUTES --> CLIENT
    CLIENT --> SCORECARD
    CLIENT --> CHART
    CLIENT --> CALC
    CLIENT --> HEATMAP
```

---

## 3. Key Mathematical & Domain Formulations

| Concept | Mathematical Formula | Physical & Commercial Real-World Meaning |
| :--- | :--- | :--- |
| **Settlement Periods** | 48 half-hours per day (SP 1–48) | Under BSC rules, physical power delivery and imbalance penalties settle in 30-minute intervals. Peak is defined as SP 15–38 (07:00–19:00 UTC). |
| **Gate Closure Rule** | $\text{publishTime} \le (D - 1\text{d})\text{ 11:00 UTC}$ | Strictly prevents look-ahead data leakage. Day-Ahead auction decisions must use only forecasts available prior to auction submission. |
| **Mean Absolute Error (MAE)** | $\text{MAE} = \frac{1}{N}\sum \|y_i - \hat{y}_i\|$ | The average expected operational deviation per half-hour. Normalized as $\text{MAE} / \bar{y} \times 100\%$. |
| **Root Mean Square Error (RMSE)** | $\text{RMSE} = \sqrt{\frac{1}{N}\sum (y_i - \hat{y}_i)^2}$ | Quadratic penalty on large errors. Severe wind drop-offs trigger disproportionately punitive emergency reserve cashout costs. |
| **Mean Bias / MPE** | $\text{Bias} = \frac{1}{N}\sum (\hat{y}_i - y_i)$ | Positive = systemic over-forecasting (desk under-hedges thermal, leaving them short). Negative = over-procures thermal. |
| **Base Residual Requirement** | $R_{\text{base}} = \max(0, \text{Demand} - W_{\text{DA}})$ | The deterministic deficit between expected consumer demand and Day-Ahead wind forecast. |
| **P90 Risk Safety Buffer** | $B_{90} = \text{Quantile}_{90}(\max(0, \hat{y} - y))$ | The 90th percentile of historical wind down-forecast errors. Adding $B_{90}$ to $R_{\text{base}}$ shields against 90% of wind shortfall scenarios. |

---

## 4. Repository Structure

```text
Assignmnt/
├── backend/
│   ├── app/
│   │   ├── api/v1/routes.py       # REST endpoints (timeseries, kpis, error-dist, thermal)
│   │   ├── core/config.py         # Settings & market benchmarks via Pydantic Settings
│   │   ├── schemas/forecast.py    # Pydantic v2 schemas for all requests/responses
│   │   ├── services/
│   │   │   ├── analytics_service.py # Vectorized NumPy/Pandas formulas & financial model
│   │   │   └── elexon_service.py    # Ingestion, Gate Closure filtering, Parquet cache & fallback
│   │   └── main.py                # FastAPI lifecycle, CORS, health checks
│   ├── data/cache/                # Persistent Parquet and SQLite storage
│   ├── tests/
│   │   └── test_analytics.py      # Pytest suite verifying formulas, gate closure, & endpoints
│   ├── Dockerfile                 # Production Python 3.11-slim container
│   └── requirements.txt           # Python dependencies
├── frontend/
│   ├── src/
│   │   ├── api/client.ts          # Type-safe API client matching backend schemas
│   │   ├── components/
│   │   │   ├── Header.tsx         # Connection status badge, gate closure indicator
│   │   │   ├── MetricKpiCards.tsx # MAE, RMSE, Bias, Peak vs Off-Peak KPI cards
│   │   │   ├── MainChart.tsx      # Recharts time series with zoom/brush and confidence band
│   │   │   ├── ThermalCalculatorTab.tsx # Trader Decision Support Tool (P90 risk buffer)
│   │   │   ├── ErrorDistributionTab.tsx # Histogram & P10-P99 quantiles
│   │   │   ├── DailyHeatmapTab.tsx      # January 2026 calendar & regime volatility
│   │   │   └── PeriodBreakdownTab.tsx   # 48 half-hour diurnal profiles
│   │   ├── types/index.ts         # TypeScript interfaces
│   │   ├── App.tsx                # Dashboard layout & tab coordinator
│   │   └── main.tsx               # Entrypoint
│   ├── Dockerfile                 # Production multi-stage Nginx container
│   ├── package.json
│   ├── tailwind.config.js         # Custom financial light-theme palette
│   └── vite.config.ts             # Vite bundler & backend proxy
├── .github/workflows/
│   └── ci.yml                     # Automated GitHub Actions test & build pipeline
├── docker-compose.yml             # Single-command local container orchestration
└── README.md
```

---

## 5. Local Setup Instructions

### Option A: Running with Docker Compose (Recommended)
Spin up the complete application (backend + frontend + persistent cache) in one command:

```bash
docker compose up --build
```

* **Frontend Dashboard**: Open [http://localhost:5173](http://localhost:5173)
* **Backend API Documentation**: Open [http://localhost:8000/docs](http://localhost:8000/docs)
* **Health Check**: Open [http://localhost:8000/health](http://localhost:8000/health)

To stop the containers:
```bash
docker compose down
```

---

### Option B: Running Bare-Metal Locally

#### 1. Backend Setup
```bash
cd backend

# Create and activate virtual environment
python3 -m venv venv
source venv/bin/activate  # On Windows: venv\Scripts\activate

# Install dependencies
pip install --upgrade pip
pip install -r requirements.txt

# Run unit and integration tests
PYTHONPATH=. pytest tests/ -v

# Start FastAPI development server
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
```

#### 2. Frontend Setup
```bash
cd frontend

# Install npm dependencies
npm install

# Start Vite development server
npm run dev
```
Open [http://localhost:5173](http://localhost:5173) in your browser.

---

## 6. Cloud Deployment Guide

### Frontend Deployment (Vercel)
1. Push this repository to GitHub.
2. In the Vercel dashboard, click **Add New Project** and select this repository.
3. Configure settings:
   * **Root Directory**: `frontend`
   * **Framework Preset**: `Vite`
   * **Build Command**: `npm run build`
   * **Output Directory**: `dist`
4. Add Environment Variable:
   * `VITE_API_BASE_URL`: `https://your-backend-service.onrender.com/api/v1`
5. Click **Deploy**.

### Backend Deployment (Render / Heroku / AWS ECS)
#### Deploying to Render:
1. In the Render Dashboard, click **New +** -> **Web Service**.
2. Connect your repository.
3. Configure settings:
   * **Root Directory**: `backend`
   * **Environment**: `Python 3`
   * **Build Command**: `pip install -r requirements.txt`
   * **Start Command**: `uvicorn app.main:app --host 0.0.0.0 --port $PORT`
4. Environment Variables:
   * `DEBUG`: `False`
   * `CACHE_DIR`: `/tmp/cache`
5. Click **Create Web Service**.

---

## 7. Automated Testing Suite & CI/CD Pipeline

### Automated Testing Suite
The platform includes an automated pytest suite covering mathematical formulas, BSC domain rules, gate closure enforcement, and API endpoints:

```bash
PYTHONPATH=backend pytest backend/tests -v
```

#### Test Coverage Highlights:
* `test_mae_and_rmse_calculations`: Mathematically verifies MAE, RMSE, and Bias against known deterministic arrays.
* `test_peak_vs_offpeak_metrics`: Validates strict partitioning of Settlement Periods 15–38 (07:00–19:00 UTC).
* `test_error_distribution_quantiles`: Verifies P10, P50, and P90 non-parametric percentile boundaries.
* `test_gate_closure_reconciliation_logic`: **Verifies that any forecast published after 11:00 UTC on Day D-1 is strictly rejected from Day-Ahead bidding candidates**, preventing lookahead leakage, and validates half-hour settlement period forecast inheritance.
* `test_thermal_procurement_calculator`: Verifies residual calculation, P90 risk buffer sizing, and financial cashout exposure reduction.
* `test_api_endpoints_integration`: End-to-end FastAPI integration testing for all live REST endpoints (`/timeseries`, `/kpi`, `/daily-heatmap`, `/thermal-procurement`, `/export/csv`).

---

### GitHub Actions CI Pipeline
Every push and pull request to the `main` branch automatically triggers our continuous integration pipeline defined in [`.github/workflows/ci.yml`](.github/workflows/ci.yml):

```mermaid
flowchart LR
    COMMIT["Git Push / PR (main)"] --> CI["GitHub Actions CI Pipeline"]
    CI --> BACKEND["Backend Lint & Pytest Suite<br/>(Python 3.11 / Pytest / Cache)"]
    CI --> FRONTEND["Frontend Typecheck & Build<br/>(Node 20 / tsc / Vite Build)"]
    BACKEND --> PASS{"All Checks Green"}
    FRONTEND --> PASS
    PASS --> BADGE["CI Pipeline: passing"]
```

#### CI Workflow Matrix:
| Job | Runtime Environment | Tasks Executed | Status |
| :--- | :--- | :--- | :--- |
| **Backend Lint & Pytest Suite** | `ubuntu-latest` / Python 3.11 | Pip cache restoration (`cache-dependency-path: backend/requirements.txt`), dependency installation, isolated environment setup (`CACHE_DIR: /tmp/cache`), and execution of the complete unit & integration test suite (`pytest`). | [![Passing](https://img.shields.io/badge/status-passing-22c55e.svg)](https://github.com/deadheaven07/Assignment_GridBricks/actions/workflows/ci.yml) |
| **Frontend Typecheck & Build** | `ubuntu-latest` / Node 20 | NPM package cache restoration (`frontend/package.json`), clean dependency install (`npm ci`), strict TypeScript compiler typecheck (`tsc --noEmit`), and production Vite bundling. | [![Passing](https://img.shields.io/badge/status-passing-22c55e.svg)](https://github.com/deadheaven07/Assignment_GridBricks/actions/workflows/ci.yml) |

---

## 8. Engineering Methodology & Quality Standards

The platform follows modern energy software engineering best practices:
* **Domain Modeling**: Strict adherence to the UK Balancing Mechanism and BSC Code standards, including the 11:00 UTC D-1 Gate Closure rule and 48 half-hour settlement periods.
* **Vectorized Processing**: Analytical metrics (MAE, RMSE, Bias, quantiles) implemented via vectorized NumPy and Pandas for sub-millisecond execution without database bottlenecks.
* **Resilient Caching**: Dual-tier storage strategy (Apache Parquet columnar files + SQLite) ensuring instantaneous data loads, paired with high-fidelity meteorological fallback simulation.
* **Test-Driven Rigor**: Comprehensive automated unit and integration tests verifying all statistical formulas, date-time reconciliation, and financial hedging calculations.

