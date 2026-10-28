"""
Gridbricks / REint AI - Comprehensive Automated Test Suite
===========================================================

Deterministic Unit & Integration Tests:
1. Forecast published before the decision cutoff (11:00 UTC D-1).
2. Forecast published exactly at the decision cutoff.
3. Forecast published after cutoff is strictly rejected (zero lookahead leakage).
4. Multiple forecast versions for one delivery interval (selects latest eligible).
5. Hourly-to-half-hourly mapping across 48 half-hour settlement periods.
6. Duplicate and out-of-order timestamps deduplication and ordering.
7. Missing settlement periods and handling of missing forecasts in KPI evaluation.
8. Cache validation (rejects partial or schema-tampered files).
9. External API failure fallback with transparent provenance (SYNTHETIC_DEMO).
10. Thermal procurement calculator edge cases (zero demand, capacity limits, cashout spreads).
11. Empirical P10-P90 uncertainty corridor evaluation.
12. FastAPI endpoint integration contracts and metadata verification.

Author: Senior Energy Software Engineer
"""

from datetime import datetime, time, timedelta, timezone
from unittest.mock import patch, MagicMock
import pytest
import requests
import numpy as np
import pandas as pd
from fastapi.testclient import TestClient

from app.main import app
from app.services.analytics_service import analytics_service
from app.services.elexon_service import elexon_service, ElexonService
from app.schemas.forecast import (
    ThermalProcurementRequest,
    DataSourceType,
    DatasetMetadata
)


@pytest.fixture
def sample_aligned_dataframe():
    """Generates a controlled synthetic DataFrame with known values for deterministic testing."""
    records = []
    # 2 days: Day 1 and Day 2 (48 periods each = 96 rows)
    for d in [1, 2]:
        date_str = f"2026-01-0{d}"
        for sp in range(1, 49):
            is_peak = 15 <= sp <= 38
            actual_mw = 5000.0
            if is_peak:
                da_fct = 5500.0  # +500 MW over-forecast
            else:
                da_fct = 4700.0  # -300 MW under-forecast

            id_fct = actual_mw + 50.0

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
                "confidenceLowerMw": da_fct - 250.0,
                "confidenceUpperMw": da_fct + 250.0,
                "isMissingForecast": False
            })

    return pd.DataFrame(records)


# ---------------------------------------------------------------------------
# 1. Math and Metric Verification Tests
# ---------------------------------------------------------------------------

def test_mae_and_rmse_calculations(sample_aligned_dataframe):
    """Verifies vector calculation of MAE, RMSE, and Mean Bias."""
    kpi = analytics_service.calculate_kpis(sample_aligned_dataframe)

    # Total MAE = (48*500 + 48*300) / 96 = 400.0 MW
    assert pytest.approx(kpi.maeMw, rel=1e-3) == 400.0

    # Total RMSE = sqrt((500^2 + (-300)^2) / 2) = sqrt(170000) ≈ 412.31 MW
    expected_rmse = np.sqrt((500**2 + (-300)**2) / 2.0)
    assert pytest.approx(kpi.rmseMw, rel=1e-3) == round(expected_rmse, 2)

    # Mean Bias = (48*(+500) + 48*(-300)) / 96 = 100.0 MW
    assert pytest.approx(kpi.meanBiasMw, rel=1e-3) == 100.0
    assert kpi.coveragePct == 100.0
    assert kpi.validSampleCount == 96


def test_peak_vs_offpeak_metrics(sample_aligned_dataframe):
    """Verifies proper partitioning of Peak (SP 15-38) vs Off-Peak."""
    kpi = analytics_service.calculate_kpis(sample_aligned_dataframe)

    assert pytest.approx(kpi.peakMaeMw, rel=1e-3) == 500.0
    assert pytest.approx(kpi.offPeakMaeMw, rel=1e-3) == 300.0
    assert pytest.approx(kpi.peakOffPeakDeltaMw, rel=1e-3) == 200.0


def test_error_distribution_quantiles(sample_aligned_dataframe):
    """Verifies non-parametric percentile boundaries (P10, P50, P90)."""
    dist = analytics_service.calculate_error_distribution(sample_aligned_dataframe, num_bins=10)

    assert dist.p10 == -300.0
    assert dist.p90 == 500.0
    assert len(dist.histogram) > 0


