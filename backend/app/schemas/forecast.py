from enum import Enum
from typing import List, Optional

from pydantic import BaseModel, Field


class DataSourceType(str, Enum):
    """
    Provenance tracking for datasets displayed in the application.
    """
    ELEXON_LIVE = "ELEXON_LIVE"
    CACHE = "CACHE"
    SYNTHETIC_DEMO = "SYNTHETIC_DEMO"
    UNAVAILABLE = "UNAVAILABLE"


class ForecastDataPoint(BaseModel):
    """
    Half-hour settlement period time-series record aligning actual wind generation
    with Day-Ahead and Intraday forecasts.
    """
    startTime: str = Field(..., description="Target delivery start timestamp in ISO UTC (e.g., 2026-01-15T14:30:00Z)")
    settlementDate: str = Field(..., description="Elexon settlement calendar date (YYYY-MM-DD)")
    settlementPeriod: int = Field(..., ge=1, le=50, description="Settlement Period identifier (1 to 48 standard, up to 50 for clock-change days)")
    isPeak: bool = Field(..., description="True if within GB Peak Hours (Settlement Periods 15 to 38, i.e., 07:00-19:00 UTC)")
    actualMw: float = Field(..., description="Actual wind outturn generation recorded in FUELHH (MW)")
    dayAheadForecastMw: Optional[float] = Field(None, description="Latest wind forecast published strictly prior to 11:00 UTC Day D-1 (MW). None if missing before deadline.")
    intradayForecastMw: Optional[float] = Field(None, description="Latest available intraday wind forecast prior to physical gate closure (T-1h) (MW). None if missing.")
    errorMw: Optional[float] = Field(None, description="Day-Ahead Forecast Error: Forecast - Actual (MW). Positive = Over-forecast; Negative = Under-forecast.")
    absErrorMw: Optional[float] = Field(None, description="Absolute forecast error |Forecast - Actual| (MW)")
    pctError: Optional[float] = Field(None, description="Percentage error relative to actual outturn (%)")
    confidenceLowerMw: Optional[float] = Field(None, description="Empirical 10th percentile lower uncertainty bound (MW)")
    confidenceUpperMw: Optional[float] = Field(None, description="Empirical 90th percentile upper uncertainty bound (MW)")
    isMissingForecast: bool = Field(False, description="True if Day-Ahead forecast was not published prior to cutoff")


class KPIMetrics(BaseModel):
    """
    Executive quantitative scorecard evaluating forecast performance against outturn
    across the entire evaluation window (January 2026).
    """
    maeMw: float = Field(..., description="Mean Absolute Error (MW) - Average magnitude of generation deviations")
    maePct: float = Field(..., description="Normalized Mean Absolute Error as a percentage of mean actual outturn (%)")
    rmseMw: float = Field(..., description="Root Mean Square Error (MW) - Quadratic penalty highlighting severe forecast drop-offs")
    meanBiasMw: float = Field(..., description="Mean Forecast Error / Bias (MW). Positive = systematic over-forecast; Negative = under-forecast")
    peakMaeMw: float = Field(..., description="Mean Absolute Error during high-value Peak Periods (SP 15-38, 07:00-19:00 UTC) in MW")
    offPeakMaeMw: float = Field(..., description="Mean Absolute Error during Off-Peak Periods (SP 1-14 and 39-48) in MW")
    peakOffPeakDeltaMw: float = Field(..., description="Delta between Peak and Off-Peak MAE (MW)")
    intradayMaeMw: float = Field(..., description="MAE of the latest Intraday forecast (MW) showing accuracy gain vs Day-Ahead")
    intradayAccuracyImprovementPct: float = Field(..., description="Percentage reduction in MAE from Day-Ahead to Intraday (%)")
    maxUnderforecastMw: float = Field(..., description="Worst single-period wind deficit where actual exceeded forecast (MW)")
    maxOverforecastMw: float = Field(..., description="Worst single-period wind shortfall where actual fell short of forecast (MW)")
    totalActualEnergyGWh: float = Field(..., description="Total actual wind energy delivered (GWh = sum(MW * 0.5h) / 1000)")
    totalDayAheadEnergyGWh: float = Field(..., description="Total Day-Ahead scheduled wind energy (GWh)")
    sampleCount: int = Field(..., description="Total number of evaluated half-hour settlement periods")
    validSampleCount: int = Field(..., description="Number of evaluated half-hours with valid non-missing Day-Ahead forecasts")
    coveragePct: float = Field(100.0, description="Percentage of intervals with eligible Day-Ahead forecast published before cutoff")


class HistogramBin(BaseModel):
    """Single bucket in the forecast error frequency distribution."""
    binStart: float
    binEnd: float
    binCenter: float
    count: int
    percentage: float


