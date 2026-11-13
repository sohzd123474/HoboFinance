"""Build public/data/ssb.json: every Singapore Savings Bond issue since October 2015.

The browser never calls MAS. This script reads the two JSON endpoints behind
the MAS "Savings Bonds statistics" pages once and writes one compact file.

Usage (from the repo root):
    .venv\\Scripts\\pip install -r scripts/requirements-ssb.txt
    .venv\\Scripts\\python scripts/build_ssb.py

Output:
    public/data/ssb.json
        issues   one row per issue: code, issue date, the interest paid in each
                 of years 1 to 10 (%), and MAS's published average return per
                 year for each holding period (%), or null where not published
        missing  months with no issue, or an issue that could not be parsed,
                 each with the reason
"""

from __future__ import annotations

import json
import math
import sys
from datetime import date, datetime, timezone
from pathlib import Path

import requests

ROOT = Path(__file__).resolve().parent.parent
OUT = ROOT / "public" / "data" / "ssb.json"

BASE = "https://eservices.mas.gov.sg/statistics/api/v1/bondsandbills/m"
LIST_URL = f"{BASE}/listsavingbonds"  # issue code, issue date
RATES_URL = f"{BASE}/savingbondsinterest"  # coupons and average returns
HEADERS = {"User-Agent": "ssb-data-script", "Accept": "application/json"}
FIRST_MONTH = "2015-10"  # the first Savings Bond was issued on 1 October 2015
ROWS = 1000  # one request per endpoint; about 12 new issues a year


def fetch(url: str) -> list[dict]:
    """Return every record from one endpoint, in a single request."""
    resp = requests.get(url, params={"rows": ROWS}, headers=HEADERS, timeout=60)
    resp.raise_for_status()
    body = resp.json()
    if not body.get("success"):
        raise RuntimeError(f"{url} answered success=false")
    result = body["result"]
    records = result["records"]
    if len(records) < result.get("total", len(records)):
        raise RuntimeError(f"{url} returned {len(records)} of {result['total']} records; raise ROWS")
    return records


def number(value) -> float | None:
    """A finite float rounded to 2 places, or None. JSON has no NaN."""
    try:
        f = float(value)
    except (TypeError, ValueError):
        return None
    if math.isnan(f) or math.isinf(f):
        return None
    return round(f, 2)


def months_between(first: str, last: str) -> list[str]:
    y, m = int(first[:4]), int(first[5:7])
    out = []
    while f"{y:04d}-{m:02d}" <= last:
        out.append(f"{y:04d}-{m:02d}")
        m += 1
        if m == 13:
            y, m = y + 1, 1
    return out


def write(payload: dict) -> None:
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, separators=(",", ":"), allow_nan=False), encoding="utf-8")
    print(f"wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size / 1024:.0f} KB)")


def main() -> None:
    built_at = datetime.now(timezone.utc).isoformat(timespec="seconds")
    source = f"{LIST_URL} and {RATES_URL}"

    try:
        listing = fetch(LIST_URL)
        rates = {r.get("issue_code"): r for r in fetch(RATES_URL)}
    except Exception as exc:  # network, HTTP or format errors
        if OUT.exists():
            sys.exit(f"MAS could not be read ({exc}); keeping the existing {OUT.name}.")
        # No earlier file to keep: write an empty one that says why, so the page can show it.
        write({"builtAt": built_at, "source": source, "issues": [],
               "missing": [{"month": FIRST_MONTH, "reason": f"MAS data could not be fetched: {exc}"}]})
        sys.exit(1)

    issues: list[dict] = []
    problems: dict[str, str] = {}  # month -> reason
    for row in listing:
        code = row.get("issue_code")
        issue_date = (row.get("issue_date") or "")[:10]
        try:
            date.fromisoformat(issue_date)
        except ValueError:
            print(f"  {code}: skipped, issue date {issue_date!r} is not a date")
            continue
        month = issue_date[:7]
        rate = rates.get(code)
        if rate is None:
            problems[month] = f"{code}: MAS lists the issue but publishes no interest rates for it"
            continue
        coupons = [number(rate.get(f"year{i}_coupon")) for i in range(1, 11)]
        if any(c is None for c in coupons):
            problems[month] = f"{code}: fewer than 10 yearly interest rates were published"
            continue
        returns = [number(rate.get(f"year{i}_return")) for i in range(1, 11)]
        issues.append({
            "code": code,
            "issueDate": issue_date,
            "month": month,
            "coupons": coupons,
            "avgReturn": returns if all(r is not None for r in returns) else None,
        })

    issues.sort(key=lambda i: i["issueDate"])
    have = {i["month"] for i in issues}
    last_month = max(have | set(problems) | {date.today().strftime("%Y-%m")})
    expected = months_between(FIRST_MONTH, last_month)
    # The newest issue is announced a month ahead, so the latest month may run past today.
    this_month = date.today().strftime("%Y-%m")
    missing = []
    for m in expected:
        if m in have:
            continue
        if m in problems:
            missing.append({"month": m, "reason": problems[m]})
        elif m <= this_month:
            missing.append({"month": m, "reason": "MAS lists no Savings Bond issued in this month"})

    if len(issues) < len(expected) / 2:
        sys.exit(f"Only {len(issues)} of {len(expected)} expected months parsed; refusing to write a partial file.")

    write({"builtAt": built_at, "source": source, "issues": issues, "missing": missing})
    print(f"{len(issues)} issues, {issues[0]['month']} to {issues[-1]['month']}; {len(missing)} months missing")
    for m in missing:
        print(f"  {m['month']}: {m['reason']}")


if __name__ == "__main__":
    main()
