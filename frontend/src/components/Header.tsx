import React, { useState } from 'react';
import { Wind, Clock, RefreshCw, Calendar, Download, Info } from 'lucide-react';
import { api } from '../api/client';
import { DatasetMetadata } from '../types';
import { DatasetDetailsModal } from './DatasetDetailsModal';

interface HeaderProps {
  status: string;
  cutoffRule: string;
  metadata: DatasetMetadata | null;
  isRefreshing: boolean;
  onRefresh: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  status,
  cutoffRule,
  metadata,
  isRefreshing,
  onRefresh,
}) => {
  const [isModalOpen, setIsModalOpen] = useState(false);

  const handleExportCsv = () => {
    window.open(api.getExportCsvUrl(), '_blank');
  };

  const isSynthetic = metadata?.isSynthetic || metadata?.source === 'SYNTHETIC_DEMO';
  const isLive = metadata?.source === 'ELEXON_LIVE';

  return (
    <>
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3.5 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          {/* Brand & Market Identity */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-sm ring-2 ring-blue-100 transition-transform duration-200 hover:scale-105">
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
                Day-Ahead Wind Forecast Accuracy &amp; Residual Thermal Procurement Engine
              </p>
            </div>
          </div>

          {/* Status Indicators & Action Bar */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {/* Provenance Badge */}
            <button
              onClick={() => setIsModalOpen(true)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md border font-medium transition-all duration-150 hover:shadow-xs focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 cursor-pointer ${
                isSynthetic
                  ? 'bg-amber-50 text-amber-900 border-amber-300 hover:bg-amber-100'
                  : isLive
                  ? 'bg-emerald-50 text-emerald-800 border-emerald-200 hover:bg-emerald-100'
                  : 'bg-blue-50 text-blue-800 border-blue-200 hover:bg-blue-100'
              }`}
              title="Click to view full dataset provenance and quality metrics"
            >
              <span className="relative flex h-2 w-2">
                <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${
                  isSynthetic ? 'bg-amber-400' : isLive ? 'bg-emerald-400' : 'bg-blue-400'
                }`}></span>
                <span className={`relative inline-flex rounded-full h-2 w-2 ${
                  isSynthetic ? 'bg-amber-500' : isLive ? 'bg-emerald-500' : 'bg-blue-500'
                }`}></span>
              </span>
              <span className="font-semibold">{status}</span>
              <Info className="h-3.5 w-3.5 opacity-60 ml-0.5" />
            </button>

            {/* Gate Closure Cutoff Rule */}
            <div
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 font-medium"
              title="Under BSC and auction rules, Day-Ahead bids close strictly at 11:00 UTC D-1"
            >
              <Clock className="h-3.5 w-3.5 text-amber-600" />
              <span>Cutoff: <strong className="text-slate-900">{cutoffRule}</strong></span>
            </div>

            {/* Target Window */}
            <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-md bg-slate-100 text-slate-700 border border-slate-200 font-medium">
              <Calendar className="h-3.5 w-3.5 text-blue-600" />
              <span>Target: <strong className="text-slate-900">Jan 2026 (1,488 SPs)</strong></span>
            </div>

            {/* Refresh Action Button */}
            <button
              onClick={onRefresh}
              disabled={isRefreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 font-medium shadow-xs transition-all duration-150 active:scale-95 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 cursor-pointer"
              title="Re-synchronize with Elexon BMRS"
            >
              <RefreshCw className={`h-3.5 w-3.5 text-slate-600 ${isRefreshing ? 'animate-spin' : ''}`} />
              <span>{isRefreshing ? 'Syncing...' : 'Sync Data'}</span>
            </button>

            {/* Export CSV Button */}
            <button
              onClick={handleExportCsv}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 font-semibold shadow-xs transition-all duration-150 active:scale-95 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 cursor-pointer"
              title="Download full 1,488 half-hour reconciled dataset as CSV"
            >
              <Download className="h-3.5 w-3.5 text-blue-600" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>
      </header>

      {/* Dataset Details Modal */}
      <DatasetDetailsModal
        isOpen={isModalOpen}
        onClose={() => setIsModalOpen(false)}
        metadata={metadata}
      />
    </>
  );
};
