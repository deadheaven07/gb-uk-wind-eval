import React, { useState, useEffect } from 'react';
import {
  Calculator,
  ShieldCheck,
  TrendingDown,
  PoundSterling,
  AlertOctagon,
  Sparkles,
  ArrowRight,
  Flame,
  Wind,
  Layers,
  HelpCircle
} from 'lucide-react';
import { ThermalProcurementRequest, ThermalProcurementResponse } from '../types';
import { api } from '../api/client';

interface ThermalCalculatorTabProps {
  defaultWindForecast?: number;
}

export const ThermalCalculatorTab: React.FC<ThermalCalculatorTabProps> = ({
  defaultWindForecast = 8500,
}) => {
  const [demandMw, setDemandMw] = useState<number>(34000);
  const [windMw, setWindMw] = useState<number>(defaultWindForecast);
  const [riskLevel, setRiskLevel] = useState<number>(0.90);
  const [ccgtCost, setCcgtCost] = useState<number>(78.50);
  const [sbpCost, setSbpCost] = useState<number>(125.00);
  const [daPrice, setDaPrice] = useState<number>(85.00);

  const [result, setResult] = useState<ThermalProcurementResponse | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const runCalculation = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const payload: ThermalProcurementRequest = {
        expectedDemandMw: demandMw,
        windForecastMw: windMw,
        riskConfidenceLevel: riskLevel,
        ccgtMarginalCostGbp: ccgtCost,
        systemBuyPriceGbp: sbpCost,
        dayAheadPowerPriceGbp: daPrice,
      };
      const res = await api.calculateThermalProcurement(payload);
      setResult(res);
    } catch (err: any) {
      setError(err.message || 'Failed to calculate thermal procurement');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    runCalculation();
  }, [demandMw, windMw, riskLevel, ccgtCost, sbpCost, daPrice]);

  return (
    <div className="space-y-6">
      {/* Top Banner Context */}
      <div className="bg-gradient-to-r from-blue-900 to-indigo-900 rounded-xl p-5 text-white shadow-sm flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="p-1.5 rounded bg-blue-700/60 text-blue-200">
              <Calculator className="h-5 w-5" />
            </span>
            <h2 className="text-base font-bold tracking-tight">
              Day-Ahead Thermal Procurement & Risk Buffer Engine
            </h2>
          </div>
          <p className="text-xs text-blue-200 mt-1 max-w-2xl">
            Solves the fundamental trading dilemma before 11:00 UTC D-1 Gate Closure: balance the carry cost of CCGT dispatch against asymmetric System Buy Price (SBP) cashout penalties.
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs bg-white/10 px-3 py-2 rounded-lg border border-white/15">
          <ShieldCheck className="h-4 w-4 text-emerald-400" />
          <span>Calibrated against <strong>1,488 January 2026</strong> outturns</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Column: Input Parameters Card (5 Cols) */}
        <div className="lg:col-span-5 bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-5">
          <div className="border-b border-slate-100 pb-3">
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <Layers className="h-4 w-4 text-blue-600" />
              1. Trading Desk Position Inputs
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">Adjust demand forecast and market cost assumptions</p>
          </div>

          <div className="space-y-4 text-xs">
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
                    min="15000"
                    max="55000"
                    step="500"
                    value={demandMw}
                    onChange={(e) => setDemandMw(Number(e.target.value))}
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
                    min="500"
                    max="22000"
                    step="250"
                    value={windMw}
                    onChange={(e) => setWindMw(Number(e.target.value))}
                    className="w-24 px-2 py-1 text-right font-mono font-bold text-amber-700 rounded border border-slate-300 focus:outline-none focus:ring-1 focus:ring-amber-500"
                  />
                  <span className="text-slate-500 font-medium">MW</span>
                </div>
              </div>
              <input
                type="range"
                min="500"
                max="22000"
                step="250"
                value={windMw}
                onChange={(e) => setWindMw(Number(e.target.value))}
                className="w-full accent-amber-600 cursor-pointer"
              />
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
                    className={`py-1.5 rounded border text-xs font-semibold transition-all ${
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

            {/* Market Prices Strip */}
            <div className="pt-3 border-t border-slate-100 space-y-3">
              <span className="font-bold text-slate-800 block text-[11px] uppercase tracking-wider">
                Wholesale & Balancing Market Price Benchmarks
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
          {result && (
            <>
              {/* Primary Output Decision Card */}
              <div className="bg-white p-5 rounded-xl border border-blue-200 shadow-xs relative overflow-hidden">
                <div className="absolute top-0 right-0 bg-blue-600 text-white text-[10px] uppercase font-bold tracking-wider px-3 py-1 rounded-bl-lg">
                  Gate Closure Procurement Target
                </div>

                <div className="flex items-center gap-2 mb-4">
                  <Flame className="h-5 w-5 text-amber-600" />
                  <h3 className="text-sm font-bold text-slate-900">
                    Optimal Dispatchable Thermal Power Commitment
                  </h3>
                </div>

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
                      P{int(riskLevel * 100)} Risk Buffer
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
                      <span className="text-xs text-blue-700">MW</span>
                    </div>
                    <span className="text-[10px] text-blue-600 block mt-0.5">Day-Ahead Auction Bid</span>
                  </div>
                </div>

                {/* Financial Value Add Metric */}
                <div className="mt-4 grid grid-cols-2 gap-3 pt-3 border-t border-slate-100">
                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 font-bold">
                      <TrendingDown className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-semibold block">
                        Net Savings per Half-Hour
                      </span>
                      <span className="text-base font-bold font-mono text-emerald-700">
                        £{result.netValueAddGbp.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="h-9 w-9 rounded-lg bg-blue-50 border border-blue-200 flex items-center justify-center text-blue-700 font-bold">
                      <ShieldCheck className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-500 uppercase font-semibold block">
                        Shortfall Exposure
                      </span>
                      <span className="text-base font-bold font-mono text-blue-900">
                        {result.unbufferedDeficitRiskPct}% → <strong className="text-emerald-600">{result.bufferedDeficitRiskPct}%</strong>
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Trader Rationale Card */}
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200 text-xs text-slate-700 leading-relaxed">
                <span className="font-bold text-slate-900 block mb-1 flex items-center gap-1.5">
                  <AlertOctagon className="h-3.5 w-3.5 text-blue-600" />
                  Trading Desk Execution Rationale:
                </span>
                {result.hedgingRationale}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

function int(val: number): number {
  return Math.round(val);
}
