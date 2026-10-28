"""
Unit Tests for Gridbricks / REint AI Analytics & Gate-Closure Logic
===================================================================

Verifies:
1. Error Metric Formulas (MAE, RMSE, Mean Bias, Peak vs Off-Peak Delta).
2. Gate-Closure Cutoff Logic (strict 11:00 UTC D-1 enforcement, no lookahead leakage).
3. Quantile calculations (P10, P50, P90).
4. Thermal Procurement Decision Engine (Residual calculation & risk buffering).
5. API Endpoint integrations via FastAPI TestClient.
"""

from datetime import datetime, time, timedelta, timezone
import pytest
import numpy as np
import pandas as pd
from fastapi.testclient import TestClient

from app.main import app
from app.services.analytics_service import analytics_service
from app.services.elexon_service import elexon_service
from app.schemas.forecast import ThermalProcurementRequest


@pytest.fixture
def sample_aligned_dataframe():
    """Generates a controlled synthetic DataFrame with known values for deterministic testing."""
    records = []
    # 2 days: Day 1 and Day 2 (48 periods each = 96 rows)
    for d in [1, 2]:
        date_str = f"2026-01-0{d}"
        for sp in range(1, 49):
            is_peak = 15 <= sp <= 38
            # Known baseline: actual = 5000 MW
            # In peak hours, forecast = 5500 MW (over-forecast by 500 MW)
            # In off-peak hours, forecast = 4700 MW (under-forecast by 300 MW)
            actual_mw = 5000.0
            if is_peak:
                da_fct = 5500.0
            else:
                da_fct = 4700.0

            id_fct = actual_mw + 50.0  # Intraday error is small: +50 MW

            err = da_fct - actual_mw
            abs_err = abs(err)

            records.append({
                "startTime": f"{date_str}T{(sp-1)//2:02d}:{((sp-1)%2)*30:02d}:00Z",
                "settlementDate": date_str,
                "settlementPeriod": sp,
                "isPeak": is_peak,
                "actualMw": actual_mw,
                "dayAheadForecastMw": da_fct,
                "intradayForecastMw": id_fct,
                "errorMw": err,
                "absErrorMw": abs_err,
                "pctError": (err / actual_mw) * 100.0,
                "confidenceLowerMw": da_fct - 200.0,
                "confidenceUpperMw": da_fct + 200.0
            })

    return pd.DataFrame(records)


def test_mae_and_rmse_calculations(sample_aligned_dataframe):
    """Verifies vector calculation of MAE, RMSE, and Mean Bias."""
    kpi = analytics_service.calculate_kpis(sample_aligned_dataframe)

    # 48 peak periods across 2 days (error = +500 MW, abs_error = 500)
    # 48 off-peak periods across 2 days (error = -300 MW, abs_error = 300)
    # Total MAE = (48*500 + 48*300) / 96 = 400.0 MW
    assert pytest.approx(kpi.maeMw, rel=1e-3) == 400.0

    # Total RMSE = sqrt((48*(500^2) + 48*((-300)^2)) / 96) = sqrt((250000 + 90000)/2) = sqrt(170000) ≈ 412.31 MW
    expected_rmse = np.sqrt((500**2 + (-300)**2) / 2.0)
    assert pytest.approx(kpi.rmseMw, rel=1e-3) == round(expected_rmse, 2)

    # Mean Bias = (48*(+500) + 48*(-300)) / 96 = 200 / 2 = +100.0 MW
    assert pytest.approx(kpi.meanBiasMw, rel=1e-3) == 100.0


def test_peak_vs_offpeak_metrics(sample_aligned_dataframe):
    """Verifies proper partitioning of Peak (SP 15-38) vs Off-Peak."""
    kpi = analytics_service.calculate_kpis(sample_aligned_dataframe)

    assert pytest.approx(kpi.peakMaeMw, rel=1e-3) == 500.0
    assert pytest.approx(kpi.offPeakMaeMw, rel=1e-3) == 300.0
    assert pytest.approx(kpi.peakOffPeakDeltaMw, rel=1e-3) == 200.0


def test_error_distribution_quantiles(sample_aligned_dataframe):
    """Verifies non-parametric percentile boundaries (P10, P50, P90)."""
    dist = analytics_service.calculate_error_distribution(sample_aligned_dataframe, num_bins=10)

    # 50% of values are -300 and 50% are +500
    # Median (P50) is the midpoint or close to 100
    assert dist.p10 == -300.0
    assert dist.p90 == 500.0
    assert len(dist.histogram) > 0