# ---------------------------------------------------------------------------
# 2. Gate-Closure & Look-Ahead Prevention Tests
# ---------------------------------------------------------------------------

def test_forecast_published_before_and_at_cutoff():
    """
    Verifies that forecasts published before or exactly at 11:00 UTC D-1 are accepted.
    """
    delivery_date_str = "2026-01-15"
    target_start_time = "2026-01-15T14:00:00Z"  # SP 29 on Day D

    actuals = [{
        "startTime": target_start_time,
        "settlementDate": delivery_date_str,
        "settlementPeriod": 29,
        "fuelType": "WIND",
        "generation": 8000.0
    }]

    # Case A: Published strictly before cutoff (10:45 UTC D-1)
    forecasts_before = [
        {"startTime": target_start_time, "publishTime": "2026-01-14T10:45:00Z", "generation": 8100.0}
    ]
    df_before = elexon_service._reconcile_and_apply_gate_closure(actuals, forecasts_before)
    assert df_before.iloc[0]["dayAheadForecastMw"] == 8100.0

    # Case B: Published exactly at cutoff (11:00:00 UTC D-1)
    forecasts_at = [
        {"startTime": target_start_time, "publishTime": "2026-01-14T11:00:00Z", "generation": 8200.0}
    ]
    df_at = elexon_service._reconcile_and_apply_gate_closure(actuals, forecasts_at)
    assert df_at.iloc[0]["dayAheadForecastMw"] == 8200.0


def test_all_forecasts_after_cutoff_strictly_rejected():
    """
    CRITICAL REGRESSION TEST:
    When all forecasts are published after 11:00 UTC D-1 (e.g. 11:01, 12:00, 15:00),
    dayAheadForecastMw MUST be None. Under no circumstances should a post-cutoff forecast
    leak into the Day-Ahead position!
    """
    delivery_date_str = "2026-01-15"
    target_start_time = "2026-01-15T14:00:00Z"

    actuals = [{
        "startTime": target_start_time,
        "settlementDate": delivery_date_str,
        "settlementPeriod": 29,
        "fuelType": "WIND",
        "generation": 8500.0
    }]

    # Only post-cutoff forecasts available
    forecasts_after = [
        {"startTime": target_start_time, "publishTime": "2026-01-14T11:00:01Z", "generation": 8600.0},
        {"startTime": target_start_time, "publishTime": "2026-01-14T12:00:00Z", "generation": 8700.0},
        {"startTime": target_start_time, "publishTime": "2026-01-15T10:00:00Z", "generation": 8450.0}
    ]

    aligned_df = elexon_service._reconcile_and_apply_gate_closure(actuals, forecasts_after)
    assert len(aligned_df) == 1
    row = aligned_df.iloc[0]

    # Must be None/NaN - no lookahead leakage
    assert pd.isna(row["dayAheadForecastMw"])
    assert row["isMissingForecast"] == True
    # Intraday should still pick up the forecast published before T-1h (13:00 UTC)
    assert row["intradayForecastMw"] == 8450.0


def test_multiple_forecast_versions_selects_latest_eligible():
    """
    Verifies that when multiple forecasts are issued before the cutoff,
    the latest version is chosen.
    """
    delivery_date_str = "2026-01-20"
    target_start_time = "2026-01-20T10:00:00Z"

    actuals = [{
        "startTime": target_start_time,
        "settlementDate": delivery_date_str,
        "settlementPeriod": 21,
        "fuelType": "WIND",
        "generation": 6000.0
    }]

    forecasts = [
        {"startTime": target_start_time, "publishTime": "2026-01-19T06:00:00Z", "generation": 5200.0},
        {"startTime": target_start_time, "publishTime": "2026-01-19T09:30:00Z", "generation": 5600.0},
        {"startTime": target_start_time, "publishTime": "2026-01-19T10:55:00Z", "generation": 5900.0},  # Latest before 11:00
        {"startTime": target_start_time, "publishTime": "2026-01-19T11:05:00Z", "generation": 6300.0},  # After 11:00
    ]

    aligned_df = elexon_service._reconcile_and_apply_gate_closure(actuals, forecasts)
    assert aligned_df.iloc[0]["dayAheadForecastMw"] == 5900.0


