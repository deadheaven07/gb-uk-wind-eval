import React, { useState, useMemo } from 'react';
import {
  ResponsiveContainer,
  ComposedChart,
  Line,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  Brush,
  CartesianGrid,
  ReferenceLine
} from 'recharts';
import { Calendar, Eye, EyeOff, Sliders, Filter, Sparkles } from 'lucide-react';
import { ForecastDataPoint } from '../types';

interface MainChartProps {
  data: ForecastDataPoint[];
  isLoading: boolean;
}

export const MainChart: React.FC<MainChartProps> = ({ data, isLoading }) => {
  const [showIntraday, setShowIntraday] = useState(true);
  const [showConfidence, setShowConfidence] = useState(true);
  const [peakOnly, setPeakOnly] = useState(false);
  const [selectedRangePreset, setSelectedRangePreset] = useState<string>('all');

  // Filtered dataset based on UI controls
  const chartData = useMemo(() => {
    let filtered = [...data];

    // Range preset filtering
    if (selectedRangePreset === 'storm') {
      filtered = filtered.filter(d => d.settlementDate >= '2026-01-01' && d.settlementDate <= '2026-01-07');
    } else if (selectedRangePreset === 'dunkelflaute') {
      filtered = filtered.filter(d => d.settlementDate >= '2026-01-08' && d.settlementDate <= '2026-01-15');
    } else if (selectedRangePreset === 'frontal') {
      filtered = filtered.filter(d => d.settlementDate >= '2026-01-16' && d.settlementDate <= '2026-01-24');
    } else if (selectedRangePreset === 'westerly') {
      filtered = filtered.filter(d => d.settlementDate >= '2026-01-25' && d.settlementDate <= '2026-01-31');
    }

    if (peakOnly) {
      filtered = filtered.filter(d => d.isPeak);
    }

    return filtered;
  }, [data, selectedRangePreset, peakOnly]);

  // Formatter for X-axis timestamps
  const formatXAxis = (tickItem: string) => {
    try {
      const date = new Date(tickItem);
      return `${date.getDate()} Jan ${date.getUTCHours().toString().padStart(2, '0')}:${date.getUTCMinutes().toString().padStart(2, '0')}`;
    } catch {
      return tickItem;
    }
  };

  // Custom rich tooltip
  const CustomTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      const point: ForecastDataPoint = payload[0].payload;
      const actual = point.actualMw;
      const da = point.dayAheadForecastMw;
      const error = point.errorMw;
      const isShortfall = error > 0;

      return (
        <div className="bg-white/95 backdrop-blur-md p-3.5 rounded-lg shadow-xl border border-slate-200 text-xs w-72">
          <div className="flex items-center justify-between border-b border-slate-100 pb-2 mb-2">
            <div>
              <span className="font-semibold text-slate-800">{formatXAxis(point.startTime)}</span>
              <span className="text-slate-400 ml-1">UTC</span>
            </div>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
              point.isPeak ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'
            }`}>
              {point.isPeak ? 'PEAK (SP ' + point.settlementPeriod + ')' : 'OFF-PEAK (SP ' + point.settlementPeriod + ')'}
            </span>
          </div>

          <div className="space-y-1.5 font-mono">
            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-slate-600 font-sans">
                <span className="h-2.5 w-2.5 rounded-full bg-blue-700 inline-block" />
                Actual Outturn:
              </span>
              <strong className="text-blue-900 font-bold">{actual.toLocaleString()} MW</strong>
            </div>

            <div className="flex items-center justify-between">
              <span className="flex items-center gap-1.5 text-slate-600 font-sans">
                <span className="h-2.5 w-2.5 rounded-full bg-amber-600 inline-block" />
                Day-Ahead (11:00 D-1):
              </span>
              <strong className="text-amber-800 font-bold">{da.toLocaleString()} MW</strong>
            </div>

            {showIntraday && (
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1.5 text-slate-600 font-sans">
                  <span className="h-2.5 w-2.5 rounded-full bg-teal-600 inline-block" />
                  Latest Intraday:
                </span>
                <strong className="text-teal-800 font-bold">{point.intradayForecastMw.toLocaleString()} MW</strong>
              </div>
            )}

            <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
              <span className="text-slate-500 font-sans">Day-Ahead Error:</span>
              <span className={`font-bold ${isShortfall ? 'text-amber-700' : 'text-blue-700'}`}>
                {error > 0 ? `+${error.toFixed(0)} MW (Over)` : `${error.toFixed(0)} MW (Under)`}
              </span>
            </div>
          </div>
        </div>
      );
    }
    return null;
  };

  if (isLoading) {
    return (
      <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-xs h-[480px] flex items-center justify-center">
        <div className="flex flex-col items-center gap-2 text-slate-400">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
          <span className="text-sm font-medium">Reconciling half-hourly wind generation outturns...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs">
      {/* Chart Header & Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4 pb-4 border-b border-slate-100">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-base font-bold text-slate-900">
              Wind Generation: Actual Outturn vs. Day-Ahead Gate Closure Forecast
            </h2>
            <span className="text-[11px] font-mono px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-medium border border-slate-200">
              {chartData.length} Half-Hours
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-0.5">
            Compare wholesale delivery with the latest forecast available prior to 11:00 UTC D-1 Gate Closure. Use brush to zoom.
          </p>
        </div>

        {/* Presets & Toggles */}
        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Regime Presets */}
          <div className="inline-flex rounded-lg border border-slate-200 p-0.5 bg-slate-50">
            <button
              onClick={() => setSelectedRangePreset('all')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                selectedRangePreset === 'all'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Full Jan
            </button>
            <button
              onClick={() => setSelectedRangePreset('storm')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                selectedRangePreset === 'storm'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Jan 1-7: Storm Gorey / Henk event"
            >
              Storm (1-7)
            </button>
            <button
              onClick={() => setSelectedRangePreset('dunkelflaute')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                selectedRangePreset === 'dunkelflaute'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Jan 8-15: Scandinavian Anticyclone / Dunkelflaute Lull"
            >
              Lull (8-15)
            </button>
            <button
              onClick={() => setSelectedRangePreset('frontal')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                selectedRangePreset === 'frontal'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Jan 16-24: Fast Frontal Transitions"
            >
              Fronts (16-24)
            </button>
            <button
              onClick={() => setSelectedRangePreset('westerly')}
              className={`px-2.5 py-1 rounded-md font-medium transition-colors ${
                selectedRangePreset === 'westerly'
                  ? 'bg-white text-slate-900 shadow-xs font-semibold'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
              title="Jan 25-31: Westerly Flow"
            >
              Westerly (25-31)
            </button>
          </div>

          {/* Visibility Toggles */}
          <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
            <button
              onClick={() => setShowIntraday(!showIntraday)}
              className={`px-2 py-1 rounded border flex items-center gap-1 font-medium ${
                showIntraday
                  ? 'bg-teal-50 text-teal-800 border-teal-200'
                  : 'bg-white text-slate-500 border-slate-200'
              }`}
            >
              <span className="h-2 w-2 rounded-full bg-teal-600" />
              Intraday
            </button>

            <button
              onClick={() => setShowConfidence(!showConfidence)}
              className={`px-2 py-1 rounded border flex items-center gap-1 font-medium ${
                showConfidence
                  ? 'bg-blue-50 text-blue-800 border-blue-200'
                  : 'bg-white text-slate-500 border-slate-200'
              }`}
            >
              <span className="h-2 w-2 rounded-full bg-blue-400" />
              P10-P90 Corridor
            </button>

            <button
              onClick={() => setPeakOnly(!peakOnly)}
              className={`px-2 py-1 rounded border flex items-center gap-1 font-medium ${
                peakOnly
                  ? 'bg-amber-50 text-amber-900 border-amber-300 font-semibold'
                  : 'bg-white text-slate-600 border-slate-200'
              }`}
              title="Filter to Peak Settlement Periods 15-38 (07:00-19:00 UTC)"
            >
              <Filter className="h-3 w-3" />
              Peak Only
            </button>
          </div>
        </div>
      </div>

      {/* Main Interactive Chart */}
      <div className="h-[420px] w-full mt-4">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F1F5F9" />

            <XAxis
              dataKey="startTime"
              tickFormatter={formatXAxis}
              stroke="#94A3B8"
              fontSize={11}
              minTickGap={40}
              tickLine={false}
            />

            <YAxis
              stroke="#94A3B8"
              fontSize={11}
              tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`}
              unit=" MW"
              width={65}
              tickLine={false}
              domain={[0, 'auto']}
            />

            <Tooltip content={<CustomTooltip />} />

            <Legend
              verticalAlign="top"
              align="right"
              iconType="circle"
              wrapperStyle={{ fontSize: '11px', paddingBottom: '10px' }}
            />

            {/* Confidence Corridor (Translucent Error Band) */}
            {showConfidence && (
              <Area
                type="monotone"
                dataKey="confidenceUpperMw"
                stroke="none"
                fill="rgba(59, 130, 246, 0.10)"
                name="P10-P90 Uncertainty Corridor"
              />
            )}

            {/* Actual Outturn (Solid Navy Line) */}
            <Line
              type="monotone"
              dataKey="actualMw"
              name="Actual Outturn (FUELHH)"
              stroke="#1E40AF"
              strokeWidth={2.2}
              dot={false}
              isAnimationActive={false}
            />

            {/* Day-Ahead Gate Closure Forecast (Warm Amber) */}
            <Line
              type="monotone"
              dataKey="dayAheadForecastMw"
              name="Day-Ahead Forecast (11:00 D-1)"
              stroke="#EA580C"
              strokeWidth={2}
              strokeDasharray="4 2"
              dot={false}
              isAnimationActive={false}
            />

            {/* Latest Intraday Forecast (Muted Teal) */}
            {showIntraday && (
              <Line
                type="monotone"
                dataKey="intradayForecastMw"
                name="Latest Intraday Forecast"
                stroke="#0D9488"
                strokeWidth={1.5}
                dot={false}
                isAnimationActive={false}
              />
            )}

            {/* Interactive Brush Zoom Slider */}
            <Brush
              dataKey="startTime"
              height={30}
              stroke="#94A3B8"
              fill="#F8FAFC"
              tickFormatter={formatXAxis}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
