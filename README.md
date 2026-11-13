# Hobo Finance

Free investing tools, calculators and a blog for people in Singapore. Static site built with Astro, with React and Recharts for the interactive tools, served from a Cloudflare Worker as static assets.

## Run it

```
npm install
npm run dev        # local site at http://localhost:4321
npm test           # unit tests (Vitest)
npm run build      # production build into dist/
```

## Deploy

The GitHub repo is connected to the `hobofinance` Cloudflare Worker. Every push to `main` runs `npx wrangler deploy`, which builds the site first (see `build.command` in `wrangler.jsonc`) and uploads `dist/`. No build settings need changing in the Cloudflare dashboard.

To deploy by hand: `npx wrangler login`, then `npm run deploy`.

## Where things live

| Path | What it is |
| --- | --- |
| `src/content/blog/*.md` | Blog posts. Add a Markdown file with `title`, `description` and `pubDate` in the front matter. |
| `src/lib/calculators.ts` | The basic calculators (inputs, quick-pick buttons, maths, explanation). |
| `src/lib/tools.ts` | The list of tools shown on the site. A tool appears once `ready` is `true`. |
| `src/lib/*.ts` | Pure maths for each tool, each with a `*.test.ts` beside it. |
| `src/components/` | React components for the tools. |
| `src/data/` | Hand-researched tables with sources in comments (rankings, fund fees, CPF rules). |
| `public/data/` | Precomputed market data as JSON. Committed; never fetched live from a market API by the browser. |
| `scripts/` | Python scripts that rebuild `public/data/`. |

## Refreshing the data

Market prices and Savings Bonds rates are downloaded by scripts and committed, so the site itself makes no calls to outside services. Refresh them once a month, after the month has ended.

One-time setup:

```
py -m venv .venv
.venv\Scripts\pip install -r scripts/requirements.txt -r scripts/requirements-ssb.txt
```

Each refresh:

```
.venv\Scripts\python scripts/build_data.py    # prices: monthly.json, daily.json, meta.json
.venv\Scripts\python scripts/build_ssb.py     # Savings Bonds: ssb.json
npm test
git add public/data && git commit -m "Refresh market data" && git push
```

`build_data.py` reads the tickers it needs from `src/data/rankings.ts`, so update that table first if the largest US company has changed. Each entry there carries a `confidence` flag; months that could not be confirmed from two sources are marked `unsure` and shown that way on the SNP1 page.

Anything that could not be downloaded is listed in `public/data/meta.json` under `missing` with the reason, and the site shows it as "n/a".

## Privacy

Nothing a visitor types leaves their browser. Inputs are saved in `localStorage` under keys starting with `hf:` and can be exported or imported from the footer. There is no personal data in this repo.
