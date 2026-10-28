/**
 * Type-safe HTTP Client for Gridbricks REint AI Backend
 */
import {
  TimeSeriesResponse,
  KPIMetrics,
  ErrorDistribution,
  DailyErrorMetric,
  SettlementPeriodProfile,
  ThermalProcurementRequest,
  ThermalProcurementResponse
} from '../types';

const API_BASE = import.meta.env.VITE_API_BASE_URL || '/api/v1';

async function fetchJson<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API Error ${response.status}: ${errorText || response.statusText}`);
  }

  return response.json();
}

export const api = {
  /**
   * Fetches the aligned time series dataset for January 2026.
   */
  getTimeSeries: async (params?: {
    startDate?: string;
    endDate?: string;
    peakOnly?: boolean;
    settlementPeriod?: number;
    forceRefresh?: boolean;
  }): Promise<TimeSeriesResponse> => {
    const query = new URLSearchParams();
    if (params?.startDate) query.append('startDate', params.startDate);
    if (params?.endDate) query.append('endDate', params.endDate);
    if (params?.peakOnly) query.append('peakOnly', 'true');
    if (params?.settlementPeriod) query.append('settlementPeriod', params.settlementPeriod.toString());
    if (params?.forceRefresh) query.append('forceRefresh', 'true');

    const qs = query.toString();
    return fetchJson<TimeSeriesResponse>(`/timeseries${qs ? `?${qs}` : ''}`);
  },

  /**
   * Fetches executive KPI metrics.
   */
  getKPIs: async (startDate?: string, endDate?: string): Promise<KPIMetrics> => {
    const query = new URLSearchParams();
    if (startDate) query.append('startDate', startDate);
    if (endDate) query.append('endDate', endDate);
    const qs = query.toString();
    return fetchJson<KPIMetrics>(`/kpi${qs ? `?${qs}` : ''}`);
  },

  /**
   * Fetches non-parametric error quantiles and histogram.
   */
  getErrorDistribution: async (numBins = 25, startDate?: string, endDate?: string): Promise<ErrorDistribution> => {
    const query = new URLSearchParams({ numBins: numBins.toString() });
    if (startDate) query.append('startDate', startDate);
    if (endDate) query.append('endDate', endDate);
    return fetchJson<ErrorDistribution>(`/error-distribution?${query.toString()}`);
  },

  /**
   * Fetches daily aggregated metrics for heatmap and volatility analysis.
   */
  getDailyHeatmap: async (): Promise<DailyErrorMetric[]> => {
    return fetchJson<DailyErrorMetric[]>('/daily-heatmap');
  },

  /**
   * Fetches diurnal 48 settlement period profiles.
   */
  getSettlementProfiles: async (): Promise<SettlementPeriodProfile[]> => {
    return fetchJson<SettlementPeriodProfile[]>('/settlement-profiles');
  },

  /**
   * Calculates optimal thermal procurement and risk safety buffer.
   */
  calculateThermalProcurement: async (
    request: ThermalProcurementRequest
  ): Promise<ThermalProcurementResponse> => {
    return fetchJson<ThermalProcurementResponse>('/thermal-procurement', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  },

  /**
   * Forces data refresh and cache invalidation.
   */
  refreshData: async (): Promise<{ message: string; status: string; records: number }> => {
    return fetchJson<{ message: string; status: string; records: number }>('/refresh-data', {
      method: 'POST',
    });
  },
};
