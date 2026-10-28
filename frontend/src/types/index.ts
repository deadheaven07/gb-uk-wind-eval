/**
 * Type definitions for Gridbricks REint AI UK Wind Decision Intelligence
 */

export interface ForecastDataPoint {
  startTime: string;
  settlementDate: string;
  settlementPeriod: number;
  isPeak: boolean;
  actualMw: number;
  dayAheadForecastMw: number;
  intradayForecastMw: number;
  errorMw: number;
  absErrorMw: number;
  pctError: number;
  confidenceLowerMw: number;
  confidenceUpperMw: number;
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

export interface TimeSeriesResponse {
  status: string;
  cutoffRule: string;
  startDate: string;
  endDate: string;
  totalRecords: number;
  data: ForecastDataPoint[];
}

export interface ThermalProcurementRequest {
  expectedDemandMw: number;
  windForecastMw?: number;
  settlementPeriod?: number;
  riskConfidenceLevel?: number;
  ccgtMarginalCostGbp?: number;
  systemBuyPriceGbp?: number;
  systemSellPriceGbp?: number;
  dayAheadPowerPriceGbp?: number;
}

export interface ThermalProcurementResponse {
  demandMw: number;
  windForecastMw: number;
  baseResidualThermalMw: number;
  recommendedRiskBufferMw: number;
  recommendedTotalThermalMw: number;
  unbufferedDeficitRiskPct: number;
  bufferedDeficitRiskPct: number;
  expectedImbalanceCostUnbuffered: number;
  expectedImbalanceCostBuffered: number;
  netValueAddGbp: number;
  hedgingRationale: string;
}
