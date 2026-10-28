import React, { useState, useEffect, useRef } from 'react';
import {
  Calculator,
  ShieldCheck,
  Sparkles,
  Flame,
  Layers,
  AlertCircle,
  Calendar,
  BarChart3,
  HelpCircle,
  ShieldAlert,
  AlertTriangle
} from 'lucide-react';
import { ThermalProcurementRequest, ThermalProcurementResponse } from '../types';
import { api } from '../api/client';
import { CalculatorAssumptionsModal } from './CalculatorAssumptionsModal';

interface ThermalCalculatorTabProps {
  defaultWindForecast?: number;
}

export const ThermalCalculatorTab: React.FC<ThermalCalculatorTabProps> = ({
  defaultWindForecast = 8500,
}) => {
  const [mode, setMode] = useState<'aggregate' | 'historical'>('aggregate');
  const [demandMw, setDemandMw] = useState<number>(34000);
  const [windMw, setWindMw] = useState<number>(defaultWindForecast);
  const [selectedDate, setSelectedDate] = useState<string>('2026-01-03');
  const [selectedSp, setSelectedSp] = useState<number>(35); // 17:00-17:30 UTC peak
  const [riskLevel, setRiskLevel] = useState<number>(0.90);
  const [maxCapacity, setMaxCapacity] = useState<number | undefined>(undefined);
  const [ccgtCost, setCcgtCost] = useState<number>(78.50);
  const [sbpCost, setSbpCost] = useState<number>(125.00);
  const [daPrice, setDaPrice] = useState<number>(85.00);

  const [result, setResult] = useState<ThermalProcurementResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);

  // Request sequencing ref to guarantee latest-request-wins
  const latestRequestId = useRef<number>(0);

  const runCalculation = async () => {
    const thisRequestId = ++latestRequestId.current;
    setIsLoading(true);
    setError(null);
    try {
      const payload: ThermalProcurementRequest = {
        expectedDemandMw: demandMw,
        windForecastMw: mode === 'aggregate' ? windMw : undefined,
        targetDate: mode === 'historical' ? selectedDate : undefined,
        settlementPeriod: mode === 'historical' ? selectedSp : undefined,
        riskConfidenceLevel: riskLevel,
        maxThermalCapacityMw: maxCapacity,
        ccgtMarginalCostGbp: ccgtCost,
        systemBuyPriceGbp: sbpCost,
        dayAheadPowerPriceGbp: daPrice,
      };
      const res = await api.calculateThermalProcurement(payload);
      // Strictly prevent out-of-order responses from overwriting latest inputs
      if (thisRequestId === latestRequestId.current) {
        setResult(res);
      }
    } catch (err: any) {
      if (thisRequestId === latestRequestId.current) {
        setError(err.message || 'Failed to calculate thermal procurement');
      }
    } finally {
      if (thisRequestId === latestRequestId.current) {
        setIsLoading(false);
      }
    }
  };

  useEffect(() => {
    runCalculation();
  }, [mode, demandMw, windMw, selectedDate, selectedSp, riskLevel, maxCapacity, ccgtCost, sbpCost, daPrice]);

  return (
    <>
      <div className="space-y-6">
        {/* Top Banner Context */}
        <div className="bg-gradient-to-r from-blue-900 to-indigo-900 rounded-xl p-5 text-white shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="p-1.5 rounded bg-blue-700/60 text-blue-200">
                <Calculator className="h-5 w-5" />
              </span>
              <h2 className="text-base font-bold tracking-tight">
                Day-Ahead Thermal Procurement &amp; Risk Buffer Engine
              </h2>
            </div>
            <p className="text-xs text-blue-200 mt-1 max-w-2xl">
              Solves the fundamental trading dilemma before 11:00 UTC D-1 Gate Closure: balance the carry cost of CCGT dispatch against asymmetric System Buy Price (SBP) cashout penalties.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsModalOpen(true)}
              className="flex items-center gap-1.5 text-xs bg-white/10 hover:bg-white/20 px-3 py-2 rounded-lg border border-white/20 transition-all cursor-pointer font-medium"
            >
              <HelpCircle className="h-4 w-4 text-blue-300" />
              <span>Trading Assumptions</span>
            </button>
            <div className="flex items-center gap-2 text-xs bg-white/10 px-3 py-2 rounded-lg border border-white/15">
              <ShieldCheck className="h-4 w-4 text-emerald-400" />
              <span>Calibrated against <strong>1,488 Jan 2026</strong> outturns</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Left Column: Input Parameters Card (5 Cols) */}
          <div className="lg:col-span-5 bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-5">
            <div className="border-b border-slate-100 pb-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Layers className="h-4 w-4 text-blue-600" />
                  1. Trading Desk Position Inputs
                </h3>
              </div>

              {/* Mode Switcher */}
              <div className="mt-3 flex rounded-lg border border-slate-200 p-0.5 bg-slate-50 text-xs">
                <button
                  type="button"
                  onClick={() => setMode('aggregate')}
                  className={`flex-1 py-1.5 rounded-md font-semibold transition-all cursor-pointer ${
                    mode === 'aggregate'
                      ? 'bg-white text-slate-900 shadow-xs font-bold'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Market Aggregate
                </button>
                <button
                  type="button"
                  onClick={() => setMode('historical')}
                  className={`flex-1 py-1.5 rounded-md font-semibold transition-all cursor-pointer ${
                    mode === 'historical'
                      ? 'bg-white text-blue-900 shadow-xs font-bold'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Historical Half-Hour Replay
                </button>
              </div>
            </div>

            <div className="space-y-4 text-xs">
              {/* Historical Replay Selectors if in historical mode */}
              {mode === 'historical' && (
                <div className="p-3 rounded-lg bg-blue-50/70 border border-blue-200 space-y-2.5">
                  <div className="flex items-center gap-1.5 text-blue-900 font-bold text-[11px] uppercase tracking-wider">
                    <Calendar className="h-3.5 w-3.5 text-blue-700" />
                    Select January 2026 Half-Hour
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="text-[10px] text-slate-600 block mb-1">Calendar Date</label>
                      <select
                        value={selectedDate}
                        onChange={(e) => setSelectedDate(e.target.value)}
                        className="w-full px-2 py-1.5 font-mono text-xs rounded border border-slate-300 bg-white"
                      >
                        {Array.from({ length: 31 }, (_, i) => {
                          const d = (i + 1).toString().padStart(2, '0');
                          return (
                            <option key={d} value={`2026-01-${d}`}>
                              2026-01-{d} {i < 7 ? '(Storm)' : i < 15 ? '(Lull)' : ''}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                    <div>
                      <label className="text-[10px] text-slate-600 block mb-1">Settlement Period (1-48)</label>
                      <select
                        value={selectedSp}
                        onChange={(e) => setSelectedSp(Number(e.target.value))}
                        className="w-full px-2 py-1.5 font-mono text-xs rounded border border-slate-300 bg-white"
                      >
                        {Array.from({ length: 48 }, (_, i) => {
                          const sp = i + 1;
                          const startM = (sp - 1) * 30;
                          const sh = Math.floor(startM / 60);
                          const sm = startM % 60;
                          const isPeak = sp >= 15 && sp <= 38;
                          return (
                            <option key={sp} value={sp}>
                              SP {sp} ({sh.toString().padStart(2, '0')}:{(sm).toString().padStart(2, '0')}) {isPeak ? '★ PEAK' : ''}
                            </option>
                          );
                        })}
                      </select>
                    </div>
                  </div>
                </div>
              )}

              {/* Demand Slider & Input */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-semibold text-slate-700 flex items-center gap-1">
                    Expected Consumer Demand
                    <span className="text-[10px] text-slate-400 font-normal">(GB Winter Peak)</span>
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="5000"
                      max="60000"
                      step="500"
                      value={demandMw}
                      onChange={(e) => setDemandMw(Math.max(0, Number(e.target.value)))}
                      className="w-24 px-2 py-1 text-right font-mono font-bold text-slate-900 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-blue-500"
                    />
                    <span className="text-slate-500 font-medium">MW</span>
                  </div>
                </div>
                <input
                  type="range"
                  min="15000"
                  max="55000"
                  step="500"
                  value={demandMw}
                  onChange={(e) => setDemandMw(Number(e.target.value))}
                  className="w-full accent-blue-600 cursor-pointer"
                />
              </div>

              {/* Day-Ahead Wind Forecast Input */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="font-semibold text-slate-700 flex items-center gap-1">
                    Day-Ahead Wind Forecast (11:00 D-1)
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      min="0"
                      max="25000"
                      step="250"
                      disabled={mode === 'historical'}
                      value={windMw}
                      onChange={(e) => setWindMw(Math.max(0, Number(e.target.value)))}
                      className={`w-24 px-2 py-1 text-right font-mono font-bold text-amber-700 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-amber-500 ${
                        mode === 'historical' ? 'bg-slate-100 cursor-not-allowed' : ''
                      }`}
                    />
                    <span className="text-slate-500 font-medium">MW</span>
                  </div>
                </div>
                {mode === 'aggregate' && (
                  <input
                    type="range"
                    min="500"
                    max="22000"
                    step="250"
                    value={windMw}
                    onChange={(e) => setWindMw(Number(e.target.value))}
                    className="w-full accent-amber-600 cursor-pointer"
                  />
                )}
              </div>

              {/* Risk Buffer Confidence Level */}
              <div>
                <label className="font-semibold text-slate-700 block mb-1.5">
                  Target Risk Coverage (Quantile Buffer)
                </label>
                <div className="grid grid-cols-4 gap-1.5">
                  {[
                    { label: 'P80 (80%)', val: 0.80 },
                    { label: 'P90 (90%)', val: 0.90 },
                    { label: 'P95 (95%)', val: 0.95 },
                    { label: 'P99 (99%)', val: 0.99 },
                  ].map((item) => (
                    <button
                      key={item.val}
                      type="button"
                      onClick={() => setRiskLevel(item.val)}
                      className={`py-1.5 rounded border text-xs font-semibold transition-all cursor-pointer ${
                        riskLevel === item.val
                          ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {item.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Fleet Capacity Limit */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-[11px] font-semibold text-slate-700">
                    Max Thermal Fleet Capacity Constraint (Optional)
                  </label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      placeholder="Unlimited"
                      value={maxCapacity !== undefined ? maxCapacity : ''}
                      onChange={(e) => setMaxCapacity(e.target.value ? Number(e.target.value) : undefined)}
                      className="w-24 px-2 py-1 text-right font-mono text-xs rounded border border-slate-300"
                    />
                    <span className="text-slate-500 text-[10px]">MW</span>
                  </div>
                </div>
              </div>

              {/* Market Prices Strip */}
              <div className="pt-3 border-t border-slate-100 space-y-3">
                <span className="font-bold text-slate-800 block text-[11px] uppercase tracking-wider">
                  Wholesale &amp; Balancing Market Price Benchmarks
                </span>

                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="text-[10px] text-slate-500 block">CCGT Cost (£/MWh)</label>
                    <input
                      type="number"
                      value={ccgtCost}
                      onChange={(e) => setCcgtCost(Number(e.target.value))}
                      className="w-full px-2 py-1 font-mono text-xs rounded border border-slate-300"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block">System Buy Price (£)</label>
                    <input
                      type="number"
                      value={sbpCost}
                      onChange={(e) => setSbpCost(Number(e.target.value))}
                      className="w-full px-2 py-1 font-mono text-xs rounded border border-rose-300 text-rose-800 font-bold"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] text-slate-500 block">Day-Ahead Price (£)</label>
                    <input
                      type="number"
                      value={daPrice}
                      onChange={(e) => setDaPrice(Number(e.target.value))}
                      className="w-full px-2 py-1 font-mono text-xs rounded border border-slate-300"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column: Recommended Procurement & Value Add (7 Cols) */}
          <div className="lg:col-span-7 space-y-5">
            {error && (
              <div className="p-3.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-rose-600 shrink-0" />
                <span>{error}</span>
              </div>
            )}

            {isLoading && !result && (
              <div className="bg-white p-8 rounded-xl border border-slate-200 shadow-xs flex items-center justify-center">
                <span className="text-xs text-slate-400">Recalculating optimal thermal commitment...</span>
              </div>
            )}

            {result && (
              <>
                {/* Primary Output Decision Card */}
                <div className="bg-white p-5 rounded-xl border border-blue-200 shadow-xs relative overflow-hidden transition-all duration-200 hover:shadow-sm">
                  <div className="absolute top-0 right-0 bg-blue-600 text-white text-[10px] uppercase font-bold tracking-wider px-3 py-1 rounded-bl-lg">
                    Procurement Target (0.5h Settlement)
                  </div>

                  <div className="flex items-center gap-2 mb-3">
                    <Flame className="h-5 w-5 text-amber-600" />
                    <div>
                      <h3 className="text-sm font-bold text-slate-900">
                        Optimal Dispatchable Thermal Commitment
                      </h3>
                      {result.selectedPeriodLabel && (
                        <p className="text-[11px] text-blue-700 font-mono font-medium mt-0.5">
                          Target Block: {result.selectedPeriodLabel}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* If historical outturn is available, show the replay callout */}
                  {result.actualOutturnMw !== null && result.actualOutturnMw !== undefined && (
                    <div className="mb-3 p-2.5 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-between text-xs font-mono">
                      <span className="text-slate-600 font-sans">Historical Actual Outturn:</span>
                      <strong className="text-blue-900 font-bold">{result.actualOutturnMw.toLocaleString()} MW</strong>
                      <span className="text-slate-600 font-sans border-l pl-3 border-slate-300">Outturn Delta:</span>
                      <strong className={result.windForecastMw - result.actualOutturnMw > 0 ? 'text-amber-700' : 'text-blue-700'}>
                        {result.windForecastMw - result.actualOutturnMw > 0 ? '+' : ''}
                        {(result.windForecastMw - result.actualOutturnMw).toFixed(1)} MW
                      </strong>
                    </div>
                  )}

                  {/* Historical Missing Pre-Cutoff Forecast Notice */}
                  {result.isHistoricalForecastAvailable === false && result.historicalDataQualityNotice && (
                    <div className="mb-3 p-2.5 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-start gap-2 font-medium">
                      <AlertTriangle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                      <div>
                        <strong>Forecast Provenance Notice:</strong> {result.historicalDataQualityNotice}
                      </div>
                    </div>
                  )}

                  {/* Critical Capacity Below Base Residual Warning */}
                  {result.isCapacityBelowBaseResidual && (
                    <div className="mb-3 p-2.5 rounded-lg bg-rose-50 border border-rose-300 text-rose-900 text-xs flex items-start gap-2 font-medium">
                      <AlertCircle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
                      <div>
                        <strong>Critical Fleet Capacity Deficit:</strong> Fleet capacity limit ({maxCapacity?.toLocaleString()} MW) is strictly below the deterministic base residual requirement ({result.baseResidualThermalMw.toLocaleString()} MW). An unserved deficit of {result.unservedBaseDeficitMw?.toLocaleString()} MW will be exposed directly to real-time cashout penalties.
                      </div>
                    </div>
                  )}

                  {/* Capacity Capping Alert */}
                  {result.isCapacityConstrained && !result.isCapacityBelowBaseResidual && (
                    <div className="mb-3 p-2 rounded-lg bg-amber-50 border border-amber-300 text-amber-900 text-xs flex items-center gap-2 font-medium">
                      <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0" />
                      <span>Capped at maximum fleet capacity ({maxCapacity?.toLocaleString()} MW). Unconstrained requirement was {result.unconstrainedTotalThermalMw?.toLocaleString()} MW. Delivered buffer is {result.effectiveRiskBufferMw?.toLocaleString()} MW.</span>
                    </div>
                  )}

                  {/* The Math Pipeline Visualization */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-slate-50 rounded-xl border border-slate-200">
                    {/* Step 1: Base Residual */}
                    <div className="p-2.5 bg-white rounded-lg border border-slate-200">
                      <span className="text-[10px] text-slate-500 uppercase font-semibold block">
                        Deterministic Residual
                      </span>
                      <div className="mt-1 flex items-baseline gap-1">
                        <span className="text-lg font-bold font-mono text-slate-900">
                          {result.baseResidualThermalMw.toLocaleString()}
                        </span>
                        <span className="text-xs text-slate-500">MW</span>
                      </div>
                      <span className="text-[10px] text-slate-400 block mt-0.5">Demand - Wind Fct</span>
                    </div>

                    {/* Step 2: Risk Buffer */}
                    <div className="p-2.5 bg-amber-50 rounded-lg border border-amber-200">
                      <span className="text-[10px] text-amber-800 uppercase font-bold block flex items-center gap-1">
                        <Sparkles className="h-3 w-3 text-amber-600" />
                        P{Math.round(riskLevel * 100)} Risk Buffer
                      </span>
                      <div className="mt-1 flex items-baseline gap-1">
                        <span className="text-lg font-bold font-mono text-amber-800">
                          +{result.recommendedRiskBufferMw.toLocaleString()}
                        </span>
                        <span className="text-xs text-amber-700">MW</span>
                      </div>
                      <span className="text-[10px] text-amber-600 block mt-0.5">Shortfall Tail Hedge</span>
                    </div>

                    {/* Step 3: Total Recommendation */}
                    <div className="p-2.5 bg-blue-50 rounded-lg border border-blue-300">
                      <span className="text-[10px] text-blue-900 uppercase font-bold block">
                        Total Thermal Order
                      </span>
                      <div className="mt-1 flex items-baseline gap-1">
                        <span className="text-xl font-bold font-mono text-blue-900">
                          {result.recommendedTotalThermalMw.toLocaleString()}
                        </span>
                        <span className="text-xs text-blue-800 font-bold">MW</span>
                      </div>
                      <span className="text-[10px] text-blue-700 block mt-0.5">
                        ={Math.round(result.recommendedTotalThermalMw * 0.5).toLocaleString()} MWh/period
                      </span>
                    </div>
                  </div>

                  {/* Risk Reduction & Financial Impact Strip */}
                  <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs border-t border-slate-100 pt-3">
                    <div>
                      <span className="text-slate-500 block text-[10px]">Unbuffered Deficit Risk:</span>
                      <span className="font-bold text-rose-700 text-sm">
                        {result.unbufferedDeficitRiskPct}%
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-500 block text-[10px]">Buffered Deficit Risk:</span>
                      <span className="font-bold text-emerald-700 text-sm">
                        {result.bufferedDeficitRiskPct}%
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-500 block text-[10px]">Expected Cashout Penalty:</span>
                      <span className="font-bold text-slate-800 text-sm">
                        £{result.expectedImbalanceCostBuffered.toLocaleString()}
                      </span>
                    </div>

                    <div>
                      <span className="text-slate-500 block text-[10px]">Net Risk-Adjusted Value:</span>
                      <span className={`font-bold text-sm ${result.netValueAddGbp >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                        {result.netValueAddGbp >= 0 ? '+' : ''}£{result.netValueAddGbp.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Operational Rationale Box */}
                  <div className="mt-4 p-3 bg-blue-50/60 rounded-lg border border-blue-100 text-xs text-blue-950 leading-relaxed font-sans">
                    <strong>Trading Rationale:</strong> {result.hedgingRationale}
                  </div>
                </div>

                {/* Stress Testing Sensitivity Matrix */}
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-slate-900 uppercase tracking-wider flex items-center gap-1.5">
                      <BarChart3 className="h-4 w-4 text-slate-600" />
                      Balancing Mechanism Stress-Testing Sensitivity Matrix
                    </h4>
                    <span className="text-[10px] text-slate-400">Half-Hour Settlement Period (£)</span>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 text-slate-600 font-semibold border-y border-slate-200">
                        <tr>
                          <th className="py-2 px-3">System Buy Price (SBP)</th>
                          <th className="py-2 px-3">Scenario Regime</th>
                          <th className="py-2 px-3 text-right">Naive 0-Buffer Cost</th>
                          <th className="py-2 px-3 text-right">With Gridbricks P90</th>
                          <th className="py-2 px-3 text-right">Net Savings (£)</th>
                          <th className="py-2 px-3 text-right">VaR Reduction</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {result.sensitivityScenarios.map((scen, idx) => (
                          <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                            <td className="py-2.5 px-3 font-mono font-bold text-slate-900">
                              £{scen.systemBuyPriceGbp.toFixed(0)}/MWh
                            </td>
                            <td className="py-2.5 px-3 font-medium text-slate-700">
                              {scen.scenarioLabel}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-rose-700">
                              £{scen.unbufferedCostGbp.toLocaleString()}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-slate-800 font-semibold">
                              £{scen.bufferedCostGbp.toLocaleString()}
                            </td>
                            <td className={`py-2.5 px-3 text-right font-mono font-bold ${scen.netSavingsGbp >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                              {scen.netSavingsGbp >= 0 ? '+' : ''}£{scen.netSavingsGbp.toLocaleString()}
                            </td>
                            <td className="py-2.5 px-3 text-right">
                              <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 font-bold border border-emerald-200 text-[11px]">
                                -{scen.varReductionPct}%
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Assumptions Modal */}
      <CalculatorAssumptionsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
      />
    </>
  );
};
