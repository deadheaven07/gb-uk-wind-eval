import React, { useState, useEffect } from 'react';
import {
  Header
} from './components/Header';
import { MetricKpiCards } from './components/MetricKpiCards';
import { MainChart } from './components/MainChart';
import { ErrorDistributionTab } from './components/ErrorDistributionTab';
import { DailyHeatmapTab } from './components/DailyHeatmapTab';
import { PeriodBreakdownTab } from './components/PeriodBreakdownTab';
import { ThermalCalculatorTab } from './components/ThermalCalculatorTab';
import {
  ForecastDataPoint,
  KPIMetrics,
  ErrorDistribution,
  DailyErrorMetric,
  SettlementPeriodProfile
} from './types';
import { api } from './api/client';
import {
  Calculator,
  BarChart2,
  Calendar,
  Clock,
  ShieldAlert
} from 'lucide-react';

export const App: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'calculator' | 'distribution' | 'heatmap' | 'profiles'>('calculator');
  const [timeseriesData, setTimeseriesData] = useState<ForecastDataPoint[]>([]);
  const [kpis, setKpis] = useState<KPIMetrics | null>(null);
  const [distribution, setDistribution] = useState<ErrorDistribution | null>(null);
  const [dailyHeatmap, setDailyHeatmap] = useState<DailyErrorMetric[]>([]);
  const [profiles, setProfiles] = useState<SettlementPeriodProfile[]>([]);

  const [status, setStatus] = useState<string>('Connected to Elexon BMRS');
  const [cutoffRule, setCutoffRule] = useState<string>('11:00 UTC D-1');
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const loadAllData = async (forceRefresh = false) => {
    try {
      if (forceRefresh) setIsRefreshing(true);
      else setIsLoading(true);
      setError(null);

      const [tsRes, kpiRes, distRes, heatRes, profRes] = await Promise.all([
        api.getTimeSeries({ forceRefresh }),
        api.getKPIs(),
        api.getErrorDistribution(25),
        api.getDailyHeatmap(),
        api.getSettlementProfiles(),
      ]);

      setTimeseriesData(tsRes.data);
      setStatus(tsRes.status);
      setCutoffRule(tsRes.cutoffRule);
      setKpis(kpiRes);
      setDistribution(distRes);
      setDailyHeatmap(heatRes);
      setProfiles(profRes);
    } catch (err: any) {
      console.error('Error fetching data from Gridbricks API:', err);
      setError(err.message || 'Unable to connect to backend service.');
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  };

  useEffect(() => {
    loadAllData();
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col font-sans">
      {/* Sticky App Header */}
      <Header
        status={status}
        cutoffRule={cutoffRule}
        isRefreshing={isRefreshing}
        onRefresh={() => loadAllData(true)}
      />

      {/* Main Analytical Dashboard Container */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-6">
        {/* Error notification banner if backend is unreachable */}
        {error && (
          <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center justify-between">
            <div className="flex items-center gap-2">
              <ShieldAlert className="h-4 w-4 text-rose-600" />
              <span><strong>Connection Notice:</strong> {error}</span>
            </div>
            <button
              onClick={() => loadAllData(true)}
              className="px-2.5 py-1 bg-white border border-rose-300 rounded font-semibold hover:bg-rose-100"
            >
              Retry Connection
            </button>
          </div>
        )}

        {/* Executive KPI Scorecard Cards */}
        <section aria-label="Executive KPI Metrics">
          <MetricKpiCards kpis={kpis} isLoading={isLoading} />
        </section>

        {/* Primary Interactive Time Series Chart */}
        <section aria-label="Wind Generation Time Series">
          <MainChart data={timeseriesData} isLoading={isLoading} />
        </section>

        {/* Analytical Navigation Tabs */}
        <section className="space-y-4">
          <div className="border-b border-slate-200">
            <nav className="flex space-x-6 text-xs" aria-label="Analytical Views">
              <button
                onClick={() => setActiveTab('calculator')}
                className={`py-3 px-1 border-b-2 font-semibold flex items-center gap-2 transition-colors ${
                  activeTab === 'calculator'
                    ? 'border-blue-600 text-blue-600 font-bold'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                <Calculator className="h-4 w-4" />
                <span>Trader Decision Tool (Thermal Procurement)</span>
                <span className="px-1.5 py-0.2 rounded bg-blue-100 text-blue-800 text-[10px] font-bold">
                  Live
                </span>
              </button>

              <button
                onClick={() => setActiveTab('distribution')}
                className={`py-3 px-1 border-b-2 font-semibold flex items-center gap-2 transition-colors ${
                  activeTab === 'distribution'
                    ? 'border-blue-600 text-blue-600 font-bold'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                <BarChart2 className="h-4 w-4" />
                <span>Error Distribution & Tail Risk (P10-P90)</span>
              </button>

              <button
                onClick={() => setActiveTab('heatmap')}
                className={`py-3 px-1 border-b-2 font-semibold flex items-center gap-2 transition-colors ${
                  activeTab === 'heatmap'
                    ? 'border-blue-600 text-blue-600 font-bold'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                <Calendar className="h-4 w-4" />
                <span>Daily Error Heatmap & Volatility</span>
              </button>

              <button
                onClick={() => setActiveTab('profiles')}
                className={`py-3 px-1 border-b-2 font-semibold flex items-center gap-2 transition-colors ${
                  activeTab === 'profiles'
                    ? 'border-blue-600 text-blue-600 font-bold'
                    : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300'
                }`}
              >
                <Clock className="h-4 w-4" />
                <span>Diurnal 48 Half-Hour Profiles</span>
              </button>
            </nav>
          </div>

          {/* Active Tab View */}
          <div className="pt-2">
            {activeTab === 'calculator' && (
              <ThermalCalculatorTab defaultWindForecast={kpis ? Math.round(kpis.totalDayAheadEnergyGWh * 1000 / 1488) : 8500} />
            )}
            {activeTab === 'distribution' && (
              <ErrorDistributionTab distribution={distribution} isLoading={isLoading} />
            )}
            {activeTab === 'heatmap' && (
              <DailyHeatmapTab dailyData={dailyHeatmap} isLoading={isLoading} />
            )}
            {activeTab === 'profiles' && (
              <PeriodBreakdownTab profiles={profiles} isLoading={isLoading} />
            )}
          </div>
        </section>
      </main>

      {/* Modern SaaS Footer */}
      <footer className="bg-white border-t border-slate-200 mt-12 py-6 text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-900 font-mono">Gridbricks REint AI</span>
            <span>&copy; 2026 UK Wholesale Energy Decision Platform.</span>
          </div>
          <div className="flex items-center gap-4 text-slate-400">
            <span>Data: Elexon BMRS (FUELHH &amp; WINDFOR)</span>
            <span>&bull;</span>
            <span>Gate Closure: 11:00 UTC D-1</span>
            <span>&bull;</span>
            <span>BSC Half-Hour Settlement (SPs 1-48)</span>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;

