
# CEO Pen — Mobile Refinement & Branding

A focused pass on identity + one-thumb UX. No backend changes. Lead-magnet guarantee already shipped — untouched.

## 1. Brand identity

**Wordmark logo (SVG, hand-built, not generated):**
- New `src/components/brand/CeoPenMark.tsx` — inline SVG: "CEO Pen" set in a signature-style script (Caveat Brush / Reenie Beanie weight, hand-tuned path) with a subtle nib underline tapering off the "n". Two variants:
  - `<Wordmark/>` — full signature for splash/login/about
  - `<Glyph/>` — just the underlined "cp" ligature for header & favicon
- Color: `currentColor` so it inherits theme.
- New favicon + apple-touch-icon generated from the glyph (SVG → `public/favicon.svg`, replace `index.html` link).
- Theme color meta + manifest updated to new indigo.

**Typography pairing** (via `@fontsource`, per platform rules):
- Display / wordmark accents: **Caveat** (signature feel, used sparingly — only logo + section greetings like "Today,")
- UI sans: **Geist** (tighter, more refined than current Inter) — body, buttons, numerals
- Numerals: Geist tabular-nums for cost strip

## 2. Tightened Indigo Command theme

Refine `src/index.css` tokens (HSL only, no hardcoded colors in components):
- `--background` deepened to `#0a0a1a`
- New `--surface-1` (#10102a) and `--surface-2` (#16163a) for card layering instead of flat cards
- `--primary` locked to indigo `#4f46e5`, `--primary-glow` for soft gradients
- New `--hairline` (1px white/6%) replaces heavy borders
- `--gradient-hero` (indigo → navy radial) behind hero card only
- `--shadow-card` softer, `--shadow-pressed` for tap feedback
- Type scale tightened: 12 / 14 / 16 / 20 / 28 / 34, line-heights 1.25 / 1.4
- 4pt spacing grid enforced; safe-area insets respected (`env(safe-area-inset-bottom)`)

## 3. One-thumb mobile UX overhaul

**Hero Draft Card** (`HeroDraftCard.tsx`):
- Full-width swipe with velocity-based threshold (not distance only). Right = approve, Left = reject, Down = snooze to tomorrow.
- Color-coded swipe trail (emerald right, rose left, amber down) revealing icon + label as you drag.
- Long-press anywhere on card = open editor (replaces "Open" button).
- Bottom action tray reduced to 2 large 56px buttons: **Reject · Approve**. Edit moves to long-press, Publish moves into Approve confirmation sheet.
- Haptic-style spring on action (scale 0.97 → 1, 200ms).

**Cost strip** (`CostStrip.tsx`):
- Becomes a single 64px pill with 3 segments separated by hairlines. Tap anywhere → bottom sheet with detail. Removes the "card" feel.

**Compact news** (`CompactNewsList.tsx`):
- Each item full-width tappable row with chevron; horizontal swipe-left reveals "Use as draft seed" action.

**Bottom tab bar** (`BottomTabBar.tsx`):
- Reduced to 4 tabs, 64px tall, safe-area aware. Active state = indigo glow under icon (not full pill). Center "+" floating action button (56px) for "New draft" — thumb-zone primary action.

**Reply pill** (`ReplyPill.tsx`):
- Moves from floating-above-tabs to a slot inside the FAB long-press menu (cleaner, fewer floating things).

**Pull-to-refresh** on Today view → re-runs research agent.

**Page transitions**: framer-motion shared layout, 200ms ease-out for view switches.

## 4. Section greeting + density

`Index.tsx`:
- Replace generic "Today" header with time-aware greeting in Caveat: "Morning, Hajrë." / "Evening, Hajrë." — 28px, single line, sets editorial tone.
- Beneath: tiny meta line (date · pillar · drafts-ready count) in 12px muted.
- Section labels reduced to 11px uppercase tracked hairlines instead of bold headings.

## 5. Files

**New:**
- `src/components/brand/CeoPenMark.tsx`
- `src/components/brand/Glyph.tsx`
- `public/favicon.svg` (replaces .ico reference)

**Edited:**
- `src/index.css` (token overhaul)
- `tailwind.config.ts` (font families, spacing, shadows)
- `src/main.tsx` (fontsource imports)
- `index.html` (favicon, theme-color, apple-touch)
- `src/components/HeaderBar.tsx` (use Glyph)
- `src/components/mobile/HeroDraftCard.tsx` (gesture overhaul)
- `src/components/mobile/CostStrip.tsx` (pill form)
- `src/components/mobile/CompactNewsList.tsx` (row form + swipe action)
- `src/components/mobile/BottomTabBar.tsx` (FAB + tighter)
- `src/components/mobile/ReplyPill.tsx` (folded into FAB menu)
- `src/pages/Index.tsx` (greeting, density)

**Dependencies:** `@fontsource/caveat`, `@fontsource/geist-sans`.

## 6. Out of scope (won't touch)

- Backend / edge functions / scorecard logic (already correct)
- Desktop layout (mobile-first pass only)
- DB schema, auth, integrations
