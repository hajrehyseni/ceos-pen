
# Visual Studio — tightening pass + smoke test

Most of Wave 4 already shipped last turn (six generators, six previews, exports). This pass tightens it to match your delivery order, swaps the tab strip for a single CTA, adds a visual quality scorer, and runs the smoke test you asked for.

## 1. Single "Create Visual" entry on draft cards

Replace the always-visible Visual Studio collapsible header with one primary button on each draft card:

```
[ Create Visual ]
```

Click → opens a `Dialog` (mobile-friendly sheet on small screens) containing the same six tabs **in your priority order**: Carousel → Poll → Reply → Image → Infographic → Chart. Default tab = Carousel. Closing the dialog leaves the card clean — no NASA control panel.

Files: edit `src/components/DraftCard.tsx`, edit `src/components/visual-studio/VisualStudio.tsx` to render inside a `Dialog`/`Sheet` instead of `Collapsible`, reorder tabs.

## 2. Visual quality scorer (6 dimensions)

New shared edge function `score-visual` (Claude Sonnet 4.5). Every generator calls it after producing the payload and stores the result in `visual_assets.payload.quality`.

Dimensions, each 0–10:
- `mobile_readability` — text size, contrast, line length on a phone
- `visual_clarity` — composition, hierarchy, not overcrowded
- `hook_strength` — first slide / question / overlay grabs attention
- `cta_fit` — does build.londonra.com land naturally (or is it correctly absent)
- `source_confidence` — claims tie back to provided sources, zero fabrication
- `export_readiness` — usable on LinkedIn today without editing

Stored as `{ overall, mobile_readability, ..., notes:[] }`. UI: small badge under each preview — green if `overall ≥ 7`, amber + "needs improvement" pill below 7, with one-line notes expandable.

Files: new `supabase/functions/_shared/visual-scorer.ts`, call it from each `gen-*` function before saving; new `<QualityBadge />` rendered by each preview component.

## 3. CTA discipline

Update the system prompts for `gen-carousel`, `gen-infographic`, `gen-image-post`, `gen-poll` to add the rule explicitly:

> The link `https://build.londonra.com` must appear ONCE, and only where it reads as a useful next step. If it would feel forced (e.g. the post is a pure observation with no relevant offer), omit it entirely. The scorer will mark you down for shoving it in.

Reply assistant already follows this rule.

## 4. Smoke test (after the above ships)

I will pick a real existing draft (most recent `status='draft'` with at least one source), then in one script run:

1. `gen-carousel` → export PDF + PNG zip
2. `gen-poll`
3. `reply-assistant` against a sample LinkedIn comment
4. `gen-image-post`
5. `gen-infographic` → export PNG
6. `gen-chart` — only attempt if the chosen draft has numeric data in its sources; otherwise capture the "no verified data" empty state

For each, I'll:
- save the payload as JSON to `/mnt/documents/visual-studio-smoke/<kind>.json`
- drive Playwright against the running preview, open the draft, click Create Visual, switch to each tab, screenshot the rendered preview at mobile width (390×844)
- save the exported PDF / PNG / ZIP to `/mnt/documents/visual-studio-smoke/exports/`
- write `report.md` with all six quality scorecards, screenshots embedded, files linked via `<presentation-artifact>`

You'll get one summary message with the screenshots and download links so you can judge it from your phone.

## Out of scope

- Replacing the in-app preview with server-side rendered hi-res PNGs (we'll keep client-side `html-to-image` — fast, good enough for LinkedIn).
- Adding an LLM "retry until score ≥ 7" loop (visible badge is enough this round; we'll add auto-retry if scores come back consistently low).

## Files

New:
- `supabase/functions/_shared/visual-scorer.ts`

Edited:
- `supabase/functions/gen-carousel/index.ts`
- `supabase/functions/gen-infographic/index.ts`
- `supabase/functions/gen-image-post/index.ts`
- `supabase/functions/gen-chart/index.ts`
- `supabase/functions/gen-poll/index.ts`
- `src/components/DraftCard.tsx`
- `src/components/visual-studio/VisualStudio.tsx`
- `src/components/visual-studio/CarouselPreview.tsx`
- `src/components/visual-studio/InfographicPreview.tsx`
- `src/components/visual-studio/ImagePostPreview.tsx`
- `src/components/visual-studio/ChartPreview.tsx`
- `src/components/visual-studio/PollPreview.tsx`

New shared component:
- `src/components/visual-studio/QualityBadge.tsx`
