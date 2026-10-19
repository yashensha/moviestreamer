# 🔤 MovieWatcher Typography Design System: Netflix Sans

> **Standard:** Official Brand Typography Guidelines & Token Rules  
> **Font Family:** `Netflix Sans`  
> **Source Directory:** `public/fonts/` (and archived original in `netflixfonts/`)  
> **Formats:** WOFF2 (Web Open Font Format 2.0 with Brotli compression)

---

## 📌 Executive Overview

MovieWatcher utilizes **Netflix Sans** across the entire web application to provide an authentic, cinematic streaming experience. The typography system balances high-impact visual hierarchy for media discovery with effortless legibility for metadata, synopsis copy, and navigation.

---

## 📦 Font Assets & Weight Mapping

The typography stack is served locally from `public/fonts/` without external third-party dependencies, guaranteeing zero-latency rendering and privacy:

| Font Asset File | Weight Range | Standard Token | CSS `font-weight` | Recommended Usage |
| :--- | :--- | :--- | :--- | :--- |
| `NetflixSans_W_Lt.woff2` | Light | `font-light` | `300` | Delicate metadata, film taglines, runtime details, footer notes |
| `NetflixSans_W_Md.woff2` | Regular | `font-normal` | `400` | Narrative synopsis, overview paragraphs, form placeholder text |
| `NetflixSans_W_Md.woff2` | Medium | `font-medium` | `500` | Standard UI labels, interactive links, episode list items, button text |
| `NetflixSans_W_Bd.woff2` | SemiBold | `font-semibold` | `600` | Subheadings, card titles, table headers, active tab indicators |
| `NetflixSans_W_Bd.woff2` | Bold | `font-bold` | `700` | Section category titles, modal headers, filter pill active states |
| `NetflixSans_W_Bd.woff2` | ExtraBold / Black | `font-black` / `font-extrabold` | `800` / `900` | Hero billboard titles, primary streaming CTAs, match percentages |

---

## 📐 Typography Hierarchy & Utility Classes

In addition to standard Tailwind font classes (`font-light`, `font-normal`, `font-medium`, `font-semibold`, `font-bold`, `font-black`), the design system provides pre-configured typographic hierarchy tokens in `src/index.css`:

### 1. Hero Billboard Title (`.type-hero`)
* **Styles:** `font-weight: 800; letter-spacing: -0.035em; line-height: 1.05;`
* **Tailwind Equivalent:** `text-4xl md:text-6xl font-black tracking-tight`
* **Application:** Netflix billboard hero titles, featured premiere title treatments.

### 2. Category & Row Display Headings (`.type-display`)
* **Styles:** `font-weight: 700; letter-spacing: -0.02em; line-height: 1.2;`
* **Tailwind Equivalent:** `text-xl md:text-2xl font-bold tracking-tight text-white`
* **Application:** Horizontal media rows ("Trending Now", "Tailored For You", "Top 10 Today").

### 3. Modal & Card Titles (`.type-title`)
* **Styles:** `font-weight: 600; letter-spacing: -0.015em; line-height: 1.3;`
* **Tailwind Equivalent:** `text-base md:text-lg font-bold text-white`
* **Application:** Media card hover states, video player modal titles, detail slide-over headings.

### 4. Body & Narrative Text (`.type-body`)
* **Styles:** `font-weight: 400 / 500; letter-spacing: normal; line-height: 1.5;`
* **Tailwind Equivalent:** `text-sm text-zinc-300 font-normal leading-relaxed`
* **Application:** Synopsis descriptions, review blurbs, settings explanations.

### 5. Metadata & Taglines (`.type-caption`)
* **Styles:** `font-weight: 300; letter-spacing: 0.01em; line-height: 1.4;`
* **Tailwind Equivalent:** `text-xs text-zinc-400 font-light`
* **Application:** Release years, content ratings (PG-13 / TV-MA), runtime, director credits, italicized taglines.

### 6. Badges & Micro-Pills (`.type-badge`)
* **Styles:** `font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase;`
* **Tailwind Equivalent:** `text-[10px] font-bold uppercase tracking-wider`
* **Application:** "4K ULTRA HD", "TOP 10", "NEW EPISODE", Letterboxd match percentages.

---

## ⚡ Performance & Preloading Strategy

To eliminate FOIT (Flash of Invisible Text) and FOUT (Flash of Unstyled Text):

1. **Vite Direct Servicing:** Fonts are housed in `public/fonts/` so they are immediately available at root path `/fonts/*` without bundler hashing delays.
2. **HTML Head Preload:** Key weights are declared with `<link rel="preload">` in `index.html`:
   ```html
   <link rel="preload" href="/fonts/NetflixSans_W_Md.woff2" as="font" type="font/woff2" crossorigin>
   <link rel="preload" href="/fonts/NetflixSans_W_Bd.woff2" as="font" type="font/woff2" crossorigin>
   <link rel="preload" href="/fonts/NetflixSans_W_Lt.woff2" as="font" type="font/woff2" crossorigin>
   ```
3. **CSS `@font-face` with `font-display: swap`:** Ensures instant paint with system fallback if network is constrained.

---

## 🚫 Anti-Patterns & Rules

1. **NO Serif Fonts for Taglines:** Never use `font-serif` or Times/Georgia for movie taglines. Always use `Netflix Sans` light italic (`font-light italic text-zinc-400`).
2. **NO Generic System Fonts:** The global default font family is set to `'Netflix Sans', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;`.
3. **Monospace Exception:** Monospace (`font-mono`, backed by JetBrains Mono) is strictly reserved for TMDB IDs, backend hashes, and developer diagnostic counters.
