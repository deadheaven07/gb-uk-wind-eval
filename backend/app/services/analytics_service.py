"""
Gridbricks / REint AI - Quantitative Analytics & Risk Engine
============================================================

This module provides vectorized financial and quantitative metrics for the UK Day-Ahead
wholesale electricity market.

Mathematical & Physical Logic:
-----------------------------
1. 30-Minute Settlement Periods (Half-Hours):
   Under the UK Balancing and Settlement Code (BSC), physical power is scheduled,
   metered, and financially settled across 48 half-hour periods per day (SP 1-48).
   Peak hours (SP 15-38, 07:00-19:00 UTC) represent periods of high industrial demand,
   elevated Day-Ahead wholesale power prices, and tighter system margins.

2. Error Formulations:
   - Error (MW) = Forecast - Actual (positive indicates over-forecast / long risk).
   - MAE (Mean Absolute Error): First-order metric of operational forecast uncertainty.
   - RMSE (Root Mean Square Error): Second-order quadratic penalty. Severe wind drops
     inflict non-linear stress on transmission system operator (National Grid ESO) reserves,
     triggering acute System Buy Price (SBP) cashout penalties.
   - Mean Bias (MW): Indicates systematic over-forecasting (systemic under-procurement
     of thermal generation, leaving the trading desk short) or systematic under-forecasting
     (burning expensive gas, incurring unnecessary start-up costs and fuel waste).

3. Risk-Buffered Residual Thermal Procurement:
   - Base Residual = Consumer Demand - Wind Forecast.
   - Without risk buffering, any downward wind surprise leaves the portfolio short,
     incurring punitive cashout penalties (SBP often exceeding £120-£300/MWh during winter peaks).
   - The P90 risk buffer calculates the 90th percentile of empirical wind down-forecast errors,
     providing a robust hedge that reduces unhedged shortfall frequency from ~50% to <10%.

Author: Staff Energy Software Engineer
"""

import logging
from typing import List, Dict, Any, Optional
import numpy as np
import pandas as pd

from app.core.config import settings
from app.schemas.forecast import (
    KPIMetrics,
    ErrorDistribution,
    HistogramBin,
    DailyErrorMetric,
    SettlementPeriodProfile,
    ThermalProcurementRequest,
    ThermalProcurementResponse
)

logger = logging.getLogger("gridbricks.analytics")
logger.setLevel(logging.INFO)


