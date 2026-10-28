import React from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  ReferenceArea
} from 'recharts';
import { Clock, SunMedium, Moon } from 'lucide-react';
import { SettlementPeriodProfile } from '../types';

interface PeriodBreakdownTabProps {
  profiles: SettlementPeriodProfile[];
  isLoading: boolean;
}

export const PeriodBreakdownTab: React.FC<PeriodBreakdownTabProps> = ({
  profiles,
  isLoading,
}) => {
  if (isLoading || !profiles.length) {
    return (
      <div className="bg-white p-6 rounded-xl border border-slate-200 h-96 flex items-center justify-center">
        <span className="text-slate-400 text-sm">Aggregating diurnal 48 settlement period profiles...</span>
      </div>
    );
  }

  return (
    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Clock className="h-4 w-4 text-blue-600" />
            Diurnal 48 Half-Hour Settlement Period Breakdown (January 2026 Average)
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Shaded region highlights GB Peak Hours (Settlement Periods 15 to 38, 07:00 - 19:00 UTC) when wholesale power prices and cashout penalties peak.
          </p>
        </div>

        <div className="flex items-center gap-3 text-xs">
          <span className="flex items-center gap-1.5 px-2 py-1 rounded bg-amber-50 text-amber-900 border border-amber-200 font-medium">
            <SunMedium className="h-3.5 w-3.5 text-amber-600" />
            Peak: SP 15-38 (07:00-19:00)
          </span>
          <span className="flex items-center gap-1.5 px-2 py-1 rounded bg-slate-100 text-slate-700 border border-slate-200 font-medium">
            <Moon className="h-3.5 w-3.5 text-slate-500" />
            Off-Peak: SP 1-14, 39-48
          </span>
        </div>
      </div>

      <div className="h-96 w-full mt-4">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={profiles} margin={{ top: 10, right: 10, left: 10, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />

            {/* Reference Area for Peak Hours */}
            <ReferenceArea
              x1={15}
              x2={38}
              fill="#FEF3C7"
              fillOpacity={0.35}
              label={{ value: "Peak Demand (SP 15-38)", position: "top", fill: "#B45309", fontSize: 11 }}
            />

            <XAxis
              dataKey="settlementPeriod"
              stroke="#94A3B8"
              fontSize={11}
              tickLine={false}
              label={{ value: "Settlement Period (1-48)", position: "insideBottom", offset: -12, fontSize: 11, fill: "#64748B" }}
            />

            <YAxis
              yAxisId="left"
              stroke="#94A3B8"
              fontSize={11}
              tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
              unit=" MW"
              width={60}
              tickLine={false}
            />

            <YAxis
              yAxisId="right"
              orientation="right"
              stroke="#EA580C"
              fontSize={11}
              unit=" MW"
              width={55}
              tickLine={false}
            />

            <Tooltip
              content={({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  const p = payload[0].payload as SettlementPeriodProfile;
                  return (
                    <div className="bg-white p-3 rounded-lg shadow-lg border border-slate-200 text-xs w-60">
                      <div className="font-bold text-slate-900 border-b pb-1 mb-1.5 flex justify-between">
                        <span>Period {p.settlementPeriod}</span>
                        <span className="text-slate-500">{p.timeUtc}</span>
                      </div>
                      <div className="space-y-1 font-mono">
                        <div className="flex justify-between text-blue-900">
                          <span className="font-sans">Avg Actual:</span>
                          <strong>{p.meanActualMw.toLocaleString()} MW</strong>
                        </div>
                        <div className="flex justify-between text-amber-800">
                          <span className="font-sans">Avg Day-Ahead:</span>
                          <strong>{p.meanForecastMw.toLocaleString()} MW</strong>
                        </div>
                        <div className="flex justify-between text-slate-700 pt-1 border-t">
                          <span className="font-sans">MAE:</span>
                          <strong>{p.maeMw} MW</strong>
                        </div>
                        <div className="flex justify-between text-slate-600">
                          <span className="font-sans">Bias:</span>
                          <span className={p.meanBiasMw > 0 ? 'text-amber-700' : 'text-blue-700'}>
                            {p.meanBiasMw > 0 ? `+${p.meanBiasMw}` : p.meanBiasMw} MW
                          </span>
                        </div>
                      </div>
                    </div>
                  );
                }
                return null;
              }}
            />

            <Legend verticalAlign="top" align="right" wrapperStyle={{ fontSize: '11px', paddingBottom: '10px' }} />

            <Bar
              yAxisId="right"
              dataKey="maeMw"
              name="Mean Absolute Error (MW)"
              fill="#FDBA74"
              opacity={0.7}
              radius={[3, 3, 0, 0]}
            />

            <Line
              yAxisId="left"
              type="monotone"
              dataKey="meanActualMw"
              name="Mean Actual (MW)"
              stroke="#1E40AF"
              strokeWidth={2.2}
              dot={{ r: 2 }}
            />

            <Line
              yAxisId="left"
              type="monotone"
              dataKey="meanForecastMw"
              name="Mean Day-Ahead Forecast (MW)"
              stroke="#EA580C"
              strokeWidth={2}
              strokeDasharray="4 2"
              dot={{ r: 2 }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