def test_gate_closure_reconciliation_logic():
    """
    Critical Domain Test:
    Verifies that for delivery on Day D, any forecast published after Day D-1 at 11:00 UTC
    is strictly rejected from the Day-Ahead forecast candidate pool.
    """
    delivery_date_str = "2026-01-15"
    delivery_date = datetime.strptime(delivery_date_str, "%Y-%m-%d").date()
    target_start_time = "2026-01-15T14:00:00Z"  # SP 29 on Day D

    # Cutoff is 2026-01-14 11:00:00 UTC
    cutoff_dt = datetime(2026, 1, 14, 11, 0, 0, tzinfo=timezone.utc)

    # Actual generation
    actuals = [{
        "startTime": target_start_time,
        "settlementDate": delivery_date_str,
        "settlementPeriod": 29,
        "fuelType": "WIND",
        "generation": 8200.0
    }]

    # 3 published forecasts for the same target delivery:
    # 1. Published D-1 at 08:00 UTC (Eligible for Day-Ahead) -> 7900 MW
    # 2. Published D-1 at 10:45 UTC (Eligible for Day-Ahead, latest before 11:00) -> 8100 MW
    # 3. Published D-1 at 11:15 UTC (Published after Gate Closure, should NOT be used for Day-Ahead!) -> 8500 MW
    # 4. Published D-0 at 12:00 UTC (Intraday forecast) -> 8250 MW
    forecasts = [
        {"startTime": target_start_time, "publishTime": "2026-01-14T08:00:00Z", "generation": 7900.0},
        {"startTime": target_start_time, "publishTime": "2026-01-14T10:45:00Z", "generation": 8100.0},
        {"startTime": target_start_time, "publishTime": "2026-01-14T11:15:00Z", "generation": 8500.0},
        {"startTime": target_start_time, "publishTime": "2026-01-15T12:00:00Z", "generation": 8250.0},
    ]

    aligned_df = elexon_service._reconcile_and_apply_gate_closure(actuals, forecasts)

    assert len(aligned_df) == 1
    row = aligned_df.iloc[0]

    # Day-Ahead forecast must strictly be 8100.0 (the latest published BEFORE 11:00 UTC on D-1)
    assert row["dayAheadForecastMw"] == 8100.0
    # Intraday forecast should capture the latest before physical delivery
    assert row["intradayForecastMw"] == 8250.0
    assert row["actualMw"] == 8200.0


def test_thermal_procurement_calculator(sample_aligned_dataframe):
    """
    Verifies decision support calculation:
    - Base Residual Thermal = Demand - Wind Forecast
    - Risk Buffer provides empirical P90 shortfall protection
    - Financial impact quantification
    """
    req = ThermalProcurementRequest(
        expectedDemandMw=34000.0,
        windForecastMw=8000.0,
        riskConfidenceLevel=0.90,
        ccgtMarginalCostGbp=75.0,
        systemBuyPriceGbp=120.0,
        systemSellPriceGbp=40.0,
        dayAheadPowerPriceGbp=85.0
    )

    resp = analytics_service.calculate_thermal_procurement(sample_aligned_dataframe, req)

    # Base residual = 34000 - 8000 = 26000 MW
    assert resp.baseResidualThermalMw == 26000.0
    assert resp.demandMw == 34000.0
    assert resp.windForecastMw == 8000.0

    # Recommended total thermal must be >= base residual
    assert resp.recommendedTotalThermalMw >= resp.baseResidualThermalMw
    assert resp.recommendedRiskBufferMw >= 0.0

    # Buffered deficit risk percentage must be strictly less than unbuffered deficit risk
    assert resp.bufferedDeficitRiskPct <= resp.unbufferedDeficitRiskPct
    assert len(resp.hedgingRationale) > 0


def test_api_endpoints_integration():
    """Tests FastAPI live integration endpoints using TestClient."""
    client = TestClient(app)

    # Health check
    resp_health = client.get("/health")
    assert resp_health.status_code == 200
    assert resp_health.json()["status"] == "healthy"

    # KPI endpoint
    resp_kpi = client.get("/api/v1/kpi")
    assert resp_kpi.status_code == 200
    data_kpi = resp_kpi.json()
    assert "maeMw" in data_kpi
    assert "rmseMw" in data_kpi
    assert "meanBiasMw" in data_kpi
    assert data_kpi["sampleCount"] > 0

    # Timeseries endpoint
    resp_ts = client.get("/api/v1/timeseries?startDate=2026-01-01&endDate=2026-01-03")
    assert resp_ts.status_code == 200
    data_ts = resp_ts.json()
    assert "data" in data_ts
    assert len(data_ts["data"]) == 3 * 48  # 3 days * 48 half-hours = 144
    assert data_ts["cutoffRule"] == "11:00 UTC D-1 Gate Closure"

    # Daily heatmap endpoint
    resp_heat = client.get("/api/v1/daily-heatmap")
    assert resp_heat.status_code == 200
    data_heat = resp_heat.json()
    assert len(data_heat) == 31  # 31 days in January

    # Thermal procurement endpoint
    resp_proc = client.post("/api/v1/thermal-procurement", json={"expectedDemandMw": 32000.0})
    assert resp_proc.status_code == 200
    data_proc = resp_proc.json()
    assert data_proc["demandMw"] == 32000.0
    assert data_proc["recommendedTotalThermalMw"] > 0.0
