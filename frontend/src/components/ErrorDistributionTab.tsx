import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  ReferenceLine,
  Cell
} from 'recharts';
import { BarChart3, Info } from 'lucide-react';
import { ErrorDistribution } from '../types';

interface ErrorDistributionTabProps {
  distribution: ErrorDistribution | null;
  isLoading: boolean;
}

export const ErrorDistributionTab: React.FC<ErrorDistributionTabProps> = ({
  distribution,
  isLoading,
}) => {
  if (isLoading || !distribution) {
    return (
      <div className="bg-white p-6 rounded-xl border border-slate-200 h-96 flex items-center justify-center">
        <span className="text-slate-400 text-sm">Computing non-parametric error quantiles...</span>
      </div>
    );
  }

  const quantiles = [
    { label: 'P10 (Under-forecast)', value: distribution.p10, desc: '10% chance error < this', color: 'text-blue-700 bg-blue-50' },
    { label: 'P25 (Q1)', value: distribution.p25, desc: '25th percentile', color: 'text-slate-700 bg-slate-50' },
    { label: 'P50 (Median)', value: distribution.p50, desc: 'Central tendency', color: 'text-slate-900 bg-slate-100 font-bold' },
    { label: 'P75 (Q3)', value: distribution.p75, desc: '75th percentile', color: 'text-slate-700 bg-slate-50' },
    { label: 'P90 (Over-forecast Tail)', value: distribution.p90, desc: 'Key Risk Buffer Benchmark', color: 'text-amber-800 bg-amber-50 font-bold' },
    { label: 'P99 (Extreme Tail)', value: distribution.p99, desc: 'Worst 1% storm deviation', color: 'text-rose-800 bg-rose-50' },
  ];

  return (
    <div className="space-y-6">
      {/* Quantile Metric Strip */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {quantiles.map((q, idx) => (
          <div key={idx} className={`p-3.5 rounded-lg border border-slate-200 ${q.color}`}>
            <span className="text-[11px] font-semibold uppercase tracking-wider block opacity-75">
              {q.label}
            </span>
            <div className="mt-1 flex items-baseline gap-1">
              <span className="text-xl font-bold font-mono">
                {q.value > 0 ? `+${q.value}` : q.value}
              </span>
              <span className="text-xs font-medium">MW</span>
            </div>
            <span className="text-[10px] opacity-70 block mt-0.5">{q.desc}</span>
          </div>
        ))}
      </div>

      {/* Histogram Chart Card */}
      <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 pb-4 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
              <BarChart3 className="h-4 w-4 text-blue-600" />
              Day-Ahead Forecast Error Frequency Distribution (MW)
            </h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Error = Day-Ahead Forecast - Actual. Negative = Under-forecast (Blue); Positive = Over-forecast / Deficit Risk (Amber).
            </p>
          </div>
          <div className="flex items-center gap-4 text-xs font-mono">
            <span className="text-slate-600">Std Dev: <strong className="text-slate-900">{distribution.stdDevMw} MW</strong></span>
            <span className="text-slate-600">Skew: <strong className="text-slate-900">{distribution.skewness}</strong></span>
          </div>
        </div>

        <div className="h-80 w-full mt-4">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={distribution.histogram} margin={{ top: 10, right: 10, left: 10, bottom: 25 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />
              <XAxis
                dataKey="binCenter"
                stroke="#94A3B8"
                fontSize={11}
                tickFormatter={(v) => `${v > 0 ? '+' : ''}${v}`}
                unit=" MW"
              />
              <YAxis
                stroke="#94A3B8"
                fontSize={11}
                tickFormatter={(v) => `${v}%`}
                unit="%"
                width={50}
              />
              <Tooltip
                formatter={(value: any, _name: any, item: any) => [
                  `${value}% (${item.payload.count} settlement periods)`,
                  `Range: ${item.payload.binStart} to ${item.payload.binEnd} MW`
                ]}
                labelFormatter={(center) => `Bin Center: ${center} MW`}
                contentStyle={{ backgroundColor: '#FFFFFF', borderColor: '#CBD5E1', borderRadius: '8px', fontSize: '12px' }}
              />

              <ReferenceLine x={0} stroke="#475569" strokeWidth={1.5} label={{ value: "0 Error", fill: "#475569", fontSize: 10 }} />
              <ReferenceLine x={distribution.p90} stroke="#EA580C" strokeDasharray="4 2" label={{ value: `P90 (+${distribution.p90} MW)`, fill: "#EA580C", fontSize: 10, position: 'top' }} />

              <Bar dataKey="percentage" radius={[4, 4, 0, 0]}>
                {distribution.histogram.map((entry, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={entry.binCenter >= 0 ? '#EA580C' : '#2563EB'}
                    fillOpacity={0.85}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Statistical Insights Box */}
        <div className="mt-4 p-3.5 rounded-lg bg-amber-50/70 border border-amber-200/80 flex items-start gap-3 text-xs text-amber-900">
          <Info className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold">Trading Desk Risk Implication:</span>{' '}
            The empirical P90 tail stands at <strong className="font-mono font-semibold">+{distribution.p90} MW</strong>. When trading Day-Ahead, naively matching the deterministic wind forecast exposes the portfolio to a shortfall on 50% of periods. Allocating a dispatchable buffer sized to the P90 quantile ensures that 90% of down-forecast shocks are absorbed without paying punitive System Buy Price (SBP) penalties.
          </div>
        </div>
      </div>
    </div>
  );
};