class ErrorDistribution(BaseModel):
    """
    Parametric and non-parametric error quantiles for tail-risk analysis.
    """
    p05: float = Field(..., description="5th percentile of error distribution (MW)")
    p10: float = Field(..., description="10th percentile of error distribution (MW)")
    p25: float = Field(..., description="25th percentile (1st quartile) (MW)")
    p50: float = Field(..., description="50th percentile / Median error (MW)")
    p75: float = Field(..., description="75th percentile (3rd quartile) (MW)")
    p90: float = Field(..., description="90th percentile of error distribution (MW) - Key risk buffer benchmark")
    p95: float = Field(..., description="95th percentile of error distribution (MW)")
    p99: float = Field(..., description="99th percentile extreme tail error (MW)")
    stdDevMw: float = Field(..., description="Sample standard deviation of errors (MW)")
    skewness: float = Field(..., description="Fisher-Pearson coefficient of skewness")
    kurtosis: float = Field(..., description="Excess kurtosis (fat tails relative to Gaussian)")
    histogram: List[HistogramBin] = Field(..., description="Frequency bins for plotting error distribution")


class DailyErrorMetric(BaseModel):
    """
    Aggregated daily scorecard for the calendar heatmap and volatility diagnostics.
    """
    date: str = Field(..., description="Calendar date (YYYY-MM-DD)")
    maeMw: float = Field(..., description="Daily Mean Absolute Error (MW)")
    rmseMw: float = Field(..., description="Daily Root Mean Square Error (MW)")
    meanBiasMw: float = Field(..., description="Daily Mean Bias (MW)")
    actualMWh: float = Field(..., description="Daily total wind generation outturn (MWh)")
    dayAheadMWh: float = Field(..., description="Daily Day-Ahead forecast generation (MWh)")
    volatilityIndex: float = Field(..., description="Normalized intraday ramp volatility score (0-100)")
    eventCategory: str = Field(..., description="Meteorological regime: e.g. 'Storm Depression', 'Anticyclonic Lull', 'Moderate Westerly', 'Normal'")


class SettlementPeriodProfile(BaseModel):
    """
    Diurnal profile aggregated across all 31 days of January for each of the 48 settlement periods.
    """
    settlementPeriod: int = Field(..., ge=1, le=50)
    timeUtc: str = Field(..., description="Half-hour time interval (e.g., '14:00 - 14:30 UTC')")
    isPeak: bool
    meanActualMw: float
    meanForecastMw: float
    maeMw: float
    rmseMw: float
    meanBiasMw: float


class DatasetMetadata(BaseModel):
    """
    Dataset provenance, coverage, and calibration metadata.
    """
    source: DataSourceType = Field(..., description="Original data provenance: ELEXON_LIVE, SYNTHETIC_DEMO, or UNAVAILABLE")
    isSynthetic: bool = Field(False, description="True if simulated demonstration data is active")
    isCached: bool = Field(False, description="True if loaded from persistent local cache storage")
    warning: Optional[str] = Field(None, description="Active warning or notice regarding data source")
    lastUpdatedAt: Optional[str] = Field(None, description="ISO UTC timestamp of last dataset refresh")
    cutoffRule: str = Field("11:00 UTC D-1 Day-Ahead Auction Deadline", description="Auction deadline policy applied")
    startDate: str
    endDate: str
    totalRecords: int
    validRecords: int
    coveragePct: float = Field(100.0, description="Percentage of intervals with eligible Day-Ahead forecast")
    empiricalCoverageP10P90Pct: Optional[float] = Field(None, description="Observed percentage of actuals falling within the empirical P10-P90 corridor")
    empiricalCoverageSampleCount: Optional[int] = Field(None, description="Number of valid intervals evaluated for corridor coverage")


class TimeSeriesResponse(BaseModel):
    """
    Full payload for time-series chart rendering with provenance and coverage metadata.
    """
    status: str = Field(..., description="Human-readable status label")
    source: DataSourceType = Field(DataSourceType.CACHE, description="Structured source classification")
    isSynthetic: bool = Field(False, description="Flag indicating synthetic demonstration data")
    isCached: bool = Field(False, description="Flag indicating data loaded from local cache")
    warning: Optional[str] = Field(None, description="Active warning message if synthetic or degraded")
    lastUpdatedAt: Optional[str] = Field(None, description="Timestamp of data generation or fetch")
    cutoffRule: str = Field(..., description="Gate closure policy applied (e.g., '11:00 UTC D-1')")
    startDate: str
    endDate: str
    totalRecords: int
    validRecords: int = Field(..., description="Number of periods with non-missing forecasts")
    coveragePct: float = Field(100.0, description="Forecast data coverage percentage")
    empiricalCoverageP10P90Pct: Optional[float] = Field(None, description="Corridor coverage score")
    empiricalCoverageSampleCount: Optional[int] = Field(None, description="Sample count evaluated for empirical coverage")
    data: List[ForecastDataPoint]


