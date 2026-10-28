import React from 'react';
import { Calendar, CloudLightning, Wind, ThermometerSnowflake, Activity } from 'lucide-react';
import { DailyErrorMetric } from '../types';

interface DailyHeatmapTabProps {
  dailyData: DailyErrorMetric[];
  isLoading: boolean;
}

export const DailyHeatmapTab: React.FC<DailyHeatmapTabProps> = ({ dailyData, isLoading }) => {
  if (isLoading) {
    return (
      <div className="bg-white p-6 rounded-xl border border-slate-200 h-96 flex items-center justify-center">
        <span className="text-slate-400 text-sm">Aggregating January 2026 calendar volatility...</span>
      </div>
    );
  }

  // Get color intensity according to daily MAE
  const getMaeBgClass = (mae: number) => {
    if (mae < 450) return 'bg-emerald-50 border-emerald-200 text-emerald-950';
    if (mae < 700) return 'bg-blue-50 border-blue-200 text-blue-950';
    if (mae < 950) return 'bg-amber-50 border-amber-200 text-amber-950';
    return 'bg-rose-50 border-rose-300 text-rose-950';
  };

  const getEventBadge = (category: string) => {
    switch (category) {
      case 'Storm Depression':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 text-rose-800">
            <CloudLightning className="h-3 w-3 text-rose-600" />
            Storm
          </span>
        );
      case 'Dunkelflaute Lull':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-cyan-100 text-cyan-800">
            <ThermometerSnowflake className="h-3 w-3 text-cyan-600" />
            Lull
          </span>
        );
      case 'High Wind Ramp':
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-800">
            <Activity className="h-3 w-3 text-amber-600" />
            Ramp
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-700">
            <Wind className="h-3 w-3 text-slate-500" />
            Steady
          </span>
        );
    }
  };

  return (
    <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-slate-100">
        <div>
          <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
            <Calendar className="h-4 w-4 text-blue-600" />
            January 2026 Daily Error Heatmap & Volatility Breakdown
          </h3>
          <p className="text-xs text-slate-500 mt-0.5">
            Color-coded by Day-Ahead MAE. Identify high-volatility storm ramps vs low-wind Dunkelflaute periods.
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-xs">
          <span className="text-slate-400 font-medium">MAE scale:</span>
          <span className="flex items-center gap-1">
            <span className="h-3 w-3 rounded bg-emerald-100 border border-emerald-300" />
            <span className="text-slate-600">&lt;450 MW</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="h-3 w-3 rounded bg-blue-100 border border-blue-300" />
            <span className="text-slate-600">450-700</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="h-3 w-3 rounded bg-amber-100 border border-amber-300" />
            <span className="text-slate-600">700-950</span>
          </span>
          <span className="flex items-center gap-1">
            <span className="h-3 w-3 rounded bg-rose-100 border border-rose-300" />
            <span className="text-slate-600">&gt;950 MW</span>
          </span>
        </div>
      </div>

      {/* Calendar Grid (31 Days) */}
      <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2.5">
        {dailyData.map((day) => {
          const dayNum = parseInt(day.date.split('-')[2], 10);
          return (
            <div
              key={day.date}
              className={`p-3 rounded-lg border transition-all hover:scale-[1.02] shadow-xs flex flex-col justify-between h-32 ${getMaeBgClass(
                day.maeMw
              )}`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <span className="text-sm font-bold font-mono">Jan {dayNum}</span>
                  <span className="text-[10px] text-slate-500 block">48 SPs</span>
                </div>
                {getEventBadge(day.eventCategory)}
              </div>

              <div className="space-y-1 font-mono text-xs">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-500 font-sans">MAE:</span>
                  <strong className="font-bold">{day.maeMw} MW</strong>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-[10px] text-slate-500 font-sans">Bias:</span>
                  <span className={day.meanBiasMw > 0 ? 'text-amber-700' : 'text-blue-700'}>
                    {day.meanBiasMw > 0 ? `+${day.meanBiasMw}` : day.meanBiasMw} MW
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-slate-200/50 text-[10px] text-slate-600">
                  <span className="font-sans">Outturn:</span>
                  <span>{(day.actualMWh / 1000).toFixed(0)} GWh</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