class AnalyticsService:
    """
    Vectorized analytics engine for evaluating wind forecast accuracy and generating
    day-ahead dispatchable thermal procurement hedging strategies.
    """

    @staticmethod
    def calculate_kpis(df: pd.DataFrame) -> KPIMetrics:
        """
        Computes summary KPIs across the aligned DataFrame.
        """
        n = len(df)
        if n == 0:
            raise ValueError("Cannot calculate KPIs on empty dataset.")

        actual = df["actualMw"].to_numpy()
        da_fct = df["dayAheadForecastMw"].to_numpy()
        id_fct = df["intradayForecastMw"].to_numpy()
        errors = da_fct - actual
        abs_errors = np.abs(errors)

        # MAE and RMSE
        mae_mw = float(np.mean(abs_errors))
        mean_actual = float(np.mean(actual))
        mae_pct = float((mae_mw / mean_actual * 100.0) if mean_actual > 0 else 0.0)
        rmse_mw = float(np.sqrt(np.mean(errors ** 2)))
        mean_bias_mw = float(np.mean(errors))

        # Peak vs Off-Peak separation
        peak_mask = df["isPeak"].to_numpy(dtype=bool)
        if np.any(peak_mask):
            peak_mae_mw = float(np.mean(abs_errors[peak_mask]))
        else:
            peak_mae_mw = mae_mw

        off_peak_mask = ~peak_mask
        if np.any(off_peak_mask):
            off_peak_mae_mw = float(np.mean(abs_errors[off_peak_mask]))
        else:
            off_peak_mae_mw = mae_mw

        peak_delta_mw = peak_mae_mw - off_peak_mae_mw

        # Intraday improvements
        id_errors = np.abs(id_fct - actual)
        id_mae_mw = float(np.mean(id_errors))
        id_improvement_pct = float(
            ((mae_mw - id_mae_mw) / mae_mw * 100.0) if mae_mw > 0 else 0.0
        )

        # Extreme values
        # Under-forecast: where actual > forecast, i.e., error < 0
        under_errors = actual - da_fct
        max_underforecast = float(np.max(under_errors)) if len(under_errors) > 0 else 0.0

        # Over-forecast: where forecast > actual, i.e., error > 0
        over_errors = da_fct - actual
        max_overforecast = float(np.max(over_errors)) if len(over_errors) > 0 else 0.0

        # Energy delivered (half-hours converted to GWh)
        total_actual_gwh = float(np.sum(actual * 0.5) / 1000.0)
        total_da_gwh = float(np.sum(da_fct * 0.5) / 1000.0)

        return KPIMetrics(
            maeMw=round(mae_mw, 2),
            maePct=round(mae_pct, 2),
            rmseMw=round(rmse_mw, 2),
            meanBiasMw=round(mean_bias_mw, 2),
            peakMaeMw=round(peak_mae_mw, 2),
            offPeakMaeMw=round(off_peak_mae_mw, 2),
            peakOffPeakDeltaMw=round(peak_delta_mw, 2),
            intradayMaeMw=round(id_mae_mw, 2),
            intradayAccuracyImprovementPct=round(id_improvement_pct, 2),
            maxUnderforecastMw=round(max_underforecast, 2),
            maxOverforecastMw=round(max_overforecast, 2),
            totalActualEnergyGWh=round(total_actual_gwh, 2),
            totalDayAheadEnergyGWh=round(total_da_gwh, 2),
            sampleCount=n
        )

    @staticmethod
    def calculate_error_distribution(df: pd.DataFrame, num_bins: int = 25) -> ErrorDistribution:
        """
        Calculates non-parametric quantiles and frequency histogram of forecast errors.
        """
        errors = (df["dayAheadForecastMw"] - df["actualMw"]).to_numpy()
        n = len(errors)
        if n == 0:
            raise ValueError("Dataset empty for error distribution.")

        p05 = float(np.percentile(errors, 5))
        p10 = float(np.percentile(errors, 10))
        p25 = float(np.percentile(errors, 25))
        p50 = float(np.percentile(errors, 50))
        p75 = float(np.percentile(errors, 75))
        p90 = float(np.percentile(errors, 90))
        p95 = float(np.percentile(errors, 95))
        p99 = float(np.percentile(errors, 99))

        std_dev = float(np.std(errors, ddof=1))
        # Skewness and Kurtosis
        mean_err = np.mean(errors)
        m2 = np.mean((errors - mean_err) ** 2)
        m3 = np.mean((errors - mean_err) ** 3)
        m4 = np.mean((errors - mean_err) ** 4)
        skewness = float(m3 / (m2 ** 1.5)) if m2 > 0 else 0.0
        kurtosis = float((m4 / (m2 ** 2)) - 3.0) if m2 > 0 else 0.0

        # Construct histogram bins
        counts, bin_edges = np.histogram(errors, bins=num_bins)
        hist_bins = []
        total_counts = float(np.sum(counts))

        for i in range(len(counts)):
            b_start = float(bin_edges[i])
            b_end = float(bin_edges[i + 1])
            b_center = (b_start + b_end) / 2.0
            cnt = int(counts[i])
            pct = round((cnt / total_counts * 100.0), 2)
            hist_bins.append(
                HistogramBin(
                    binStart=round(b_start, 1),
                    binEnd=round(b_end, 1),
                    binCenter=round(b_center, 1),
                    count=cnt,
                    percentage=pct
                )
            )

        return ErrorDistribution(
            p05=round(p05, 2),
            p10=round(p10, 2),
            p25=round(p25, 2),
            p50=round(p50, 2),
            p75=round(p75, 2),
            p90=round(p90, 2),
            p95=round(p95, 2),
            p99=round(p99, 2),
            stdDevMw=round(std_dev, 2),
            skewness=round(skewness, 3),
            kurtosis=round(kurtosis, 3),
            histogram=hist_bins
        )

    @staticmethod
    def calculate_daily_breakdown(df: pd.DataFrame) -> List[DailyErrorMetric]:
        """
        Aggregates error metrics by calendar date for heatmap visualization.
        """
        results = []
        for sdate, group in df.groupby("settlementDate"):
            errors = group["dayAheadForecastMw"] - group["actualMw"]
            abs_err = errors.abs()

            mae = float(abs_err.mean())
            rmse = float(np.sqrt((errors ** 2).mean()))
            bias = float(errors.mean())
            act_mwh = float(group["actualMw"].sum() * 0.5)
            da_mwh = float(group["dayAheadForecastMw"].sum() * 0.5)

            # Volatility calculation based on half-hour ramp delta
            ramp_vol = float(group["actualMw"].diff().abs().mean())
            volatility_index = min(100.0, (ramp_vol / 120.0) * 100.0)

            # Event classification based on wind volume and forecast behavior
            mean_wind = float(group["actualMw"].mean())
            if mean_wind > 12000.0 or mae > 1100.0:
                category = "Storm Depression"
            elif mean_wind < 3500.0:
                category = "Dunkelflaute Lull"
            elif ramp_vol > 350.0:
                category = "High Wind Ramp"
            else:
                category = "Moderate Westerly"

            results.append(
                DailyErrorMetric(
                    date=str(sdate),
                    maeMw=round(mae, 2),
                    rmseMw=round(rmse, 2),
                    meanBiasMw=round(bias, 2),
                    actualMWh=round(act_mwh, 1),
                    dayAheadMWh=round(da_mwh, 1),
                    volatilityIndex=round(volatility_index, 1),
                    eventCategory=category
                )
            )

        # Sort chronologically
        results.sort(key=lambda x: x.date)
        return results

    @staticmethod
    def calculate_settlement_period_profiles(df: pd.DataFrame) -> List[SettlementPeriodProfile]:
        """
        Computes 48-period diurnal profiles averaged across January 2026.
        """
        profiles = []
        for sp, group in df.groupby("settlementPeriod"):
            sp_int = int(sp)
            errors = group["dayAheadForecastMw"] - group["actualMw"]

            # Calculate time range string
            total_start_mins = (sp_int - 1) * 30
            start_h = total_start_mins // 60
            start_m = total_start_mins % 60
            end_mins = total_start_mins + 30
            end_h = end_mins // 60
            end_m = end_mins % 60
            time_str = f"{start_h:02d}:{start_m:02d} - {end_h:02d}:{end_m:02d}"

            profiles.append(
                SettlementPeriodProfile(
                    settlementPeriod=sp_int,
                    timeUtc=time_str,
                    isPeak=15 <= sp_int <= 38,
                    meanActualMw=round(float(group["actualMw"].mean()), 2),
                    meanForecastMw=round(float(group["dayAheadForecastMw"].mean()), 2),
                    maeMw=round(float(errors.abs().mean()), 2),
                    rmseMw=round(float(np.sqrt((errors ** 2).mean())), 2),
                    meanBiasMw=round(float(errors.mean()), 2)
                )
            )

        profiles.sort(key=lambda x: x.settlementPeriod)
        return profiles

    @staticmethod
    def calculate_thermal_procurement(
        df: pd.DataFrame, request: ThermalProcurementRequest
    ) -> ThermalProcurementResponse:
        """
        Trader Decision Support Engine:
        Calculates optimal Day-Ahead dispatchable thermal power procurement (CCGT / biomass)
        and risk safety buffers to safeguard against asymmetric imbalance penalties.
        """
        demand = request.expectedDemandMw

        # Determine reference wind forecast
        if request.windForecastMw is not None:
            wind_fct = request.windForecastMw
        elif request.settlementPeriod is not None:
            sp_data = df[df["settlementPeriod"] == request.settlementPeriod]
            wind_fct = float(sp_data["dayAheadForecastMw"].mean()) if not sp_data.empty else float(df["dayAheadForecastMw"].mean())
        else:
            wind_fct = float(df["dayAheadForecastMw"].mean())

        # Base residual thermal requirement (deterministic)
        base_residual = max(0.0, demand - wind_fct)

        # Empirical wind shortfall errors:
        # A shortfall occurs when actual < forecast (i.e. dayAheadForecastMw - actualMw > 0)
        errors = df["dayAheadForecastMw"] - df["actualMw"]
        shortfalls = np.maximum(0.0, errors.to_numpy())

        # Quantile buffer based on requested confidence level (default P90)
        target_quantile = request.riskConfidenceLevel * 100.0
        risk_buffer_mw = float(np.percentile(shortfalls, target_quantile))

        # Recommended total thermal commitment
        recommended_total_thermal = round(base_residual + risk_buffer_mw, 2)

        # Deficit probabilities
        # Without buffer: probability that actual wind < forecast
        unbuffered_deficit_prob = float(np.mean(errors > 0) * 100.0)
        # With buffer: probability that wind shortfall exceeds the buffer
        buffered_deficit_prob = float(np.mean(shortfalls > risk_buffer_mw) * 100.0)

        # Financial valuation
        sbp = request.systemBuyPriceGbp or settings.DEFAULT_SYSTEM_BUY_PRICE_GBP
        ssp = request.systemSellPriceGbp or settings.DEFAULT_SYSTEM_SELL_PRICE_GBP
        ccgt_cost = request.ccgtMarginalCostGbp or settings.DEFAULT_CCGT_MARGINAL_COST_GBP
        da_price = request.dayAheadPowerPriceGbp or settings.DEFAULT_DAY_AHEAD_POWER_PRICE_GBP

        # Unbuffered Expected Imbalance Cost:
        # Expected deficit (MW) * 0.5h * (SBP - DA_price)
        expected_deficit_mw = float(np.mean(shortfalls))
        unbuffered_cost = expected_deficit_mw * 0.5 * max(0.0, (sbp - da_price))

        # Buffered Expected Imbalance Cost:
        # Under buffer, deficit is capped to shortfalls > buffer, while excess buffer incurs CCGT marginal carry
        residual_shortfalls = np.maximum(0.0, shortfalls - risk_buffer_mw)
        expected_residual_deficit_mw = float(np.mean(residual_shortfalls))
        residual_penalty = expected_residual_deficit_mw * 0.5 * max(0.0, (sbp - da_price))
        buffer_carry_cost = risk_buffer_mw * 0.5 * max(0.0, (ccgt_cost - da_price))
        buffered_cost = residual_penalty + buffer_carry_cost

        net_value_add = max(0.0, unbuffered_cost - buffered_cost)

        # Operational Rationale for the Trading Desk
        rationale = (
            f"Under gross consumer demand of {demand:,.0f} MW and a Day-Ahead wind forecast of {wind_fct:,.0f} MW, "
            f"naive procurement leaves a residual requirement of {base_residual:,.0f} MW. However, empirical January 2026 "
            f"outturns reveal a {unbuffered_deficit_prob:.1f}% probability of wind shortfall. Applying a P{int(target_quantile)} "
            f"risk buffer of +{risk_buffer_mw:,.0f} MW compresses the portfolio shortfall exposure to {buffered_deficit_prob:.1f}%. "
            f"This shields the utility from peak cashout penalties (£{sbp:.2f}/MWh SBP), yielding an estimated net risk-adjusted saving "
            f"of £{net_value_add:,.2f} for this 30-minute settlement period."
        )

        return ThermalProcurementResponse(
            demandMw=round(demand, 2),
            windForecastMw=round(wind_fct, 2),
            baseResidualThermalMw=round(base_residual, 2),
            recommendedRiskBufferMw=round(risk_buffer_mw, 2),
            recommendedTotalThermalMw=recommended_total_thermal,
            unbufferedDeficitRiskPct=round(unbuffered_deficit_prob, 2),
            bufferedDeficitRiskPct=round(buffered_deficit_prob, 2),
            expectedImbalanceCostUnbuffered=round(unbuffered_cost, 2),
            expectedImbalanceCostBuffered=round(buffered_cost, 2),
            netValueAddGbp=round(net_value_add, 2),
            hedgingRationale=rationale
        )


analytics_service = AnalyticsService()