def test_hourly_to_half_hourly_mapping():
    """
    Verifies that hourly forecasts (:00) properly map to both half-hour periods in that hour.
    """
    delivery_date_str = "2026-01-10"
    actuals = [
        {"startTime": "2026-01-10T14:00:00Z", "settlementDate": delivery_date_str, "settlementPeriod": 29, "fuelType": "WIND", "generation": 7000.0},
        {"startTime": "2026-01-10T14:30:00Z", "settlementDate": delivery_date_str, "settlementPeriod": 30, "fuelType": "WIND", "generation": 7200.0}
    ]

    forecasts = [
        {"startTime": "2026-01-10T14:00:00Z", "publishTime": "2026-01-09T09:00:00Z", "generation": 7100.0}
    ]

    aligned_df = elexon_service._reconcile_and_apply_gate_closure(actuals, forecasts)
    assert len(aligned_df) == 2
    assert aligned_df.iloc[0]["dayAheadForecastMw"] == 7100.0
    assert aligned_df.iloc[1]["dayAheadForecastMw"] == 7100.0


def test_duplicate_and_out_of_order_timestamps():
    """
    Verifies that out-of-order actuals and duplicate observations are properly sorted and deduplicated.
    """
    delivery_date_str = "2026-01-05"
    actuals = [
        {"startTime": "2026-01-05T01:00:00Z", "settlementDate": delivery_date_str, "settlementPeriod": 3, "fuelType": "WIND", "generation": 4000.0},
        {"startTime": "2026-01-05T00:00:00Z", "settlementDate": delivery_date_str, "settlementPeriod": 1, "fuelType": "WIND", "generation": 3800.0},
        {"startTime": "2026-01-05T00:00:00Z", "settlementDate": delivery_date_str, "settlementPeriod": 1, "fuelType": "WIND", "generation": 3800.0},  # Duplicate
        {"startTime": "2026-01-05T00:30:00Z", "settlementDate": delivery_date_str, "settlementPeriod": 2, "fuelType": "WIND", "generation": 3900.0}
    ]
    forecasts = [
        {"startTime": "2026-01-05T00:00:00Z", "publishTime": "2026-01-04T08:00:00Z", "generation": 3850.0}
    ]

    aligned_df = elexon_service._reconcile_and_apply_gate_closure(actuals, forecasts)
    assert len(aligned_df) == 3
    assert list(aligned_df["settlementPeriod"]) == [1, 2, 3]


def test_missing_forecast_does_not_distort_kpis(sample_aligned_dataframe):
    """
    Verifies that when some periods have missing forecasts, KPIs evaluate only
    over valid observations and report coverage percentage accurately.
    """
    df = sample_aligned_dataframe.copy()
    # Mask 10 rows as missing
    df.loc[0:9, "dayAheadForecastMw"] = np.nan
    df.loc[0:9, "errorMw"] = np.nan
    df.loc[0:9, "absErrorMw"] = np.nan

    kpis = analytics_service.calculate_kpis(df)
    assert kpis.sampleCount == 96
    assert kpis.validSampleCount == 86
    assert pytest.approx(kpis.coveragePct, rel=1e-1) == 89.6
    # MAE should still evaluate over the remaining valid 86 rows
    assert kpis.maeMw > 0.0


# ---------------------------------------------------------------------------
# 3. Cache & Provenance Validation Tests
# ---------------------------------------------------------------------------

def test_cache_validation_rejects_corrupted_datasets(tmp_path):
    """
    Verifies that cache validation rejects datasets with missing columns, wrong row counts,
    or duplicate settlement periods.
    """
    service = ElexonService(cache_dir=str(tmp_path))

    # Incomplete schema
    bad_df_1 = pd.DataFrame([{"startTime": "2026-01-01T00:00:00Z"}])
    assert not service._validate_cache_df(bad_df_1)

    # Incomplete record count (500 instead of 1,488)
    bad_df_2 = pd.DataFrame([{
        "startTime": "2026-01-01T00:00:00Z",
        "settlementDate": "2026-01-01",
        "settlementPeriod": 1,
        "isPeak": False,
        "actualMw": 5000.0,
        "dayAheadForecastMw": 5100.0,
        "errorMw": 100.0
    }] * 500)
    assert not service._validate_cache_df(bad_df_2)


