# Hobo Finance

Free investing tools, calculators and a blog for people in Singapore. Astro static site with React tool pages, deployed from `main` to the `hobofinance` Cloudflare Worker.

- **Data does not update by itself.** If the user asks to refresh or update data, or `public/data/meta.json` shows `lastMonth` more than a month behind today, follow `REFRESH.md`.
- **Every number shown must come from code or a data file.** Missing or unverifiable figures are shown as "n/a" or tagged unverified, never guessed.
- **Keep pages plain and tool-first:** short title, one line of description, then the tool. No banners, slogans or decorative cards.
- **Inputs:** dollar amounts use `MoneyInput` (commas), percentages use `PercentInput` (% sign), and numeric inputs get `Presets` quick-pick buttons. On the basic calculators this is handled by `src/lib/calculators.ts`.
- **New tool or calculator:** pure maths in `src/lib/*.ts` with a Vitest test beside it, then add it to `src/lib/tools.ts` or `src/lib/calculators.ts` and to the path in `src/lib/stages.ts`.
- Run `npm test` and `npm run build` before pushing. See `README.md` for commands and layout.
