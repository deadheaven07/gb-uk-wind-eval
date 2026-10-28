/**
 * Type definitions for Gridbricks REint AI UK Wind Decision Intelligence
 */

export type DataSourceType = 'ELEXON_LIVE' | 'CACHE' | 'SYNTHETIC_DEMO' | 'UNAVAILABLE';

export interface ForecastDataPoint {
  startTime: string;
  settlementDate: string;
  settlementPeriod: number;
  isPeak: boolean;
  actualMw: number;
  dayAheadForecastMw?: number | null;
  intradayForecastMw?: number | null;
  errorMw?: number | null;
  absErrorMw?: number | null;
  pctError?: number | null;
  confidenceLowerMw?: number | null;
  confidenceUpperMw?: number | null;
  isMissingForecast?: boolean;
}

export interface KPIMetrics {
  maeMw: number;
  maePct: number;
  rmseMw: number;
  meanBiasMw: number;
  peakMaeMw: number;
  offPeakMaeMw: number;
  peakOffPeakDeltaMw: number;
  intradayMaeMw: number;
  intradayAccuracyImprovementPct: number;
  maxUnderforecastMw: number;
  maxOverforecastMw: number;
  totalActualEnergyGWh: number;
  totalDayAheadEnergyGWh: number;
  sampleCount: number;
  validSampleCount?: number;
  coveragePct?: number;
}

export interface HistogramBin {
  binStart: number;
  binEnd: number;
  binCenter: number;
  count: number;
  percentage: number;
}

export interface ErrorDistribution {
  p05: number;
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  p95: number;
  p99: number;
  stdDevMw: number;
  skewness: number;
  kurtosis: number;
  histogram: HistogramBin[];
}

export interface DailyErrorMetric {
  date: string;
  maeMw: number;
  rmseMw: number;
  meanBiasMw: number;
  actualMWh: number;
  dayAheadMWh: number;
  volatilityIndex: number;
  eventCategory: string;
}

export interface SettlementPeriodProfile {
  settlementPeriod: number;
  timeUtc: string;
  isPeak: boolean;
  meanActualMw: number;
  meanForecastMw: number;
  maeMw: number;
  rmseMw: number;
  meanBiasMw: number;
}

export interface DatasetMetadata {
  source: DataSourceType;
  isSynthetic: boolean;
  isCached?: boolean;
  warning?: string | null;
  lastUpdatedAt?: string | null;
  cutoffRule: string;
  startDate: string;
  endDate: string;
  totalRecords: number;
  validRecords: number;
  coveragePct: number;
  empiricalCoverageP10P90Pct?: number | null;
  empiricalCoverageSampleCount?: number | null;
}

export interface TimeSeriesResponse {
  status: string;
  source?: DataSourceType;
  isSynthetic?: boolean;
  isCached?: boolean;
  warning?: string | null;
  lastUpdatedAt?: string | null;
  cutoffRule: string;
  startDate: string;
  endDate: string;
  totalRecords: number;
  validRecords?: number;
  coveragePct?: number;
  empiricalCoverageP10P90Pct?: number | null;
  empiricalCoverageSampleCount?: number | null;
  data: ForecastDataPoint[];
}

export interface CashoutSensitivityScenario {
  systemBuyPriceGbp: number;
  scenarioLabel: string;
  unbufferedCostGbp: number;
  bufferedCostGbp: number;
  netSavingsGbp: number;
  varReductionPct: number;
}

export interface ThermalProcurementRequest {
  expectedDemandMw: number;
  windForecastMw?: number;
  targetDate?: string;
  settlementPeriod?: number;
  riskConfidenceLevel?: number;
  maxThermalCapacityMw?: number;
  ccgtMarginalCostGbp?: number;
  systemBuyPriceGbp?: number;
  systemSellPriceGbp?: number;
  dayAheadPowerPriceGbp?: number;
}

export interface ThermalProcurementResponse {
  demandMw: number;
  windForecastMw: number;
  actualOutturnMw?: number;
  selectedPeriodLabel?: string;
  isHistoricalForecastAvailable?: boolean;
  historicalDataQualityNotice?: string | null;
  baseResidualThermalMw: number;
  recommendedRiskBufferMw: number;
  effectiveRiskBufferMw?: number;
  recommendedTotalThermalMw: number;
  isCapacityConstrained?: boolean;
  isCapacityBelowBaseResidual?: boolean;
  unconstrainedTotalThermalMw?: number;
  unservedBaseDeficitMw?: number;
  unbufferedDeficitRiskPct: number;
  bufferedDeficitRiskPct: number;
  expectedImbalanceCostUnbuffered: number;
  expectedImbalanceCostBuffered: number;
  netValueAddGbp: number;
  hedgingRationale: string;
  sensitivityScenarios: CashoutSensitivityScenario[];
}
