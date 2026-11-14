# Feature Specification: Anti-Slop CMD-K Search Experience

## 1. Overview & Problem
The current CMD-K command palette features screaming all-caps text, broken image icons caused by stale TMDB profile paths, flat comma-separated text lists for actor/director works, and lacks visual hierarchy. 

## 2. Core Experience & 5-Second "Time to Aha"
When a user searches for a name (or discovers creators in spotlight):
1. **Celebrity Spotlighted First:** The closest person matches appear at the very top of the search results, capped strictly at the **top 2** closest matches.
2. **In-Card Work Previews:** Each celebrity card embeds 2–3 of their signature acted/directed titles with real mini posters, release years, and rating badges.
3. **Dual Actionability:**
   - Clicking a movie chip navigates directly to that movie (`/movie/:id` or `/tv/:id`).
   - Clicking the celebrity or "View Filmography →" navigates to the dedicated person page (`/person/:id`).
4. **Resilient Avatars:** Zero broken image icons. Graceful monogram fallback (e.g. `CN` for Christopher Nolan) on load errors or missing photos.
5. **Anti-Slop Aesthetics:** Restrained typography (title case), razor-thin `zinc-800` borders, `4px` sharp radii, dark tactical surface (`#0d0d0f`), and smooth keyboard/mouse interactions.

## 3. Scope & Non-Negotiables
- Respects `specs/MUST_NOT_TRADE_OFF.md`: CLS = 0, WCAG 2.2 AA keyboard focus states, graceful degradation on network drops.
- Keyboard navigation: Arrow keys navigate between items, Enter activates selection, Esc dismisses modal.

