import React, { useEffect } from 'react';
import { X, Flame, ShieldAlert, BookOpen } from 'lucide-react';

interface CalculatorAssumptionsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const CalculatorAssumptionsModal: React.FC<CalculatorAssumptionsModalProps> = ({
  isOpen,
  onClose,
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

  if (!isOpen) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="calc-assumptions-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/50 backdrop-blur-xs transition-opacity duration-200"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-xl w-full p-6 space-y-5 text-slate-800 transition-all duration-200"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <div className="p-2 rounded-lg bg-blue-100 text-blue-800">
              <BookOpen className="h-5 w-5" />
            </div>
            <div>
              <h3 id="calc-assumptions-title" className="text-base font-bold text-slate-900">
                Thermal Procurement & Hedging Methodology
              </h3>
              <p className="text-xs text-slate-500">Mathematical Formulations & Market Settlement Rules</p>
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

        {/* Section 1: Power vs Energy Units */}
        <div className="space-y-2 text-xs">
          <h4 className="font-bold text-slate-900 flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
            <Flame className="h-4 w-4 text-amber-600" />
            1. Power (MW) to Energy (MWh) Conversion
          </h4>
          <p className="text-slate-600 leading-relaxed">
            Under the UK Balancing and Settlement Code (BSC), wholesale electricity is scheduled and settled in
            <strong> 30-minute settlement periods (half-hours)</strong>. A constant power output of 1 MW sustained
            for 30 minutes equates to:
          </p>
          <div className="p-2.5 bg-slate-50 rounded border border-slate-200 font-mono text-center text-slate-900 font-semibold">
            Energy (MWh) = Power (MW) × 0.5 hours
          </div>
          <p className="text-slate-500 text-[11px]">
            All financial cashout exposure is denominated in £/MWh and converted via this 0.5h multiplier.
          </p>
        </div>

        {/* Section 2: Deterministic Residual vs P90 Buffer */}
        <div className="space-y-2 text-xs border-t border-slate-100 pt-3">
          <h4 className="font-bold text-slate-900 flex items-center gap-1.5 uppercase tracking-wider text-[11px]">
            <ShieldAlert className="h-4 w-4 text-blue-600" />
            2. Procurement Formulations
          </h4>
          <div className="space-y-1.5 font-mono text-[11px]">
            <div className="p-2 bg-slate-50 rounded border border-slate-200">
              <strong>Base Residual Thermal:</strong> Residual = max(0, Consumer Demand - Wind Forecast)
            </div>
            <div className="p-2 bg-amber-50 rounded border border-amber-200 text-amber-900">
              <strong>Risk Buffer (P90):</strong> Buffer = Q_0.90(Empirical Shortfalls)
            </div>
            <div className="p-2 bg-blue-50 rounded border border-blue-200 text-blue-900">
              <strong>Total Thermal Commitment:</strong> Total = Base Residual + Risk Buffer
            </div>
          </div>
        </div>

        {/* Section 3: Cashout Asymmetry */}
        <div className="space-y-2 text-xs border-t border-slate-100 pt-3">
          <h4 className="font-bold text-slate-900 uppercase tracking-wider text-[11px]">
            3. The Cashout Asymmetry Dilemma
          </h4>
          <p className="text-slate-600 leading-relaxed text-[11px]">
            If a utility is short due to downward wind forecast error, National Grid ESO levies the <strong>System Buy Price (SBP)</strong>,
            which can spike beyond £150–£350/MWh during peak margins. Carrying dispatchable thermal power (CCGT at ~£78.50/MWh) incurs
            a modest carry spread (CCGT Cost - DayAhead Price), but eliminates catastrophic tail cashout penalties.
          </p>
        </div>

        {/* Footer */}
        <div className="border-t border-slate-100 pt-3 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-lg shadow-xs transition-colors"
          >
            Got it, thanks
          </button>
        </div>
      </div>
    </div>
  );
};