class CashoutSensitivityScenario(BaseModel):
    """
    Stress-testing scenario modeling financial cashout exposure across varying SBP price spikes.
    """
    systemBuyPriceGbp: float = Field(..., description="Hypothetical System Buy Price (£/MWh)")
    scenarioLabel: str = Field(..., description="Descriptive market stress regime")
    unbufferedCostGbp: float = Field(..., description="Expected cashout loss without risk buffer (£)")
    bufferedCostGbp: float = Field(..., description="Expected cost with P90 risk buffer (£)")
    netSavingsGbp: float = Field(..., description="Net financial savings (£)")
    varReductionPct: float = Field(..., description="Percentage reduction in Value-at-Risk (%)")


class ThermalProcurementRequest(BaseModel):
    """
    Trader input parameters for calculating optimal dispatchable thermal hedge
    under wind forecast uncertainty.
    """
    expectedDemandMw: float = Field(..., ge=1000.0, le=100000.0, description="Gross forecasted consumer electrical demand (MW)")
    windForecastMw: Optional[float] = Field(None, ge=0.0, description="Day-Ahead Wind Forecast for the target period (MW). If omitted, uses period mean.")
    targetDate: Optional[str] = Field(None, description="Optional specific calendar date (YYYY-MM-DD) for historical replay")
    settlementPeriod: Optional[int] = Field(None, ge=1, le=50, description="Specific target settlement period (1-48)")
    riskConfidenceLevel: float = Field(0.90, ge=0.50, le=0.99, description="Target risk coverage quantile (e.g., 0.90 for P90 buffer)")
    maxThermalCapacityMw: Optional[float] = Field(None, ge=0.0, description="Optional fleet maximum dispatchable thermal capacity constraint (MW)")
    ccgtMarginalCostGbp: Optional[float] = Field(78.50, ge=0.0, description="Combined Cycle Gas Turbine fuel + carbon marginal cost (£/MWh)")
    systemBuyPriceGbp: Optional[float] = Field(125.00, ge=0.0, description="Expected cashout penalty price if system is short (£/MWh)")
    systemSellPriceGbp: Optional[float] = Field(42.00, ge=0.0, description="Expected spill cashout price if system is long (£/MWh)")
    dayAheadPowerPriceGbp: Optional[float] = Field(85.00, ge=0.0, description="Wholesale Day-Ahead base market power price (£/MWh)")


class ThermalProcurementResponse(BaseModel):
    """
    Actionable procurement recommendation and financial risk hedge matrix
    delivered to the utility trading desk prior to 11:00 UTC D-1.
    """
    demandMw: float
    windForecastMw: float
    actualOutturnMw: Optional[float] = Field(None, description="Actual wind outturn recorded if a specific historical period was selected (MW)")
    selectedPeriodLabel: Optional[str] = Field(None, description="Descriptive label of the evaluated half-hour block")
    isHistoricalForecastAvailable: bool = Field(True, description="True if a genuine pre-cutoff forecast existed for the target interval")
    historicalDataQualityNotice: Optional[str] = Field(None, description="Notice if historical forecast was missing or estimated")
    baseResidualThermalMw: float = Field(..., description="Deterministic residual requirement: Demand - Wind Forecast (MW)")
    recommendedRiskBufferMw: float = Field(..., description="Theoretical risk buffer derived from empirical wind forecast tail error (MW)")
    effectiveRiskBufferMw: float = Field(..., description="Actual risk buffer delivered after thermal fleet capacity limits (MW)")
    recommendedTotalThermalMw: float = Field(..., description="Recommended Day-Ahead thermal procurement commitment (MW)")
    isCapacityConstrained: bool = Field(False, description="True if procurement was capped by maximum plant capacity")
    isCapacityBelowBaseResidual: bool = Field(False, description="True if available thermal capacity cannot even meet deterministic base residual")
    unconstrainedTotalThermalMw: Optional[float] = Field(None, description="Theoretical procurement before capacity capping (MW)")
    unservedBaseDeficitMw: float = Field(0.0, description="Unserved base deficit if capacity is below base residual (MW)")
    unbufferedDeficitRiskPct: float = Field(..., description="Probability of wind generation shortfall under naive 0-buffer strategy (%)")
    bufferedDeficitRiskPct: float = Field(..., description="Residual probability of under-procurement under capacity-constrained commitment (%)")
    expectedImbalanceCostUnbuffered: float = Field(..., description="Expected settlement period cashout loss under naive procurement (£)")
    expectedImbalanceCostBuffered: float = Field(..., description="Expected settlement period cashout cost with Gridbricks risk buffer (£)")
    netValueAddGbp: float = Field(..., description="Estimated net monetary savings per half-hour settlement period (£). Can be negative if buffer carry cost exceeds avoided cashout.")
    hedgingRationale: str = Field(..., description="Executive operational rationale and trading instructions for the desk")
    sensitivityScenarios: List[CashoutSensitivityScenario] = Field(default_factory=list, description="Stress-testing cashout sensitivity matrix (£100-£350/MWh)")

