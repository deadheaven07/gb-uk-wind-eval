import React from 'react';
import {
  TrendingUp,
  AlertTriangle,
  Activity,
  HelpCircle,
  Clock,
  Sparkles,
  ArrowRight
} from 'lucide-react';
import { KPIMetrics } from '../types';

interface MetricKpiCardsProps {
  kpis: KPIMetrics | null;
  isLoading: boolean;
}

export const MetricKpiCards: React.FC<MetricKpiCardsProps> = ({ kpis, isLoading }) => {
  if (isLoading || !kpis) {
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 animate-pulse">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white p-5 rounded-xl border border-slate-200 h-32" />
        ))}
      </div>
    );
  }

  const isOverforecast = kpis.meanBiasMw > 0;

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {/* 1. MAE Card */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition-all relative group">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <span>Mean Absolute Error (MAE)</span>
            <div className="relative group/tooltip">
              <HelpCircle className="h-3.5 w-3.5 text-slate-400 cursor-help" />
              <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover/tooltip:block w-56 p-2 bg-slate-900 text-white text-[11px] rounded shadow-lg z-20 pointer-events-none">
                The average expected magnitude of forecast error per settlement half-hour, normalized against fleet capacity.
              </div>
            </div>
          </div>
          <span className="p-1.5 rounded-md bg-blue-50 text-blue-700">
            <Activity className="h-4 w-4" />
          </span>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-2xl font-bold font-mono tracking-tight text-slate-900">
            {kpis.maeMw.toLocaleString()}
          </span>
          <span className="text-sm font-semibold text-slate-500">MW</span>
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
          <span className="font-medium text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
            {kpis.maePct}% of Outturn
          </span>
          <span className="text-slate-400">
            {kpis.validSampleCount ?? kpis.sampleCount} SPs {kpis.coveragePct ? `(${kpis.coveragePct}%)` : ''}
          </span>
        </div>
      </div>

      {/* 2. RMSE Card */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition-all relative group">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <span>Root Mean Square Error (RMSE)</span>
            <div className="relative group/tooltip">
              <HelpCircle className="h-3.5 w-3.5 text-slate-400 cursor-help" />
              <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover/tooltip:block w-64 p-2 bg-slate-900 text-white text-[11px] rounded shadow-lg z-20 pointer-events-none">
                Quadratic penalty on large forecast errors. Severe sudden wind drop-offs trigger peak grid imbalance cashout penalties.
              </div>
            </div>
          </div>
          <span className="p-1.5 rounded-md bg-purple-50 text-purple-700">
            <AlertTriangle className="h-4 w-4" />
          </span>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-2xl font-bold font-mono tracking-tight text-slate-900">
            {kpis.rmseMw.toLocaleString()}
          </span>
          <span className="text-sm font-semibold text-slate-500">MW</span>
        </div>
        <div className="mt-2 flex items-center justify-between text-xs">
          <span className="text-purple-700 bg-purple-50 px-2 py-0.5 rounded border border-purple-100 font-medium">
            +{(kpis.rmseMw - kpis.maeMw).toFixed(0)} MW tail penalty
          </span>
          <span className="text-slate-400">Penalizes Drop-offs</span>
        </div>
      </div>

      {/* 3. Mean Bias / MPE Card */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition-all relative group">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <span>Mean Bias (Over/Under)</span>
            <div className="relative group/tooltip">
              <HelpCircle className="h-3.5 w-3.5 text-slate-400 cursor-help" />
              <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover/tooltip:block w-64 p-2 bg-slate-900 text-white text-[11px] rounded shadow-lg z-20 pointer-events-none">
                Positive bias = systematic over-forecasting (desk under-procures thermal, risking cashout shortfalls). Negative = over-procures thermal.
              </div>
            </div>
          </div>
          <span className={`p-1.5 rounded-md ${isOverforecast ? 'bg-amber-50 text-amber-700' : 'bg-blue-50 text-blue-700'}`}>
            <TrendingUp className="h-4 w-4" />
          </span>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className={`text-2xl font-bold font-mono tracking-tight ${isOverforecast ? 'text-amber-700' : 'text-blue-700'}`}>
            {kpis.meanBiasMw > 0 ? `+${kpis.meanBiasMw}` : kpis.meanBiasMw}
          </span>
          <span className="text-sm font-semibold text-slate-500">MW</span>
        </div>
        <div className="mt-2 flex items-center justify-between text-xs">
          <span className={`px-2 py-0.5 rounded font-medium border ${
            isOverforecast
              ? 'bg-amber-50 text-amber-800 border-amber-200'
              : 'bg-emerald-50 text-emerald-800 border-emerald-200'
          }`}>
            {isOverforecast ? 'Over-forecasting (Short Risk)' : 'Under-forecasting (Long Spill)'}
          </span>
          <span className="text-slate-400">Systemic Skew</span>
        </div>
      </div>

      {/* 4. Peak vs Off-Peak Error Delta */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition-all relative group">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-500 uppercase tracking-wider">
            <span>Peak vs Off-Peak Delta</span>
            <div className="relative group/tooltip">
              <HelpCircle className="h-3.5 w-3.5 text-slate-400 cursor-help" />
              <div className="absolute left-1/2 -translate-x-1/2 bottom-full mb-2 hidden group-hover/tooltip:block w-64 p-2 bg-slate-900 text-white text-[11px] rounded shadow-lg z-20 pointer-events-none">
                Delta between Peak Periods (SP 15-38, 07:00-19:00 UTC) and Off-Peak. Peak errors carry 2.5x higher financial cashout risk.
              </div>
            </div>
          </div>
          <span className="p-1.5 rounded-md bg-indigo-50 text-indigo-700">
            <Clock className="h-4 w-4" />
          </span>
        </div>
        <div className="mt-3 flex items-baseline gap-2">
          <span className="text-2xl font-bold font-mono tracking-tight text-slate-900">
            {kpis.peakOffPeakDeltaMw > 0 ? `+${kpis.peakOffPeakDeltaMw}` : kpis.peakOffPeakDeltaMw}
          </span>
          <span className="text-sm font-semibold text-slate-500">MW</span>
        </div>
        <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
          <span className="text-slate-700 font-medium">
            Peak: <strong className="text-slate-900">{kpis.peakMaeMw} MW</strong>
          </span>
          <span className="text-slate-500">
            Off-Peak: {kpis.offPeakMaeMw} MW
          </span>
        </div>
      </div>
    </div>

    {/* Forecast Horizon Error Decay & Intraday Trading Value Strip */}
    <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-xs flex flex-col md:flex-row md:items-center md:justify-between gap-4">
      <div className="flex items-center gap-3">
        <div className="h-10 w-10 rounded-lg bg-teal-50 border border-teal-200 flex items-center justify-center text-teal-700 font-bold shrink-0">
          <Sparkles className="h-5 w-5" />
        </div>
        <div>
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-900">
              Forecast Horizon Error Decay
            </span>
            <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
              +{kpis.intradayAccuracyImprovementPct}% Error Reduction
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5 flex items-center gap-1.5 flex-wrap">
            <span>Assimilation of real-time Doppler radar & turbine SCADA compresses MAE:</span>
            <span className="font-mono font-bold text-amber-700 bg-amber-50 px-1.5 py-0.2 rounded border border-amber-200">{kpis.maeMw} MW (Day-Ahead)</span>
            <ArrowRight className="h-3 w-3 text-slate-400 inline" />
            <span className="font-mono font-bold text-teal-700 bg-teal-50 px-1.5 py-0.2 rounded border border-teal-200">{kpis.intradayMaeMw} MW (Intraday)</span>
          </p>
        </div>
      </div>

      <div className="flex items-center gap-4 text-xs font-mono shrink-0 border-t md:border-t-0 md:border-l border-slate-200 pt-2 md:pt-0 md:pl-4">
        <div>
          <span className="text-[10px] text-slate-400 font-sans block">Total Wind Outturn</span>
          <strong className="text-slate-900">{kpis.totalActualEnergyGWh.toLocaleString()} GWh</strong>
        </div>
        <div className="border-l border-slate-200 pl-4">
          <span className="text-[10px] text-slate-400 font-sans block">Worst Deficit Spike</span>
          <strong className="text-rose-700">+{kpis.maxOverforecastMw.toLocaleString()} MW</strong>
        </div>
      </div>
    </div>
  </div>
  );
};

