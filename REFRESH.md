# Refresh the site's data

Nothing on this site updates by itself. Prices, Savings Bonds rates and the hand-researched tables are all files in this repo, and they go stale until someone refreshes them.

To refresh, open Claude Code in this folder and say: **"Follow REFRESH.md"**.

## Instructions for Claude

Work through the sections that are due, then run the checks and push. Report what changed, what you could not verify, and anything that looks wrong. Never invent a figure: if a source cannot be read, keep the old value, mark it `verified: false` or `unsure`, and say so.

### Every month (after the month has ended)

1. **Prices.** Run `.venv\Scripts\python scripts/build_data.py`. It rewrites `public/data/monthly.json`, `daily.json` and `meta.json`. Read its output: any ticker listed as missing must be reported.
2. **Savings Bonds.** Run `.venv\Scripts\python scripts/build_ssb.py`. It rewrites `public/data/ssb.json` from the MAS API. Confirm the newest issue month is present.
3. **Largest US company.** Check which US company was largest by market value at the last month-end close (Slickcharts, companiesmarketcap.com). If it differs from the last entry in `NUMBER_ONE` in `src/data/rankings.ts`, add an entry with the check month, a source comment and a `confidence` flag. Then rerun step 1, because the script reads its tickers from that file.

If `.venv` is missing, create it first:

```
py -m venv .venv
.venv\Scripts\pip install -r scripts/requirements.txt -r scripts/requirements-ssb.txt
```

### Every quarter (January, April, July, October)

4. **Top 7 US companies.** Add the new quarter's row to `TOP7_QUARTERLY` in `src/data/rankings.ts`, ranked at the prior quarter-end. Its first ticker must match `NUMBER_ONE` for that month.
5. **S&P 500 weights.** Update `src/data/sp500-top.ts` and its `asOf` date from the SPY holdings page.
6. **CPF interest rates.** CPF reviews rates quarterly. Check the Ordinary Account and Special/MediSave/Retirement rates on cpf.gov.sg against `src/data/cpf.ts`.

### Every year (January), or when a rule changes

7. **CPF rules** in `src/data/cpf.ts`: contribution rates, allocation, wage ceiling, Full and Basic Retirement Sums, Basic Healthcare Sum, self-employed MediSave. Also the 20% and 17% rates in `src/lib/calculators.ts` (`CPF_EMPLOYEE_RATE`, `CPF_EMPLOYER_RATE`).
8. **Fund fees** in `src/data/etfs.ts`: expense ratios, world-fund US weights and the dividend yield, each from the issuer's own page. Clear the `verified: false` flags only for figures you actually read there.
9. **MediSave limits for Integrated Shield Plans** in `src/lib/calculators.ts` (`medisaveLimitForShieldPlan`), from the Ministry of Health page.
10. **ILP defaults** in `src/lib/ilp.ts` against the insurer's current product summary. These are still unverified.
11. **US estate tax** threshold and top rate on the ETF tax drag page, from irs.gov.

### After any change

```
npm test
npm run build
git add -A
git commit -m "Refresh data: <what changed>"
git push
```

Pushing to `main` deploys the site. Check the SNP1, Savings Bonds and leveraged ETF pages load on the live site afterwards.
