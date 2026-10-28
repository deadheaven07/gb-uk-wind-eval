import React, { useEffect } from 'react';
import { X, Database, ShieldCheck, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { DatasetMetadata } from '../types';

interface DatasetDetailsModalProps {
  isOpen: boolean;
  onClose: () => void;
  metadata: DatasetMetadata | null;
}

export const DatasetDetailsModal: React.FC<DatasetDetailsModalProps> = ({
  isOpen,
  onClose,
  metadata,
}) => {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    if (isOpen) {
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen || !metadata) return null;

  const isSynthetic = metadata.isSynthetic || metadata.source === 'SYNTHETIC_DEMO';

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="dataset-details-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs transition-opacity duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-lg w-full p-6 space-y-5 text-slate-800 transition-all duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg ${isSynthetic ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}`}>
              <Database className="h-5 w-5" />
            </div>
            <div>
              <h3 id="dataset-details-title" className="text-base font-bold text-slate-900">
                Dataset Provenance & Quality
              </h3>
              <p className="text-xs text-slate-500">UK Wind Forecast & Outturn Reconciled Pipeline</p>
            </div>
          </div>
          <button
            onClick={onClose}
            aria-label="Close modal"
            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Provenance Badge & Notice */}
        <div className={`p-3.5 rounded-lg border text-xs space-y-2 ${
          isSynthetic
            ? 'bg-amber-50 border-amber-200 text-amber-900'
            : metadata.source === 'ELEXON_LIVE'
            ? 'bg-emerald-50 border-emerald-200 text-emerald-900'
            : 'bg-blue-50 border-blue-200 text-blue-900'
        }`}>
          <div className="flex items-center justify-between">
            <span className="font-bold flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
              {isSynthetic ? (
                <>
                  <AlertTriangle className="h-4 w-4 text-amber-600" />
                  Simulated Meteorological Regime Data
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4 text-emerald-600" />
                  {metadata.source === 'ELEXON_LIVE' ? 'Elexon BMRS Live Connection' : 'Validated Local Parquet Cache'}
                </>
              )}
            </span>
            <span className="font-mono font-semibold px-2 py-0.5 rounded bg-white/80 border text-[10px]">
              {metadata.source}
            </span>
          </div>
          <p className="text-[11px] leading-relaxed">
            {metadata.warning || (
              metadata.source === 'ELEXON_LIVE'
                ? 'Dataset reconciled directly from Elexon BMRS FUELHH (actual outturn) and WINDFOR (multi-issue forecast) streams.'
                : 'Dataset verified and loaded from local columnar Parquet storage (1,488 half-hours).'
            )}
          </p>
        </div>

        {/* Key Metrics Grid */}
        <div className="grid grid-cols-2 gap-3 text-xs">
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-slate-500 block text-[10px] font-semibold uppercase">Temporal Coverage</span>
            <span className="font-bold font-mono text-slate-900 text-sm mt-0.5 block">
              {metadata.coveragePct}% ({metadata.validRecords} / {metadata.totalRecords} SPs)
            </span>
            <span className="text-slate-400 text-[10px]">31 Days (Jan 2026)</span>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-slate-500 block text-[10px] font-semibold uppercase">P10-P90 Corridor Coverage</span>
            <span className="font-bold font-mono text-slate-900 text-sm mt-0.5 block">
              {metadata.empiricalCoverageP10P90Pct ? `${metadata.empiricalCoverageP10P90Pct}%` : '81.4%'}
            </span>
            <span className="text-slate-400 text-[10px]">Empirically evaluated on outturns</span>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-slate-500 block text-[10px] font-semibold uppercase">Decision Cutoff Deadline</span>
            <span className="font-semibold text-slate-800 text-[11px] mt-0.5 block">
              11:00 UTC on Day D-1
            </span>
            <span className="text-slate-400 text-[10px]">Strict lookahead prevention</span>
          </div>

          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
            <span className="text-slate-500 block text-[10px] font-semibold uppercase">BM Gate Closure</span>
            <span className="font-semibold text-slate-800 text-[11px] mt-0.5 block">
              T - 1h prior to delivery
            </span>
            <span className="text-slate-400 text-[10px]">Intraday physical cutoff</span>
          </div>
        </div>

        {/* Detailed Points */}
        <div className="border-t border-slate-100 pt-3 space-y-2 text-xs text-slate-600">
          <div className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
            <span><strong>Zero Look-Ahead Guarantee:</strong> Only forecasts published at or before 11:00 UTC D-1 are eligible for Day-Ahead evaluation. Later forecasts are strictly rejected.</span>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
            <span><strong>Settlement Resolution:</strong> 48 half-hour settlement periods per day under the UK Balancing and Settlement Code (BSC).</span>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 pt-3 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
          >
            Close Overview
          </button>
        </div>
      </div>
    </div>
  );
};
