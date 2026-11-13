# Hobo Finance

Free investing tools, calculators and a blog for people in Singapore. Astro static site with React tool pages, deployed from `main` to the `hobofinance` Cloudflare Worker.

- **Data does not update by itself.** If the user asks to refresh or update data, or `public/data/meta.json` shows `lastMonth` more than a month behind today, follow `REFRESH.md`.
- **Every number shown must come from code or a data file.** Missing or unverifiable figures are shown as "n/a" or tagged unverified, never guessed.
- **Keep pages plain and tool-first:** short title, one line of description, then the tool. No banners, slogans or decorative cards.
- **Inputs:** dollar amounts use `MoneyInput` (commas), percentages use `PercentInput` (% sign), and numeric inputs get `Presets` quick-pick buttons. On the basic calculators this is handled by `src/lib/calculators.ts`.
- **New tool or calculator:** pure maths in `src/lib/*.ts` with a Vitest test beside it, then add it to `src/lib/tools.ts` or `src/lib/calculators.ts` and to the path in `src/lib/stages.ts`.
- Run `npm test` and `npm run build` before pushing. See `README.md` for commands and layout.

## Writing for the page

All text a visitor reads follows these rules (adapted from the i-have-adhd skill). Assume the reader skims, forgets anything not on screen, and stops at the first long paragraph.

1. **Action or answer first.** The line under a page title starts with a verb and says what the reader does or gets ("Enter your pay to see…"). In any explanation, the result comes before the reasoning.
2. **Points, not paragraphs.** Explanatory text is a `<ul class="points">`; each item is `<strong>Two to five word lead.</strong>` then one or two sentences. No paragraph longer than two sentences anywhere.
3. **Five at most.** No more than five points, options or links in one visible group. Split a longer set under a second short heading, or cut the weakest. Data tables and quick-pick buttons are exempt.
4. **One idea per sentence**, about 20 words at most. Steps the reader must take in order are a numbered list.
5. **Literal words only.** No idioms or figures of speech ("the catch is", "does the heavy lifting", "wipe out", "a map of your money").
6. **Concrete figures, not adjectives.** Replace "far more" or "a lot" with the number, but only a number that code or a data file produces. If there is none, drop the adjective.
7. **No empty hedges or filler** ("simply", "really", "of course", "it is worth noting"). Keep hedges that carry real uncertainty, and keep every "unverified" tag and source.
8. **Warnings state the cause, then the fix.** No "oops" or "unfortunately".
9. **One next step at the end.** The "Next:" link is the only closer; do not add summaries or sign-offs.
