import React from 'react';
import { Wind, ShieldCheck, Clock, RefreshCw, Calendar, Zap } from 'lucide-react';

interface HeaderProps {
  status: string;
  cutoffRule: string;
  isRefreshing: boolean;
  onRefresh: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  status,
  cutoffRule,
  isRefreshing,
  onRefresh,
}) => {
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        {/* Brand & Market Identity */}
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-sm ring-2 ring-blue-100">
            <Wind className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-lg font-bold tracking-tight text-slate-900 font-sans">
                Gridbricks
              </span>
              <span className="text-xs px-2 py-0.5 rounded font-mono font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                REint AI
              </span>
              <span className="text-xs text-slate-400 font-medium">| UK Wholesale Power</span>
            </div>
            <p className="text-xs text-slate-500 font-medium mt-0.5">
              Day-Ahead Wind Forecast Accuracy & Residual Thermal Procurement Engine
            </p>
          </div>
        </div>

        {/* Status Indicators & Gate Closure Badge */}
        <div className="flex flex-wrap items-center gap-2.5 text-xs">
          {/* Elexon BMRS Connection Badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-emerald-50 text-emerald-800 border border-emerald-200 font-medium">
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
            </span>
            <span className="font-semibold">{status}</span>
          </div>

          {/* Gate Closure Cutoff Rule */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 font-medium" title="Under BSC rules, day-ahead auction bids close at 11:00 UTC D-1">
            <Clock className="h-3.5 w-3.5 text-amber-600" />
            <span>Gate Closure: <strong className="text-slate-900">{cutoffRule}</strong></span>
          </div>

          {/* Settlement Calendar Window */}
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 font-medium">
            <Calendar className="h-3.5 w-3.5 text-blue-600" />
            <span>Target: <strong className="text-slate-900">Jan 2026 (1,488 SPs)</strong></span>
          </div>

          {/* Refresh Action Button */}
          <button
            onClick={onRefresh}
            disabled={isRefreshing}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-medium shadow-xs transition-colors disabled:opacity-50"
            title="Re-synchronize with Elexon BMRS"
          >
            <RefreshCw className={`h-3.5 w-3.5 text-slate-600 ${isRefreshing ? 'animate-spin' : ''}`} />
            <span>{isRefreshing ? 'Syncing...' : 'Sync Data'}</span>
          </button>
        </div>
      </div>
    </header>
  );
};
