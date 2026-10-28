"""
Gridbricks / REint AI - API v1 Router
=====================================

Exposes high-performance analytical endpoints for the frontend client:
- Time Series: Joined Actuals, Day-Ahead Forecast (11:00 UTC D-1), Intraday, and Confidence Bands.
- Metadata: Provenance, data coverage, cutoff policies, and synthetic-data warnings.
- KPIs: Executive forecast accuracy metrics (MAE, RMSE, Bias, Peak/Off-Peak).
- Error Distribution: Parametric & non-parametric error quantiles (P10-P90) + Histogram.
- Daily Breakdown: Calendar heatmap data and volatility categorization.
- Diurnal Profiles: 48 half-hour settlement period aggregations.
- Decision Tool: Residual thermal procurement calculator with dynamic risk buffering.
"""

from datetime import datetime
from typing import List, Optional

import pandas as pd
from fastapi import APIRouter, HTTPException, Query, Response

from app.schemas.forecast import (
    DailyErrorMetric,
    DatasetMetadata,
    DataSourceType,
    ErrorDistribution,
    ForecastDataPoint,
    KPIMetrics,
    SettlementPeriodProfile,
    ThermalProcurementRequest,
    ThermalProcurementResponse,
    TimeSeriesResponse,
)
from app.services.analytics_service import analytics_service
from app.services.elexon_service import elexon_service

router = APIRouter()


