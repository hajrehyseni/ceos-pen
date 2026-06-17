# Less Is More + Scorecard Always Attached

Two changes: (1) trim mobile UX to the essentials, (2) guarantee the AI Readiness Scorecard link appears on every post by default.

## Part 1 — Scorecard attached by default

Today the scorecard link is optional: a CTA is only picked from `cta_library` when one exists, and `hard_cta_ratio` (0.4) decides body-vs-first-comment. If no CTA is enabled, posts ship with no link at all.

Change the contract so every post carries the link, naturally placed.

### Backend (`supabase/functions/generate-draft/index.ts`)

- Define a **default scorecard CTA** as a constant in the function:
  ```
  DEFAULT_SOFT_CTA = "If you want to see how ready your business actually is for AI, the Build to Certify scorecard takes 4 minutes: https://build.londonra.com"
  DEFAULT_HARD_CTA_HINT = "End with a one-line nudge to the Build to Certify scorecard at https://build.londonra.com — Hajrë's voice, not salesy, framed as the obvious next step."
  ```
- After `selectedCta = pickCta(...)`, if it returns `null`, fall back to a synthesized one with `cta_type` driven by `hard_cta_ratio` and copy from the defaults above. Result: `selectedCta` is **never null**.
- Keep the soft-vs-hard logic intact (soft = first comment, hard = in body). This way every draft has the link in one of the two slots.
- After the model writes the draft, **post-process guarantee**: if `ctaMode === "hard"` and the body does not contain `londonra.com`, append a single graceful line with the link before save. If `ctaMode === "soft"` and `first_comment_text` is empty, set it to `DEFAULT_SOFT_CTA`. This guards against the model ignoring instructions.

### Auto-publish (`supabase/functions/auto-publish/index.ts`)

- Already reads `lead_magnet_url` and posts the first-comment when `auto_first_comment` is on. Add a safety net: if `first_comment_text` is null AND the body does not contain `londonra.com`, set the first comment to `DEFAULT_SOFT_CTA` at publish time so no post ever ships link-less.

### UI signal (`src/components/mobile/HeroDraftCard.tsx`, `src/components/DraftCard.tsx`)

- Add a small badge: **"Scorecard: in body"** or **"Scorecard: first comment"** so the CEO sees at a glance where the link lives. Green when present, amber if somehow missing (should be impossible post-fix).
- Remove the four lead-magnet **Quick Tweak** buttons (`add_natural_lead_magnet`, `add_softer_lead_magnet`, `less_salesy_cta`, `add_lead_magnet_first_comment`) — the link is now automatic; keep only the tone tweaks. The "Less salesy CTA" tweak stays as the one way to soften an over-eager nudge.

## Part 2 — Less is more (mobile UX trim)

The Today screen is doing its job but it's still busy. Cut the noise.

### Header (`src/components/HeaderBar.tsx`)

- Drop the **pillar label** from the header — it's already implicit in the hero draft. Header becomes: **CEO Pen** · [+New] · [⚙︎]. That's it.
- Drop the `/5` weekly counter from the header — it lives better in Analytics. Frees up real estate.

### Cost strip (`src/components/mobile/CostStrip.tsx`)

- Keep three numbers but lighten: remove the trend arrow + percent (% noise the CEO rarely needs in the first glance). Tap-to-expand sheet still shows the breakdown including week-over-week.

### Hero draft card (`src/components/mobile/HeroDraftCard.tsx`)

- Remove the "← Swipe →" hint — replace with subtle 0.5s shake on first card load only, then never shown again (sessionStorage flag). Trust the gesture.
- Remove the `1 / 105` position counter from the section header — replace with a single line under the card: **"3 more queued"** when relevant, hidden when only one draft.
- Collapse the action bar from 4 buttons to **3**: **Reject · Open · Approve** (the Visual button is redundant — Visual Studio is inside the Open modal). Approve grows to fill the saved space and becomes the obvious primary.
- Verified + score row stays but smaller (single inline pill: "✓ 8.8 verified").

### AI News (`src/components/mobile/CompactNewsList.tsx`)

- Show **3 items only**, no heat-score number column (rank is implicit in order). Title + 1-line summary. Tap a row → opens the source. Tap the section header chevron → opens the full sheet with all items.

### Reply Assistant trigger

- Remove the Reply Assistant card from the Today scroll. Move it to a **discreet floating pill** anchored above the bottom tab bar, only visible when the user scrolls past the news (or always-on with low opacity). Reduces vertical stack by one item.

### Agent status footer

- Keep the one-line footer. Remove the relative-time math complexity in the visible string: show just **"Last 12m · Next 19:00"** (no "ago" / "in"). Tap to expand stays.

### Spacing pass

- Increase outer padding from 12px to 16px between cards. Fewer items, more breathing room.

## Files

Edited:
- `supabase/functions/generate-draft/index.ts` — guarantee selectedCta + post-process link safety net
- `supabase/functions/auto-publish/index.ts` — first-comment fallback at publish time
- `src/components/HeaderBar.tsx` — strip pillar + weekly counter
- `src/components/mobile/CostStrip.tsx` — drop trend arrow
- `src/components/mobile/HeroDraftCard.tsx` — 3-button action bar, scorecard badge, drop swipe hint + counter
- `src/components/mobile/CompactNewsList.tsx` — drop heat number, 3 items
- `src/components/mobile/AgentStatusFooter.tsx` — tighten label
- `src/components/DraftCard.tsx` — remove 4 lead-magnet tweak buttons, add scorecard badge
- `src/pages/Index.tsx` — remove inline Reply Assistant card, add floating reply pill component

New:
- `src/components/mobile/ReplyPill.tsx` — floating, opens the existing ReplyAssistant sheet

No new dependencies. No schema changes.

## Definition of done

- Every newly generated draft has the scorecard link, either in body or set on `first_comment_text`. Visible as a green "Scorecard: in body" / "Scorecard: first comment" badge on each draft.
- Today screen on 390×844: header (52px) + cost strip + hero + 3 news + footer = no scroll needed to see all five blocks comfortably.
- No more than 3 action buttons under the hero card.
- Quick Tweaks shrink from 8 to 4 (humour, fun, less corporate, sound like Hajrë, less salesy CTA = 5; drop the four lead-magnet ones).
- Smoke test: generate a draft, confirm scorecard badge shows; publish to LinkedIn, confirm first comment carries the link when soft mode.
