"""
Gridbricks / REint AI - Elexon BMRS Ingestion & Gate Closure Engine
===================================================================

This module handles:
1. Extraction of Half-Hourly Wind Generation Actuals (FUELHH dataset) from Elexon BMRS.
2. Extraction of Wind Generation Forecasts (WINDFOR dataset) with multi-issue timestamps.
3. Day-Ahead Auction Cutoff Filtering (strictly <= 11:00 UTC D-1) to eliminate look-ahead bias.
4. Balancing Mechanism Intraday Gate Closure (strictly <= T-1h before settlement period start).
5. Hourly-to-half-hourly temporal alignment across the 48 daily settlement periods.
6. Persistent local caching (Parquet + SQLite) with schema and coverage validation.
7. Explicit data source provenance tracking (ELEXON_LIVE, CACHE, SYNTHETIC_DEMO, UNAVAILABLE).
8. Meteorological regime-based fallback synthesis for January 2026 when remote Elexon
   is throttled, unreachable, or blocked by environment network isolation.

Author: Senior Energy Software Engineer
"""

import json
import logging
import os
import sqlite3
from datetime import datetime, time, timedelta, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional, Tuple

import numpy as np
import pandas as pd
import requests

from app.core.config import settings
from app.schemas.forecast import DatasetMetadata, DataSourceType

logger = logging.getLogger("gridbricks.elexon")
logger.setLevel(logging.INFO)


