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
   - Error (MW) = Forecast - Actual (positive indicates over-forecast / long risk;
     negative indicates under-forecast / short risk).
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
   - The empirical quantile risk buffer (P90) calculates the 90th percentile of empirical
     wind shortfall errors, providing a robust hedge that reduces unhedged shortfall frequency
     from ~50% to <10%.
   - Settlement conversion: Each settlement period is 30 minutes (0.5 hours), so 1 MW = 0.5 MWh.

Author: Senior Energy Software Engineer
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
    ThermalProcurementResponse,
    CashoutSensitivityScenario
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
        Computes summary KPIs across the aligned DataFrame, correctly filtering
        for non-missing forecasts to prevent lookahead or zero-imputation distortions.
        """
        n_total = len(df)
        if n_total == 0:
            raise ValueError("Cannot calculate KPIs on empty dataset.")

        valid_mask = df["dayAheadForecastMw"].notna()
        n_valid = int(valid_mask.sum())

        if n_valid == 0:
            logger.warning("No valid Day-Ahead forecast observations found for KPI calculation.")
            return KPIMetrics(
                maeMw=0.0,
                maePct=0.0,
                rmseMw=0.0,
                meanBiasMw=0.0,
                peakMaeMw=0.0,
                offPeakMaeMw=0.0,
                peakOffPeakDeltaMw=0.0,
                intradayMaeMw=0.0,
                intradayAccuracyImprovementPct=0.0,
                maxUnderforecastMw=0.0,
                maxOverforecastMw=0.0,
                totalActualEnergyGWh=round(float(np.sum(df["actualMw"] * 0.5) / 1000.0), 2),
                totalDayAheadEnergyGWh=0.0,
                sampleCount=n_total,
                validSampleCount=0,
                coveragePct=0.0
            )

        valid_df = df[valid_mask]
        actual = valid_df["actualMw"].to_numpy()
        da_fct = valid_df["dayAheadForecastMw"].to_numpy()
        errors = da_fct - actual
        abs_errors = np.abs(errors)

        # MAE and RMSE
        mae_mw = float(np.mean(abs_errors))
        mean_actual = float(np.mean(actual))
        mae_pct = float((mae_mw / mean_actual * 100.0) if mean_actual > 0 else 0.0)
        rmse_mw = float(np.sqrt(np.mean(errors ** 2)))
        mean_bias_mw = float(np.mean(errors))

        # Peak vs Off-Peak separation
        peak_mask = valid_df["isPeak"].to_numpy(dtype=bool)
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

        # Intraday improvements (evaluated on rows with both forecasts present)
        id_valid_mask = valid_df["intradayForecastMw"].notna()
        if np.any(id_valid_mask):
            id_actual = actual[id_valid_mask]
            id_fct = valid_df.loc[id_valid_mask, "intradayForecastMw"].to_numpy()
            id_errors = np.abs(id_fct - id_actual)
            id_mae_mw = float(np.mean(id_errors))
            base_mae_for_id = float(np.mean(abs_errors[id_valid_mask]))
            id_improvement_pct = float(
                ((base_mae_for_id - id_mae_mw) / base_mae_for_id * 100.0) if base_mae_for_id > 0 else 0.0
            )
        else:
            id_mae_mw = mae_mw
            id_improvement_pct = 0.0

        # Extreme values
        under_errors = actual - da_fct  # actual > forecast (wind deficit)
        max_underforecast = float(np.max(under_errors)) if len(under_errors) > 0 else 0.0

        over_errors = da_fct - actual  # forecast > actual (wind surplus)
        max_overforecast = float(np.max(over_errors)) if len(over_errors) > 0 else 0.0

        # Energy delivered (half-hours converted to GWh: sum(MW * 0.5h) / 1000)
        total_actual_gwh = float(np.sum(df["actualMw"] * 0.5) / 1000.0)
        total_da_gwh = float(np.sum(da_fct * 0.5) / 1000.0)

        coverage_pct = round((n_valid / n_total * 100.0), 1)

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
            sampleCount=n_total,
            validSampleCount=n_valid,
            coveragePct=coverage_pct
        )

    @staticmethod
    def calculate_error_distribution(df: pd.DataFrame, num_bins: int = 25) -> ErrorDistribution:
        """
        Calculates non-parametric quantiles and frequency histogram of forecast errors.
        Discards missing intervals to prevent biased zero-error spike artifacts.
        """
        valid_df = df[df["dayAheadForecastMw"].notna()]
        if valid_df.empty:
            raise ValueError("No valid forecast observations available for distribution calculation.")

        errors = (valid_df["dayAheadForecastMw"] - valid_df["actualMw"]).to_numpy()
        n = len(errors)

        p05 = float(np.percentile(errors, 5))
        p10 = float(np.percentile(errors, 10))
        p25 = float(np.percentile(errors, 25))
        p50 = float(np.percentile(errors, 50))
        p75 = float(np.percentile(errors, 75))
        p90 = float(np.percentile(errors, 90))
        p95 = float(np.percentile(errors, 95))
        p99 = float(np.percentile(errors, 99))

        std_dev = float(np.std(errors, ddof=1)) if n > 1 else 0.0

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
            pct = round((cnt / total_counts * 100.0), 2) if total_counts > 0 else 0.0
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
        Aggregates error metrics by calendar date for calendar heatmap visualization.
        """
        results = []
        for sdate, group in df.groupby("settlementDate"):
            valid_group = group[group["dayAheadForecastMw"].notna()]
            if not valid_group.empty:
                errors = valid_group["dayAheadForecastMw"] - valid_group["actualMw"]
                abs_err = errors.abs()
                mae = float(abs_err.mean())
                rmse = float(np.sqrt((errors ** 2).mean()))
                bias = float(errors.mean())
                da_mwh = float(valid_group["dayAheadForecastMw"].sum() * 0.5)
            else:
                mae = 0.0
                rmse = 0.0
                bias = 0.0
                da_mwh = 0.0

            act_mwh = float(group["actualMw"].sum() * 0.5)

            # Volatility calculation based on half-hour ramp delta
            ramp_vol = float(group["actualMw"].diff().abs().mean())
            volatility_index = min(100.0, (ramp_vol / 120.0) * 100.0) if not np.isnan(ramp_vol) else 50.0

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

        results.sort(key=lambda x: x.date)
        return results

    @staticmethod
    def calculate_settlement_period_profiles(df: pd.DataFrame) -> List[SettlementPeriodProfile]:
        """
        Diurnal analysis across all 48 half-hour settlement periods.
        """
        profiles = []
        for sp, group in df.groupby("settlementPeriod"):
            sp_int = int(sp)
            valid_group = group[group["dayAheadForecastMw"].notna()]

            total_start_mins = (sp_int - 1) * 30
            sh = total_start_mins // 60
            sm = total_start_mins % 60
            eh = (total_start_mins + 30) // 60
            em = (total_start_mins + 30) % 60
            time_str = f"{sh:02d}:{sm:02d} - {eh:02d}:{em:02d} UTC"

            mean_act = float(group["actualMw"].mean())
            if not valid_group.empty:
                errors = valid_group["dayAheadForecastMw"] - valid_group["actualMw"]
                mean_fct = float(valid_group["dayAheadForecastMw"].mean())
                mae = float(errors.abs().mean())
                rmse = float(np.sqrt((errors ** 2).mean()))
                bias = float(errors.mean())
            else:
                mean_fct = 0.0
                mae = 0.0
                rmse = 0.0
                bias = 0.0

            profiles.append(
                SettlementPeriodProfile(
                    settlementPeriod=sp_int,
                    timeUtc=time_str,
                    isPeak=15 <= sp_int <= 38,
                    meanActualMw=round(mean_act, 2),
                    meanForecastMw=round(mean_fct, 2),
                    maeMw=round(mae, 2),
                    rmseMw=round(rmse, 2),
                    meanBiasMw=round(bias, 2)
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
        and risk safety buffers to safeguard against asymmetric imbalance cashout penalties.
        Supports Market Aggregate mode, Historical Replay, and thermal fleet capacity constraints.
        """
        demand = max(0.0, float(request.expectedDemandMw))
        actual_outturn = None
        period_label = None

        # Determine reference wind forecast based on request
        if request.targetDate and request.settlementPeriod:
            matched = df[
                (df["settlementDate"] == request.targetDate) &
                (df["settlementPeriod"] == request.settlementPeriod)
            ]
            if not matched.empty:
                row = matched.iloc[0]
                wind_fct = float(row["dayAheadForecastMw"]) if pd.notna(row["dayAheadForecastMw"]) else float(df["dayAheadForecastMw"].dropna().mean())
                actual_outturn = float(row["actualMw"])
                total_start_mins = (int(request.settlementPeriod) - 1) * 30
                sh = total_start_mins // 60
                sm = total_start_mins % 60
                eh = (total_start_mins + 30) // 60
                em = (total_start_mins + 30) % 60
                period_label = f"{request.targetDate} SP {request.settlementPeriod} ({sh:02d}:{sm:02d} - {eh:02d}:{em:02d} UTC)"
            else:
                wind_fct = request.windForecastMw if request.windForecastMw is not None else float(df["dayAheadForecastMw"].dropna().mean())
        elif request.windForecastMw is not None:
            wind_fct = float(request.windForecastMw)
        elif request.settlementPeriod is not None:
            sp_data = df[(df["settlementPeriod"] == request.settlementPeriod) & df["dayAheadForecastMw"].notna()]
            wind_fct = float(sp_data["dayAheadForecastMw"].mean()) if not sp_data.empty else float(df["dayAheadForecastMw"].dropna().mean())
            period_label = f"Diurnal Average for Settlement Period {request.settlementPeriod}"
        else:
            wind_fct = float(df["dayAheadForecastMw"].dropna().mean())
            period_label = "January 2026 Monthly Average"

        # Deterministic Base Residual Thermal: Demand - Wind Forecast
        base_residual = max(0.0, demand - wind_fct)

        # Empirical wind shortfall errors:
        # A shortfall occurs when actual < forecast (i.e. dayAheadForecastMw - actualMw > 0)
        valid_df = df[df["dayAheadForecastMw"].notna()]
        if not valid_df.empty:
            errors = (valid_df["dayAheadForecastMw"] - valid_df["actualMw"]).to_numpy()
        else:
            errors = np.array([0.0])

        shortfalls = np.maximum(0.0, errors)

        # Quantile buffer based on requested confidence level (default P90)
        target_quantile = request.riskConfidenceLevel * 100.0
        risk_buffer_mw = float(np.percentile(shortfalls, target_quantile))

        # Unconstrained recommended total commitment
        unconstrained_thermal = round(base_residual + risk_buffer_mw, 2)

        # Capacity Capping
        is_constrained = False
        if request.maxThermalCapacityMw is not None and request.maxThermalCapacityMw > 0:
            if unconstrained_thermal > request.maxThermalCapacityMw:
                recommended_total_thermal = float(request.maxThermalCapacityMw)
                is_constrained = True
            else:
                recommended_total_thermal = unconstrained_thermal
        else:
            recommended_total_thermal = unconstrained_thermal

        # Deficit probabilities
        unbuffered_deficit_prob = float(np.mean(errors > 0) * 100.0) if len(errors) > 0 else 50.0
        buffered_deficit_prob = float(np.mean(shortfalls > risk_buffer_mw) * 100.0) if len(shortfalls) > 0 else 10.0

        # Financial benchmarks (£/MWh)
        sbp = float(request.systemBuyPriceGbp if request.systemBuyPriceGbp is not None else settings.DEFAULT_SYSTEM_BUY_PRICE_GBP)
        ccgt_cost = float(request.ccgtMarginalCostGbp if request.ccgtMarginalCostGbp is not None else settings.DEFAULT_CCGT_MARGINAL_COST_GBP)
        da_price = float(request.dayAheadPowerPriceGbp if request.dayAheadPowerPriceGbp is not None else settings.DEFAULT_DAY_AHEAD_POWER_PRICE_GBP)

        # Energy conversion: 30-minute settlement period = 0.5 hours (1 MW = 0.5 MWh)
        expected_deficit_mw = float(np.mean(shortfalls))
        unbuffered_cost = expected_deficit_mw * 0.5 * max(0.0, (sbp - da_price))

        residual_shortfalls = np.maximum(0.0, shortfalls - risk_buffer_mw)
        expected_residual_deficit_mw = float(np.mean(residual_shortfalls))
        residual_penalty = expected_residual_deficit_mw * 0.5 * max(0.0, (sbp - da_price))
        buffer_carry_cost = risk_buffer_mw * 0.5 * max(0.0, (ccgt_cost - da_price))
        buffered_cost = residual_penalty + buffer_carry_cost

        net_value_add = max(0.0, unbuffered_cost - buffered_cost)

        # Stress-Testing Sensitivity Matrix (£100 to £350/MWh)
        scenarios = [
            (100.0, "Mild System Margin"),
            (150.0, "Moderate Peak Margin"),
            (250.0, "Tight System / Peaker Event"),
            (350.0, "Emergency Grid Scarcity / Alert")
        ]
        sensitivity_list = []
        for stress_sbp, label in scenarios:
            unbuf_stress = expected_deficit_mw * 0.5 * max(0.0, (stress_sbp - da_price))
            buf_stress = (expected_residual_deficit_mw * 0.5 * max(0.0, (stress_sbp - da_price))) + buffer_carry_cost
            savings = max(0.0, unbuf_stress - buf_stress)
            var_reduction = ((unbuf_stress - buf_stress) / unbuf_stress * 100.0) if unbuf_stress > 0 else 0.0
            sensitivity_list.append(
                CashoutSensitivityScenario(
                    systemBuyPriceGbp=stress_sbp,
                    scenarioLabel=label,
                    unbufferedCostGbp=round(unbuf_stress, 2),
                    bufferedCostGbp=round(buf_stress, 2),
                    netSavingsGbp=round(savings, 2),
                    varReductionPct=round(var_reduction, 1)
                )
            )

        # Operational Rationale for the Trading Desk
        cap_note = f" (Capped by fleet limit of {request.maxThermalCapacityMw:,.0f} MW)" if is_constrained else ""
        rationale = (
            f"Under consumer demand of {demand:,.0f} MW and a Day-Ahead wind forecast of {wind_fct:,.0f} MW, "
            f"deterministic residual requirement is {base_residual:,.0f} MW. Empirical January 2026 outturns "
            f"indicate a {unbuffered_deficit_prob:.1f}% probability of wind deficit. Applying an empirical P{int(target_quantile)} "
            f"safety buffer (+{risk_buffer_mw:,.0f} MW) compresses shortfall risk to {buffered_deficit_prob:.1f}%, recommending "
            f"a total commitment of {recommended_total_thermal:,.0f} MW{cap_note}. At £{sbp:.2f}/MWh SBP, this yields an estimated "
            f"net risk-adjusted saving of £{net_value_add:,.2f} for this 30-minute settlement period (0.5 MWh conversion)."
        )

        return ThermalProcurementResponse(
            demandMw=round(demand, 2),
            windForecastMw=round(wind_fct, 2),
            actualOutturnMw=round(actual_outturn, 2) if actual_outturn is not None else None,
            selectedPeriodLabel=period_label,
            baseResidualThermalMw=round(base_residual, 2),
            recommendedRiskBufferMw=round(risk_buffer_mw, 2),
            recommendedTotalThermalMw=recommended_total_thermal,
            isCapacityConstrained=is_constrained,
            unconstrainedTotalThermalMw=unconstrained_thermal if is_constrained else None,
            unbufferedDeficitRiskPct=round(unbuffered_deficit_prob, 2),
            bufferedDeficitRiskPct=round(buffered_deficit_prob, 2),
            expectedImbalanceCostUnbuffered=round(unbuffered_cost, 2),
            expectedImbalanceCostBuffered=round(buffered_cost, 2),
            netValueAddGbp=round(net_value_add, 2),
            hedgingRationale=rationale,
            sensitivityScenarios=sensitivity_list
        )


analytics_service = AnalyticsService()
