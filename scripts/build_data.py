"""Build the precomputed market-data JSON used by the site.

The browser never fetches market data. This script downloads it once with
yfinance and writes compact JSON into public/data/, which is committed.

Usage (from the repo root):
    py -m venv .venv
    .venv\\Scripts\\pip install -r scripts/requirements.txt
    .venv\\Scripts\\python scripts/build_data.py

Outputs:
    public/data/monthly.json  month-end adjusted closes (dividends reinvested)
    public/data/daily.json    daily adjusted high/low/close for a smaller set
    public/data/meta.json     when it was built and what is missing, with reasons
"""

from __future__ import annotations

import json
import math
import re
import sys
from datetime import date, datetime, timezone
from pathlib import Path

import pandas as pd
import yfinance as yf

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "data"
RANKINGS = ROOT / "src" / "data" / "rankings.ts"
START = "1999-01-01"  # one year of lead-in for 12-month momentum and 52-week highs

# Always fetched, whatever the rankings table says.
BENCHMARKS = ["SPY", "QQQ", "TQQQ"]
# Singapore comparison set (prices in SGD).
SINGAPORE = ["ES3.SI", "O39.SI", "CLR.SI"]


def tickers_from_rankings() -> tuple[list[str], list[str]]:
    """Return (all ranked tickers, tickers that were ever #1) from rankings.ts."""
    if not RANKINGS.exists():
        sys.exit(f"Missing {RANKINGS}. The rankings table must exist before data is built.")
    text = RANKINGS.read_text(encoding="utf-8")
    every = sorted(set(re.findall(r"'([A-Z]{1,5}(?:-[A-Z])?)'", text)))
    block = re.search(r"NUMBER_ONE[^=]*=\s*\[(.*?)\n\];", text, re.S)
    ones = sorted(set(re.findall(r"ticker:\s*'([A-Z]{1,5}(?:-[A-Z])?)'", block.group(1)))) if block else []
    return every, ones


def clean(value: float, digits: int = 4):
    """JSON has no NaN. Missing prices are written as null, never as 0."""
    if value is None or (isinstance(value, float) and (math.isnan(value) or math.isinf(value))):
        return None
    return round(float(value), digits)


def download(ticker: str) -> pd.DataFrame | None:
    df = yf.download(ticker, start=START, auto_adjust=True, progress=False, threads=False)
    if df is None or df.empty:
        return None
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)
    df = df[["High", "Low", "Close"]].dropna(how="all")
    df.index = pd.to_datetime(df.index).tz_localize(None)
    return df


def main() -> None:
    ranked, ones = tickers_from_rankings()
    monthly_set = sorted(set(ranked) | set(BENCHMARKS) | set(SINGAPORE))
    daily_set = sorted(set(ones) | set(BENCHMARKS))
    print(f"{len(monthly_set)} tickers monthly, {len(daily_set)} daily")

    frames: dict[str, pd.DataFrame] = {}
    missing: dict[str, str] = {}
    for t in monthly_set:
        try:
            df = download(t)
        except Exception as exc:  # network or symbol errors: record, do not abort
            df = None
            missing[t] = f"download failed: {exc}"
        if df is None:
            missing.setdefault(t, "Yahoo Finance returned no data (delisted or renamed symbol)")
            print(f"  {t}: MISSING")
            continue
        frames[t] = df
        print(f"  {t}: {df.index[0].date()} to {df.index[-1].date()} ({len(df)} days)")

    if "SPY" not in frames:
        sys.exit("SPY could not be downloaded; refusing to write partial data.")

    # Monthly: last adjusted close of each calendar month. The current, unfinished
    # month is dropped so every value is a real month-end.
    today = date.today()
    month_end = {t: df["Close"].resample("ME").last() for t, df in frames.items()}
    months = month_end["SPY"].index
    months = months[(months.year < today.year) | ((months.year == today.year) & (months.month < today.month))]
    monthly = {
        "dates": [m.strftime("%Y-%m") for m in months],
        "series": {t: [clean(s.reindex(months).iloc[i]) for i in range(len(months))] for t, s in month_end.items()},
    }
    first_month = {t: next((d for d, v in zip(monthly["dates"], vals) if v is not None), None) for t, vals in monthly["series"].items()}

    # Daily: shared date axis from SPY, cut at the last complete month.
    days = frames["SPY"].index
    days = days[days <= months[-1]]
    daily = {"dates": [d.strftime("%Y-%m-%d") for d in days], "series": {}}
    for t in daily_set:
        if t not in frames:
            continue
        df = frames[t].reindex(days)
        daily["series"][t] = {
            "h": [clean(v, 3) for v in df["High"].tolist()],
            "l": [clean(v, 3) for v in df["Low"].tolist()],
            "c": [clean(v, 3) for v in df["Close"].tolist()],
        }

    meta = {
        "builtAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "source": "Yahoo Finance via yfinance; prices adjusted for splits and dividends",
        "lastMonth": monthly["dates"][-1],
        "firstMonth": first_month,
        "missing": missing,
    }

    OUT.mkdir(parents=True, exist_ok=True)
    for name, payload in (("monthly", monthly), ("daily", daily), ("meta", meta)):
        path = OUT / f"{name}.json"
        path.write_text(json.dumps(payload, separators=(",", ":"), allow_nan=False), encoding="utf-8")
        print(f"wrote {path.relative_to(ROOT)} ({path.stat().st_size / 1024:.0f} KB)")
    if missing:
        print("Missing tickers:", ", ".join(f"{t} ({why})" for t, why in missing.items()))


if __name__ == "__main__":
    main()
