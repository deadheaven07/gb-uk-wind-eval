import os
from typing import List

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    """
    Application configuration for the Gridbricks / REint AI Day-Ahead Energy Decision Engine.
    Configured for the UK Wholesale Electricity Market (Elexon BMRS).
    """
    APP_NAME: str = "Gridbricks REint AI - UK Wind Decision Intelligence"
    APP_VERSION: str = "1.0.0"
    API_V1_PREFIX: str = "/api/v1"
    DEBUG: bool = False

    # CORS configuration - Allow standard frontend dev ports and container hostnames
    CORS_ORIGINS: List[str] = [
        "http://localhost:5173",
        "http://localhost:3000",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:3000",
        "http://0.0.0.0:5173",
    ]

    # Elexon BMRS API Endpoints
    # The official BMRS API exposes stream datasets for generation and forecasts.
    ELEXON_BASE_URL: str = "https://data.elexon.co.uk/bmrs/api/v1"
    ELEXON_FUELHH_URL: str = "https://data.elexon.co.uk/bmrs/api/v1/datasets/FUELHH/stream"
    ELEXON_WINDFOR_URL: str = "https://data.elexon.co.uk/bmrs/api/v1/datasets/WINDFOR/stream"

    # Day-Ahead Auction Deadline vs Balancing Mechanism Gate Closure:
    # 1. Day-Ahead Wholesale Power Auctions:
    #    In Great Britain, wholesale day-ahead exchange auctions (EPEX SPOT UK 60-minute auction
    #    and Nord Pool UK Day-Ahead auction) close order books strictly at 11:00 GMT / 11:00 UTC
    #    on Day D-1 (the day prior to delivery). This is the key commercial decision deadline for
    #    day-ahead dispatchable thermal procurement and base schedule commitment.
    #    Note: In summer (BST), 11:00 GMT corresponds to 12:00 BST; in winter (January), GMT == UTC.
    # 2. Balancing Mechanism (BM) Physical Gate Closure:
    #    Under BSC Section P, physical notifications (FPNs) for each individual 30-minute settlement
    #    period lock strictly 1 hour (60 minutes) prior to the settlement period start time on Day D.
    DAY_AHEAD_CUTOFF_HOUR_UTC: int = 11
    DAY_AHEAD_CUTOFF_MINUTE_UTC: int = 0
    INTRADAY_GATE_CLOSURE_MINUTES: int = 60

    # Retained for backwards compatibility
    GATE_CLOSURE_HOUR_UTC: int = 11
    GATE_CLOSURE_MINUTE_UTC: int = 0

    # Cache directory for persistent Parquet and SQLite storage
    CACHE_DIR: str = os.getenv("CACHE_DIR", "data/cache")

    # Financial and Grid Parameters for Trader Decision Support
    # Typical UK Winter peak wholesale and cashout benchmarks (£/MWh)
    DEFAULT_DEMAND_MW: float = 34000.0  # Typical UK winter evening peak demand (MW)
    DEFAULT_CCGT_MARGINAL_COST_GBP: float = 78.50  # Combined Cycle Gas Turbine baseline cost (£/MWh)
    DEFAULT_SYSTEM_BUY_PRICE_GBP: float = 125.00  # Cashout penalty when utility is short (£/MWh)
    DEFAULT_SYSTEM_SELL_PRICE_GBP: float = 42.00  # Cashout spill price when utility is long (£/MWh)
    DEFAULT_DAY_AHEAD_POWER_PRICE_GBP: float = 85.00  # Day-Ahead wholesale power price (£/MWh)

    model_config = SettingsConfigDict(case_sensitive=True, env_file=".env")


settings = Settings()
