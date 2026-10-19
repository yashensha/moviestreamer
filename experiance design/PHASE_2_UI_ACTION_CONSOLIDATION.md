# 🎛️ Phase 2: UI Action Consolidation — The Media Action Dock

> **Status:** Specification Complete — Ready for Review & Approval  
> **Benchmark Reference:** [docs/ux.md: Lesson #1 & Lesson #3](file:///d:/CODE/moviewatcher/docs/ux.md) — *"Make your CTA prominent and clear... reduce the number of decisions between arriving and watching."*

---

## 1. The Hick's Law Problem in Current Title Views

Currently, on both `InnerDetailPage.tsx` and card hover overlays, users are confronted with 4 separate, visually competing square buttons:

```
[ Current Implementation — High Cognitive Friction ]
┌──────────────┐  ┌─────────────┐  ┌──────────────┐  ┌────────┐
│ ★ Rate 5★    │  │ 🔖 Watchlist│  │ ✓ Watched    │  │ ❤️ Like │
└──────────────┘  └─────────────┘  └──────────────┘  └────────┘
```

### Usability Failures Identified:
1. **Ambiguous Relationships:** Users don't know whether "Watched" automatically adds a "Like", or whether "Rate 5★" automatically marks it "Watched".
2. **Context Disruption:** Clicking "Rate 5★" interrupts viewing by opening a full-screen blocking modal (`StarRatingModal.tsx`), forcing users to click through overlay dialogs just to submit a rating.
3. **No Clear Hierarchy:** The primary action (streaming or resuming playback) is visually crowded out by tertiary administrative buttons.

---

## 2. The Solution: The Unified Media Action Dock

We consolidate all media actions into an elegant, unified control dock featuring strict visual hierarchy: **One Prominent Primary Action** + **One Contextual Secondary Pill**.

```
[ New Refined Media Action Dock ]
┌────────────────────────────────────────────────────────────────────────────────────────┐
│  ▶ Resume S2:E4 (34m left)  │  ＋ My List  │  ✓ Watched [4.5★] ▾  │  ♥ Like            │
│  (Primary Streaming CTA)    │  (Toggle)    │  (1-Tap + Inline Pop)│  (Affinity Booster)│
└────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## 3. Component Architecture & Detailed States

### A. Primary Action: Context-Aware Streaming Trigger
The primary button dynamically adapts to the user's exact state:

| Condition | Label | Visual Styling | Action |
| :--- | :--- | :--- | :--- |
| **Never Started** | `▶ Play Film` or `▶ Start Series` | Solid `#E50914` (Netflix Red), bold white text, subtle hover lift. | Opens stream at beginning. |
| **In Progress (TV)** | `▶ Resume S{season}:E{episode}` | Solid `#E50914`, accompanied by a 2px bottom progress bar indicating % watched. | Resumes exact episode and timestamp. |
| **In Progress (Movie)** | `▶ Resume ({remainingMinutes}m left)` | Solid `#E50914` with progress bar. | Resumes playback position. |
| **Completed** | `↺ Watch Again` | Translucent `#E50914`/20 with red border. | Re-plays from start. |

### B. Secondary Cluster: The Unified Utility Pill
A sleek segmented pill container (`bg-zinc-900/90 border border-zinc-800/80 backdrop-blur-md rounded-full`):

#### 1. `+ My List` (Watchlist Toggle)
- **Default State:** `＋ My List` with subtle zinc icon.
- **Active State:** `✓ In List` with smooth icon morph and soft white text.
- **Feedback:** 800ms unobtrusive toast notification in bottom corner.

#### 2. `Watched & Inline Rating` (Zero-Modal Popover)
- **1-Tap Action:** Clicking the checkmark immediately marks the title as watched (adding it to watch history and updating recommendation weights).
- **Inline Micro-Popover (Hover / Long Press / Click Caret `▾`):**
  - Instead of launching a blocking modal dialog, a floating glass popover opens directly below the button.
  - Presents a horizontal strip of 5 interactive stars supporting half-star increments (0.5★ to 5.0★) with instant click-to-save.
  - Automatically syncs to Letterboxd rating format without leaving the video player context.

```
                  ┌──────────────────────────────┐
                  │ ★ ★ ★ ★ ☆  [ 4.0 ★ Great ]   │
                  │  Letterboxd rating synced    │
                  └──────────────▲───────────────┘
                                 │
[ ▶ Resume S2:E4 ]  [ ＋ My List │ ✓ Watched (4.0★) ▾ ]  [ ♥ ]
```

#### 3. `♥ Like` (Algorithmic Affinity Booster)
- Single-tap heart with spring animation.
- Communicates instant feedback: *"Added to your Taste DNA; similar titles will appear in Top Picks."*

---

## 4. Responsive Adaptation

| Viewport | Layout Strategy |
| :--- | :--- |
| **Desktop (`>1024px`)** | Full horizontal bar positioned directly under title logo in `InnerDetailPage.tsx` and on hero banners. |
| **Tablet (`768px - 1024px`)** | Primary button spans top row; secondary utility pill spans directly below. |
| **Mobile (`<768px`)** | Fixed bottom dock with thumb-friendly primary `Play / Resume` button (minimum 48px height) and quick-action icon buttons. |

---

## 5. Keyboard Navigation & Accessibility (WCAG 2.1 AA)

- **Keyboard Shortcuts:**
  - `Space` / `P`: Play / Resume
  - `L`: Toggle My List
  - `W`: Mark Watched
  - `R`: Open Quick-Rating Popover
  - `H`: Toggle Like
- **Aria Attributes:**
  - `role="toolbar"` for the action dock.
  - Explicit `aria-label="Resume Season 2 Episode 4"` on primary streaming trigger.
  - `aria-expanded="false"` on the inline rating popover trigger.