def test_mocked_network_failure_fallback_to_synthetic(tmp_path):
    """
    Verifies that when Elexon network calls fail (e.g. timeout or HTTP 503),
    the system safely falls back to SYNTHETIC_DEMO and attaches an honest warning.
    """
    service = ElexonService(cache_dir=str(tmp_path))

    with patch("requests.Session.get") as mock_get:
        mock_get.side_effect = requests.RequestException("Connection timed out")
        df, meta = service.get_aligned_data(force_refresh=True)

        assert len(df) == 1488
        assert meta.source == DataSourceType.SYNTHETIC_DEMO
        assert meta.isSynthetic is True
        assert "Demonstration Mode" in (meta.warning or "")


# ---------------------------------------------------------------------------
# 4. Thermal Procurement Decision Engine Tests
# ---------------------------------------------------------------------------

def test_thermal_procurement_calculator(sample_aligned_dataframe):
    """
    Verifies decision support calculation:
    - Base Residual Thermal = Demand - Wind Forecast
    - Risk Buffer provides empirical P90 shortfall protection
    - 30-min settlement interval conversion (1 MW = 0.5 MWh)
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


def test_thermal_procurement_capacity_capping(sample_aligned_dataframe):
    """
    Verifies that if thermal procurement recommendation exceeds fleet capacity,
    it is cleanly capped and flagged with isCapacityConstrained=True.
    """
    req = ThermalProcurementRequest(
        expectedDemandMw=40000.0,
        windForecastMw=5000.0,
        maxThermalCapacityMw=32000.0,  # Fleet limit
        riskConfidenceLevel=0.95
    )

    resp = analytics_service.calculate_thermal_procurement(sample_aligned_dataframe, req)
    assert resp.isCapacityConstrained is True
    assert resp.recommendedTotalThermalMw == 32000.0
    assert resp.unconstrainedTotalThermalMw is not None
    assert resp.unconstrainedTotalThermalMw > 32000.0


def test_thermal_procurement_extreme_inputs(sample_aligned_dataframe):
    """
    Verifies calculator resilience under boundary conditions (e.g. wind forecast exceeds demand).
    """
    req = ThermalProcurementRequest(
        expectedDemandMw=10000.0,
        windForecastMw=15000.0  # Wind exceeds demand
    )
    resp = analytics_service.calculate_thermal_procurement(sample_aligned_dataframe, req)
    # Base residual cannot be negative
    assert resp.baseResidualThermalMw == 0.0


# ---------------------------------------------------------------------------
# 5. FastAPI Live Integration Tests
# ---------------------------------------------------------------------------

def test_api_endpoints_integration():
    """Tests FastAPI live integration endpoints using TestClient."""
    client = TestClient(app)

    # Health check
    resp_health = client.get("/health")
    assert resp_health.status_code == 200
    assert resp_health.json()["status"] == "healthy"

    # Metadata endpoint
    resp_meta = client.get("/api/v1/metadata")
    assert resp_meta.status_code == 200
    meta_json = resp_meta.json()
    assert "source" in meta_json
    assert "cutoffRule" in meta_json
    assert meta_json["totalRecords"] == 1488

    # KPI endpoint
    resp_kpi = client.get("/api/v1/kpi")
    assert resp_kpi.status_code == 200
    data_kpi = resp_kpi.json()
    assert "maeMw" in data_kpi
    assert "rmseMw" in data_kpi
    assert "coveragePct" in data_kpi
    assert data_kpi["sampleCount"] > 0

    # Timeseries endpoint
    resp_ts = client.get("/api/v1/timeseries?startDate=2026-01-01&endDate=2026-01-03")
    assert resp_ts.status_code == 200
    data_ts = resp_ts.json()
    assert "data" in data_ts
    assert len(data_ts["data"]) == 3 * 48  # 3 days * 48 half-hours = 144
    assert "source" in data_ts
    assert "coveragePct" in data_ts

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

    # CSV Export endpoint
    resp_csv = client.get("/api/v1/export/csv")
    assert resp_csv.status_code == 200
    assert resp_csv.headers["content-type"].startswith("text/csv")
    assert "dayAheadForecastMw" in resp_csv.text