class ElexonService:
    """
    Manages communication with Elexon BMRS, enforces Day-Ahead auction cutoff constraints (11:00 UTC D-1),
    and provides resilient cached access to aligned January 2026 wind generation outturns
    and forecasts with transparent provenance.
    """

    def __init__(self, cache_dir: Optional[str] = None):
        self.cache_dir = Path(cache_dir or settings.CACHE_DIR)
        self.cache_dir.mkdir(parents=True, exist_ok=True)
        self.parquet_path = self.cache_dir / "january_2026_wind_aligned.parquet"
        self.sqlite_path = self.cache_dir / "january_2026_cache.db"
        self.metadata_path = self.cache_dir / "cache_metadata.json"

    def get_aligned_data(self, force_refresh: bool = False) -> Tuple[pd.DataFrame, DatasetMetadata]:
        """
        Retrieves the joined Actual vs Forecast dataset for January 2026.
        Returns:
            Tuple[pd.DataFrame, DatasetMetadata]: Aligned DataFrame and structured provenance metadata.
        """
        if not force_refresh and self.parquet_path.exists():
            try:
                df = pd.read_parquet(self.parquet_path)
                if self._validate_cache_df(df):
                    meta = self._read_metadata(df)
                    logger.info(f"Loaded {len(df)} records from validated local Parquet cache (source={meta.source}).")
                    return df, meta
                else:
                    logger.warning("Local cache failed structural validation; triggering fresh ingestion...")
            except Exception as e:
                logger.warning(f"Failed to read parquet cache ({e}); re-ingesting...")

        # Attempt live API ingestion from Elexon BMRS
        live_df = self._fetch_from_elexon()
        if live_df is not None and not live_df.empty and len(live_df) == 1488:
            meta = self._build_metadata(
                live_df,
                DataSourceType.ELEXON_LIVE,
                is_synthetic=False,
                warning=None
            )
            self._save_to_cache(live_df, meta)
            return live_df, meta

        # Fallback to high-fidelity meteorological regime synthesis
        logger.info("Elexon live stream unavailable; activating high-fidelity January 2026 seed synthesis.")
        fallback_df = self._generate_synthetic_january_2026()
        meta = self._build_metadata(
            fallback_df,
            DataSourceType.SYNTHETIC_DEMO,
            is_synthetic=True,
            warning="Demonstration Mode: Simulated January 2026 GB wind fleet dataset active because Elexon BMRS was unreachable. Data illustrates analytical capabilities and must not be used for live trading."
        )
        self._save_to_cache(fallback_df, meta)
        return fallback_df, meta

    def _validate_cache_df(self, df: pd.DataFrame) -> bool:
        """
        Validates cached DataFrame against required schema, record count, and uniqueness.
        """
        required_cols = {
            "startTime", "settlementDate", "settlementPeriod", "isPeak",
            "actualMw", "dayAheadForecastMw", "errorMw"
        }
        if not required_cols.issubset(df.columns):
            logger.warning(f"Cache missing required columns: {required_cols - set(df.columns)}")
            return False

        if len(df) != 1488:
            logger.warning(f"Cache row count mismatch: expected 1,488 half-hours, found {len(df)}")
            return False

        dupes = df.duplicated(subset=["settlementDate", "settlementPeriod"]).sum()
        if dupes > 0:
            logger.warning(f"Cache contains {dupes} duplicate settlement period rows.")
            return False

        return True

    def _build_metadata(
        self,
        df: pd.DataFrame,
        source: DataSourceType,
        is_synthetic: bool = False,
        is_cached: bool = False,
        warning: Optional[str] = None
    ) -> DatasetMetadata:
        total = len(df)
        valid = int(df["dayAheadForecastMw"].notna().sum()) if "dayAheadForecastMw" in df.columns else total
        coverage = round((valid / total * 100.0), 1) if total > 0 else 0.0

        emp_cov = None
        sample_count = None
        if "confidenceLowerMw" in df.columns and "confidenceUpperMw" in df.columns:
            # Only evaluate empirical coverage on rows where both bounds and forecast are non-null
            valid_bounds_mask = (
                df["dayAheadForecastMw"].notna() &
                df["confidenceLowerMw"].notna() &
                df["confidenceUpperMw"].notna()
            )
            valid_bounds_df = df[valid_bounds_mask]
            sample_count = len(valid_bounds_df)
            if sample_count > 0:
                covered = (valid_bounds_df["actualMw"] >= valid_bounds_df["confidenceLowerMw"]) & (
                    valid_bounds_df["actualMw"] <= valid_bounds_df["confidenceUpperMw"]
                )
                emp_cov = round(float(covered.mean() * 100.0), 1)

        return DatasetMetadata(
            source=source,
            isSynthetic=is_synthetic,
            isCached=is_cached,
            warning=warning,
            lastUpdatedAt=datetime.now(timezone.utc).isoformat(),
            cutoffRule=f"{settings.DAY_AHEAD_CUTOFF_HOUR_UTC:02d}:{settings.DAY_AHEAD_CUTOFF_MINUTE_UTC:02d} UTC D-1 Day-Ahead Auction Deadline",
            startDate=str(df["settlementDate"].min()),
            endDate=str(df["settlementDate"].max()),
            totalRecords=total,
            validRecords=valid,
            coveragePct=coverage,
            empiricalCoverageP10P90Pct=emp_cov,
            empiricalCoverageSampleCount=sample_count
        )

    def _read_metadata(self, df: pd.DataFrame) -> DatasetMetadata:
        """
        Reads persisted metadata from disk without losing the original data provenance.
        Synthetic demo datasets remain classified as SYNTHETIC_DEMO even when loaded from cache.
        """
        if self.metadata_path.exists():
            try:
                with open(self.metadata_path, "r") as f:
                    data = json.load(f)
                    meta = DatasetMetadata(**data)
                    meta.isCached = True
                    return meta
            except Exception as e:
                logger.warning(f"Could not parse cache metadata ({e}); reconstructing...")

        return self._build_metadata(df, DataSourceType.SYNTHETIC_DEMO, is_synthetic=True, is_cached=True)

    def _get_with_backoff(
        self, session: requests.Session, url: str, timeout: float = 12.0, max_retries: int = 3
    ) -> Optional[requests.Response]:
        """
        Executes HTTP GET with bounded exponential backoff.
        Honors Retry-After on HTTP 429 and retries on 5xx errors or connection timeouts.
        Rejects non-retryable 4xx client errors immediately.
        """
        import time as time_module
        for attempt in range(max_retries):
            try:
                resp = session.get(url, timeout=timeout)
                if resp.status_code == 200:
                    return resp
                elif resp.status_code == 429:
                    retry_after = resp.headers.get("Retry-After")
                    try:
                        wait_sec = min(5.0, float(retry_after)) if retry_after else 1.0 * (2 ** attempt)
                    except ValueError:
                        wait_sec = 1.0 * (2 ** attempt)
                    logger.warning(f"HTTP 429 Rate Limited from Elexon BMRS. Retrying after {wait_sec:.1f}s...")
                    time_module.sleep(wait_sec)
                elif 500 <= resp.status_code < 600:
                    wait_sec = min(4.0, 0.5 * (2 ** attempt))
                    logger.warning(f"HTTP {resp.status_code} from Elexon BMRS. Retry {attempt+1}/{max_retries} in {wait_sec:.1f}s...")
                    time_module.sleep(wait_sec)
                else:
                    logger.warning(f"Elexon BMRS returned non-retryable HTTP {resp.status_code}: {resp.text[:200]}")
                    return None
            except requests.RequestException as e:
                wait_sec = min(4.0, 0.5 * (2 ** attempt))
                logger.warning(f"Network error calling Elexon ({e}). Retry {attempt+1}/{max_retries} in {wait_sec:.1f}s...")
                time_module.sleep(wait_sec)
        logger.error(f"Elexon BMRS endpoint {url} failed after {max_retries} attempts.")
        return None

    def _fetch_from_elexon(self) -> Optional[pd.DataFrame]:
        """
        Calls Elexon BMRS endpoints for FUELHH (actuals) and WINDFOR (forecasts)
        with bounded exponential backoff retries.
        """
        session = requests.Session()
        session.headers.update({
            "Accept": "application/json",
            "User-Agent": "Gridbricks-REint-AI/1.0 (Energy Decision Intelligence)"
        })

        fuelhh_url = (
            f"{settings.ELEXON_FUELHH_URL}?"
            f"settlementDateFrom=2026-01-01&settlementDateTo=2026-01-31"
        )
        windfor_url = (
            f"{settings.ELEXON_WINDFOR_URL}?"
            f"publishDateTimeFrom=2025-12-30T00:00:00Z&publishDateTimeTo=2026-01-31T23:59:59Z"
        )

        try:
            logger.info("Initiating Elexon FUELHH stream fetch...")
            resp_actual = self._get_with_backoff(session, fuelhh_url, timeout=12)
            if resp_actual is None or resp_actual.status_code != 200:
                logger.warning("FUELHH fetch failed or returned non-200")
                return None

            actual_records = self._parse_json_or_ndjson(resp_actual.text)
            actual_wind = [r for r in actual_records if r.get("fuelType") == "WIND"]
            if not actual_wind:
                logger.warning("No WIND records found in FUELHH response.")
                return None

            logger.info(f"Retrieved {len(actual_wind)} actual WIND records. Fetching WINDFOR...")
            resp_forecast = self._get_with_backoff(session, windfor_url, timeout=15)
            if resp_forecast is None or resp_forecast.status_code != 200:
                logger.warning("WINDFOR fetch failed or returned non-200")
                return None

            forecast_records = self._parse_json_or_ndjson(resp_forecast.text)
            if not forecast_records:
                return None

            # Reconcile and apply gate closure
            return self._reconcile_and_apply_gate_closure(actual_wind, forecast_records)

        except Exception as e:
            logger.warning(f"Elexon live ingestion failed with network exception: {e}")
            return None

    def _parse_json_or_ndjson(self, raw_text: str) -> List[Dict[str, Any]]:
        """Parses both standard JSON arrays and newline-delimited JSON (NDJSON) streams."""
        text = raw_text.strip()
        if not text:
            return []
        if text.startswith("["):
            try:
                return json.loads(text)
            except json.JSONDecodeError:
                pass
        records = []
        for line in text.splitlines():
            line = line.strip()
            if line:
                try:
                    records.append(json.loads(line))
                except json.JSONDecodeError:
                    continue
        return records

    def _reconcile_and_apply_gate_closure(
        self, actual_records: List[Dict[str, Any]], forecast_records: List[Dict[str, Any]]
    ) -> pd.DataFrame:
        """
        Core Domain Logic:
        Reconciles actual settlement generation with the latest forecast published strictly
        prior to Day-Ahead Auction Deadline (11:00 UTC on Day D-1).

        Strict Look-Ahead Prevention:
        - If no forecast was published at or before 11:00 UTC on Day D-1, dayAheadForecastMw
          is marked None/NaN. A later forecast is NEVER substituted.
        - Intraday forecast captures the latest forecast published at or before physical
          Gate Closure (T - 1 hour before delivery start time).
        """
        df_act = pd.DataFrame(actual_records)
        df_fct = pd.DataFrame(forecast_records)

        if df_act.empty:
            return pd.DataFrame()

        # Standardize timestamps to UTC
        df_act["startTime"] = pd.to_datetime(df_act["startTime"], utc=True)
        df_act["settlementDate"] = pd.to_datetime(df_act["settlementDate"]).dt.strftime("%Y-%m-%d")
        df_act["settlementPeriod"] = df_act["settlementPeriod"].astype(int)
        df_act["actualMw"] = df_act["generation"].astype(float)

        # Sort actuals chronologically
        df_act = df_act.sort_values(["settlementDate", "settlementPeriod"]).drop_duplicates(
            subset=["settlementDate", "settlementPeriod"]
        )

        if not df_fct.empty:
            df_fct["startTime"] = pd.to_datetime(df_fct["startTime"], utc=True)
            df_fct["publishTime"] = pd.to_datetime(df_fct["publishTime"], utc=True)
            df_fct["forecastMw"] = df_fct["generation"].astype(float)

        aligned_rows = []
        for _, act_row in df_act.iterrows():
            st = act_row["startTime"]
            sp = act_row["settlementPeriod"]
            sdate_str = act_row["settlementDate"]
            sdate = pd.to_datetime(sdate_str).date()

            # Day-Ahead Auction Deadline: 11:00:00 UTC on D-1
            da_cutoff = datetime.combine(
                sdate - timedelta(days=1),
                time(settings.DAY_AHEAD_CUTOFF_HOUR_UTC, settings.DAY_AHEAD_CUTOFF_MINUTE_UTC),
                tzinfo=timezone.utc
            )

            # Balancing Mechanism Intraday Gate Closure: 1 hour prior to settlement period start
            bm_gate_closure = st - timedelta(minutes=settings.INTRADAY_GATE_CLOSURE_MINUTES)

            da_fct = None
            id_fct = None

            if not df_fct.empty:
                # 1. Day-Ahead Candidate Selection:
                # First prioritize exact half-hour candidates published at or before da_cutoff
                exact_da = df_fct[(df_fct["startTime"] == st) & (df_fct["publishTime"] <= da_cutoff)]
                if not exact_da.empty:
                    da_fct = float(exact_da.sort_values("publishTime").iloc[-1]["forecastMw"])
                else:
                    # Fallback to hourly candidates published at or before da_cutoff
                    hourly_da = df_fct[(df_fct["startTime"] == st.floor("h")) & (df_fct["publishTime"] <= da_cutoff)]
                    if not hourly_da.empty:
                        da_fct = float(hourly_da.sort_values("publishTime").iloc[-1]["forecastMw"])
                    else:
                        da_fct = None

                # 2. Intraday Candidate Selection (published <= bm_gate_closure, i.e., T - 1h):
                exact_id = df_fct[(df_fct["startTime"] == st) & (df_fct["publishTime"] <= bm_gate_closure)]
                if not exact_id.empty:
                    id_fct = float(exact_id.sort_values("publishTime").iloc[-1]["forecastMw"])
                else:
                    hourly_id = df_fct[(df_fct["startTime"] == st.floor("h")) & (df_fct["publishTime"] <= bm_gate_closure)]
                    if not hourly_id.empty:
                        id_fct = float(hourly_id.sort_values("publishTime").iloc[-1]["forecastMw"])
                    else:
                        id_fct = da_fct

            aligned_rows.append({
                "startTime": st.isoformat(),
                "settlementDate": sdate_str,
                "settlementPeriod": sp,
                "isPeak": 15 <= sp <= 38,
                "actualMw": float(act_row["actualMw"]),
                "dayAheadForecastMw": da_fct,
                "intradayForecastMw": id_fct if id_fct is not None else da_fct,
            })

        df = pd.DataFrame(aligned_rows)
        return self._post_process_aligned_df(df)

    def _post_process_aligned_df(self, df: pd.DataFrame) -> pd.DataFrame:
        """
        Calculates derived forecast error metrics and a strictly causal,
        statistically valid empirical P10-P90 uncertainty corridor.

        Signed Residual Convention:
            r_t = Actual_t - DayAheadForecast_t  (Observed generation residual)
            Forecast Error: e_t = DayAheadForecast_t - Actual_t = -r_t

        Causality & Zero Look-Ahead Calibration:
        1. Observable History Only: At interval t, the trading desk has only observed
           residuals from prior intervals (tau < t).
        2. Shift: Residuals are shifted by 1 period before rolling quantile estimation.
           Interval t's own outturn is NEVER included in its historical calibration.
        3. Empirical Non-Parametric Quantiles:
           q_10 = empirical 10th percentile of prior residuals (shifted r)
           q_90 = empirical 90th percentile of prior residuals (shifted r)
           Bounds:
               confidenceLowerMw = max(0.0, DayAheadForecast_t + q_10)
               confidenceUpperMw = DayAheadForecast_t + q_90
           Ordering is mathematically guaranteed: q_10 <= q_90 => Lower <= Upper.
        4. No Future Backfilling:
           Initial warm-up periods (< min_periods=12, i.e. 6 hours) have NaN bounds.
           Future residuals are strictly prevented from backfilling into earlier periods.
        """
        valid_mask = df["dayAheadForecastMw"].notna()

        df["errorMw"] = np.where(valid_mask, df["dayAheadForecastMw"] - df["actualMw"], np.nan)
        df["absErrorMw"] = np.where(valid_mask, df["errorMw"].abs(), np.nan)
        df["pctError"] = np.where(
            valid_mask & (df["actualMw"] > 50),
            (df["errorMw"] / df["actualMw"]) * 100.0,
            np.nan
        )
        df["isMissingForecast"] = ~valid_mask

        # Residual r = Actual - Forecast
        residuals = np.where(valid_mask, df["actualMw"] - df["dayAheadForecastMw"], np.nan)
        r_series = pd.Series(residuals, index=df.index)

        # Shift by 1 period: strictly exclude interval t's own outcome
        r_shifted = r_series.shift(1)

        # Non-parametric empirical quantiles over trailing 48 half-hours (24 hours) with min 12 periods
        window_size = 48
        min_periods = 12

        q10_series = r_shifted.rolling(window=window_size, min_periods=min_periods).quantile(0.10)
        q90_series = r_shifted.rolling(window=window_size, min_periods=min_periods).quantile(0.90)

        bounds_valid = valid_mask & q10_series.notna() & q90_series.notna()

        df["confidenceLowerMw"] = np.where(
            bounds_valid,
            np.maximum(0.0, df["dayAheadForecastMw"] + q10_series),
            np.nan
        )
        df["confidenceUpperMw"] = np.where(
            bounds_valid,
            df["dayAheadForecastMw"] + q90_series,
            np.nan
        )
        return df

    def _generate_synthetic_january_2026(self) -> pd.DataFrame:
        """
        High-Fidelity Synthetic Meteorological Regime Generator for January 2026 UK Wind.
        Simulates authentic GB wind fleet characteristics across 1,488 half-hours.
        Deterministic seed ensures test reproducibility.
        """
        np.random.seed(42)

        dates = pd.date_range(start="2026-01-01", end="2026-01-31", freq="D")
        records = []

        for current_date in dates:
            day_num = current_date.day
            date_str = current_date.strftime("%Y-%m-%d")

            # Meteorological Regimes
            if day_num <= 7:
                regime_base = 11000.0 + 4000.0 * np.sin(day_num * 0.9)
                regime_vol = 1400.0
                phase_bias = 450.0
            elif day_num <= 15:
                regime_base = 2400.0 + 800.0 * np.cos(day_num * 0.7)
                regime_vol = 300.0
                phase_bias = -180.0
            elif day_num <= 24:
                regime_base = 7800.0 + 3500.0 * np.sin(day_num * 1.4)
                regime_vol = 1100.0
                phase_bias = 250.0
            else:
                regime_base = 10500.0 + 2000.0 * np.cos(day_num * 0.8)
                regime_vol = 750.0
                phase_bias = 80.0

            for sp in range(1, 49):
                start_mins = (sp - 1) * 30
                sh = start_mins // 60
                sm = start_mins % 60
                sp_start_iso = f"{date_str}T{sh:02d}:{sm:02d}:00Z"

                diurnal_cycle = 650.0 * np.sin((sp - 6) * np.pi / 24.0)
                turbulent_noise = np.random.normal(0.0, regime_vol * 0.25)
                actual_mw = max(250.0, regime_base + diurnal_cycle + turbulent_noise)

                forecast_noise = np.random.normal(0.0, 0.055 * actual_mw + 180.0)
                phase_shift_error = phase_bias + forecast_noise
                da_forecast_mw = max(350.0, actual_mw + phase_shift_error)

                intraday_noise = np.random.normal(10.0, 0.035 * actual_mw + 60.0)
                intraday_forecast_mw = max(400.0, actual_mw + (0.42 * phase_shift_error) + intraday_noise)

                is_peak = 15 <= sp <= 38

                records.append({
                    "startTime": sp_start_iso,
                    "settlementDate": date_str,
                    "settlementPeriod": sp,
                    "isPeak": is_peak,
                    "actualMw": round(float(actual_mw), 2),
                    "dayAheadForecastMw": round(float(da_forecast_mw), 2),
                    "intradayForecastMw": round(float(intraday_forecast_mw), 2),
                })

        df = pd.DataFrame(records)
        return self._post_process_aligned_df(df)

    def _save_to_cache(self, df: pd.DataFrame, meta: DatasetMetadata) -> None:
        """
        Atomically saves processed dataset and provenance metadata to both Parquet and SQLite.
        Atomic write (.tmp + replace) prevents partial or corrupt artifacts if a process fails.
        """
        try:
            # 1. Atomic Save Parquet
            tmp_parquet = self.cache_dir / "january_2026_wind_aligned.parquet.tmp"
            df.to_parquet(tmp_parquet, index=False)
            os.replace(tmp_parquet, self.parquet_path)

            # 2. Save SQLite Table with context manager transaction
            with sqlite3.connect(self.sqlite_path) as conn:
                df_sqlite = df.copy()
                df_sqlite["isPeak"] = df_sqlite["isPeak"].astype(int)
                if "isMissingForecast" in df_sqlite.columns:
                    df_sqlite["isMissingForecast"] = df_sqlite["isMissingForecast"].astype(int)
                df_sqlite.to_sql("january_wind_forecast", conn, if_exists="replace", index=False)
                conn.commit()

            # 3. Atomic Save Metadata JSON
            tmp_metadata = self.cache_dir / "cache_metadata.json.tmp"
            with open(tmp_metadata, "w") as f:
                json.dump(meta.model_dump(), f, indent=2)
            os.replace(tmp_metadata, self.metadata_path)

            logger.info(f"Successfully persisted aligned dataset to Parquet & SQLite (source={meta.source}).")
        except Exception as e:
            logger.error(f"Failed to cache data: {e}")

            logger.info(f"Successfully persisted aligned dataset to Parquet & SQLite (source={meta.source}).")
        except Exception as e:
            logger.error(f"Failed to cache data: {e}")


elexon_service = ElexonService()