def _validate_date_range(start_date: Optional[str], end_date: Optional[str]) -> None:
    """Validates date format and chronological ordering."""
    if start_date:
        try:
            d_start = datetime.strptime(start_date, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid startDate format. Expected YYYY-MM-DD.")
    if end_date:
        try:
            d_end = datetime.strptime(end_date, "%Y-%m-%d").date()
        except ValueError:
            raise HTTPException(status_code=400, detail="Invalid endDate format. Expected YYYY-MM-DD.")
    if start_date and end_date:
        if d_start > d_end:
            raise HTTPException(status_code=400, detail="startDate cannot be after endDate.")


def get_dataset(force_refresh: bool = False) -> tuple[pd.DataFrame, DatasetMetadata]:
    """Dependency helper to load cached or fresh aligned data with structured metadata."""
    df, meta = elexon_service.get_aligned_data(force_refresh=force_refresh)
    if df.empty:
        raise HTTPException(status_code=500, detail="Failed to load wind generation dataset.")
    return df, meta


@router.get("/metadata", response_model=DatasetMetadata)
def get_metadata():
    """
    Returns data provenance, source classification (ELEXON_LIVE, CACHE, SYNTHETIC_DEMO),
    record counts, coverage percentage, and active warning flags.
    """
    _, meta = get_dataset()
    return meta


@router.get("/timeseries", response_model=TimeSeriesResponse)
def get_timeseries(
    startDate: Optional[str] = Query(None, description="Filter start date YYYY-MM-DD"),
    endDate: Optional[str] = Query(None, description="Filter end date YYYY-MM-DD"),
    peakOnly: Optional[bool] = Query(False, description="Filter to peak hours only (SP 15-38)"),
    settlementPeriod: Optional[int] = Query(None, ge=1, le=50, description="Filter to specific half-hour period"),
    forceRefresh: Optional[bool] = Query(False, description="Force re-fetch from Elexon / cache")
):
    """
    Returns the time-series of half-hourly wind generation actuals and Day-Ahead forecasts.
    Guaranteed lookahead-free: Day-Ahead forecast strictly precedes 11:00 UTC D-1 Auction Deadline.
    """
    _validate_date_range(startDate, endDate)
    df, meta = get_dataset(force_refresh=forceRefresh)

    filtered_df = df.copy()
    if startDate:
        filtered_df = filtered_df[filtered_df["settlementDate"] >= startDate]
    if endDate:
        filtered_df = filtered_df[filtered_df["settlementDate"] <= endDate]
    if peakOnly:
        filtered_df = filtered_df[filtered_df["isPeak"]]
    if settlementPeriod:
        filtered_df = filtered_df[filtered_df["settlementPeriod"] == settlementPeriod]

    data_points = []
    for _, row in filtered_df.iterrows():
        da = float(row["dayAheadForecastMw"]) if pd.notna(row["dayAheadForecastMw"]) else None
        ida = float(row["intradayForecastMw"]) if pd.notna(row["intradayForecastMw"]) else None
        err = float(row["errorMw"]) if pd.notna(row["errorMw"]) else None
        abs_err = float(row["absErrorMw"]) if pd.notna(row["absErrorMw"]) else None
        pct_err = float(row["pctError"]) if pd.notna(row["pctError"]) else None
        c_low = float(row["confidenceLowerMw"]) if pd.notna(row["confidenceLowerMw"]) else None
        c_high = float(row["confidenceUpperMw"]) if pd.notna(row["confidenceUpperMw"]) else None

        data_points.append(
            ForecastDataPoint(
                startTime=str(row["startTime"]),
                settlementDate=str(row["settlementDate"]),
                settlementPeriod=int(row["settlementPeriod"]),
                isPeak=bool(row["isPeak"]),
                actualMw=float(row["actualMw"]),
                dayAheadForecastMw=da,
                intradayForecastMw=ida,
                errorMw=err,
                absErrorMw=abs_err,
                pctError=pct_err,
                confidenceLowerMw=c_low,
                confidenceUpperMw=c_high,
                isMissingForecast=bool(row.get("isMissingForecast", da is None))
            )
        )

    valid_count = sum(1 for dp in data_points if dp.dayAheadForecastMw is not None)
    coverage_pct = round((valid_count / len(data_points) * 100.0), 1) if data_points else 0.0

    # Determine status string for backward compatibility
    status_label = "Connected to Elexon BMRS" if meta.source == DataSourceType.ELEXON_LIVE else (
        "Local Cache (Validated Engine)" if meta.isCached and meta.source != DataSourceType.SYNTHETIC_DEMO else
        "Demonstration Dataset (Simulated Fallback)"
    )

    return TimeSeriesResponse(
        status=status_label,
        source=meta.source,
        isSynthetic=meta.isSynthetic,
        isCached=meta.isCached,
        warning=meta.warning,
        lastUpdatedAt=meta.lastUpdatedAt,
        cutoffRule=meta.cutoffRule,
        startDate=str(filtered_df["settlementDate"].min()) if not filtered_df.empty else (startDate or "2026-01-01"),
        endDate=str(filtered_df["settlementDate"].max()) if not filtered_df.empty else (endDate or "2026-01-31"),
        totalRecords=len(data_points),
        validRecords=valid_count,
        coveragePct=coverage_pct,
        empiricalCoverageP10P90Pct=meta.empiricalCoverageP10P90Pct,
        empiricalCoverageSampleCount=meta.empiricalCoverageSampleCount,
        data=data_points
    )


@router.get("/kpi", response_model=KPIMetrics)
def get_kpis(
    startDate: Optional[str] = Query(None),
    endDate: Optional[str] = Query(None)
):
    """
    Calculates executive-level forecast scorecard metrics (MAE, RMSE, Bias, Peak vs Off-Peak).
    """
    _validate_date_range(startDate, endDate)
    df, _ = get_dataset()
    filtered_df = df.copy()
    if startDate:
        filtered_df = filtered_df[filtered_df["settlementDate"] >= startDate]
    if endDate:
        filtered_df = filtered_df[filtered_df["settlementDate"] <= endDate]

    if filtered_df.empty:
        raise HTTPException(status_code=404, detail="No settlement data matching the specified date filters.")

    return analytics_service.calculate_kpis(filtered_df)


@router.get("/error-distribution", response_model=ErrorDistribution)
def get_error_distribution(
    numBins: int = Query(25, ge=10, le=60, description="Number of histogram frequency bins"),
    startDate: Optional[str] = Query(None),
    endDate: Optional[str] = Query(None)
):
    """
    Returns non-parametric error quantiles (P10, P50, P90) and frequency histogram
    for tail-risk analysis.
    """
    _validate_date_range(startDate, endDate)
    df, _ = get_dataset()
    filtered_df = df.copy()
    if startDate:
        filtered_df = filtered_df[filtered_df["settlementDate"] >= startDate]
    if endDate:
        filtered_df = filtered_df[filtered_df["settlementDate"] <= endDate]

    if filtered_df.empty:
        raise HTTPException(status_code=404, detail="No settlement data matching the specified date filters.")

    return analytics_service.calculate_error_distribution(filtered_df, num_bins=numBins)


@router.get("/daily-heatmap", response_model=List[DailyErrorMetric])
def get_daily_heatmap():
    """
    Returns daily aggregated error metrics and meteorological regime classifications
    for January 2026 calendar heatmap.
    """
    df, _ = get_dataset()
    return analytics_service.calculate_daily_breakdown(df)


@router.get("/settlement-profiles", response_model=List[SettlementPeriodProfile])
def get_settlement_profiles():
    """
    Returns average diurnal profiles across all 48 settlement periods.
    """
    df, _ = get_dataset()
    return analytics_service.calculate_settlement_period_profiles(df)


@router.post("/thermal-procurement", response_model=ThermalProcurementResponse)
def calculate_thermal_procurement(request: ThermalProcurementRequest):
    """
    Trader Decision Support Tool:
    Computes net residual thermal power requirement (Demand - Wind) and applies
    empirical P90 risk safety buffer to mitigate asymmetric cashout penalties.
    """
    df, _ = get_dataset()
    return analytics_service.calculate_thermal_procurement(df, request)


@router.post("/refresh-data")
def refresh_data():
    """
    Forces cache invalidation and re-ingestion from Elexon BMRS.
    """
    df, meta = elexon_service.get_aligned_data(force_refresh=True)
    return {
        "message": "Dataset refreshed successfully.",
        "source": meta.source,
        "isSynthetic": meta.isSynthetic,
        "records": len(df),
        "validRecords": meta.validRecords,
        "coveragePct": meta.coveragePct
    }


@router.get("/export/csv")
def export_dataset_csv():
    """
    Exports the complete reconciled January 2026 dataset (1,488 settlement half-hours)
    as a downloadable CSV for trading desk modeling and Excel quantitative audits.
    """
    df, _ = get_dataset()
    csv_bytes = df.to_csv(index=False)
    return Response(
        content=csv_bytes,
        media_type="text/csv",
        headers={
            "Content-Disposition": "attachment; filename=gridbricks_january_2026_wind_reconciliation.csv"
        }
    )
