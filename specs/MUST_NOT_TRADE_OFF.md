# Non-Negotiables: MUST NOT TRADE OFF

Priority hierarchy is strictly linear. If two requirements conflict, the higher-numbered priority loses unconditionally.

## 1. Security & Privacy
- Zero leakage of private user history or account credentials.
- TMDB API keys and authentication tokens must be sanitized; never log sensitive data to the browser console.
- Safe third-party API consumption with input sanitization.

## 2. Data Integrity
- Atomic state updates in `useStreamStore` and Cloudflare D1/KV sync.
- Deduplication: never allow duplicate movie IDs to enter recommendation sets or candidate lists.
- Strict negative filtering: films rated $\le 2.5\star$ or explicitly disliked must never be recommended under any circumstances.

## 3. Availability & Latency
- Strict 5-second timeout on all third-party TMDB API queries.
- Graceful degradation: if network or TMDB API fails, recommendations fallback instantly to local cached top lists (Letterboxd Top 500, IMDb Top 200) without crashing the UI.
- All candidate scoring and graph traversal computations must run client-side in sub-100ms.

## 4. User Experience & Visual Consistency
- Zero Cumulative Layout Shift (CLS = 0) with dimension-matching skeleton loaders.
- Composed empty states for new users with zero watch history (Bayesian cold-start recommendations).
- Zero `alert()` or browser popups; all feedback via subtle toasts or glass modal cards.
- Every recommendation row must provide clear, human-understandable attribution (e.g., *"Directed by Christopher Nolan"*, *"Shared Theme: Mind-Bending Sci-Fi"*).

## 5. Accessibility
- WCAG 2.2 AA standards: visible focus rings, aria-labels on interactive media cards, keyboard navigable carousel rows.

