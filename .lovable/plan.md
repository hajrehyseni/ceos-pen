
# Visual Studio — Wave 4 (real assets, not just buttons)

Goal: every draft card gets an expandable **Visual Studio** with six tabs that produce **visible, previewable, exportable** assets — mobile-first, swipeable, downloadable as PNG/PDF, copyable as text. No fabricated facts, no fake screenshots, no auto-publish.

## 1. Data model (one migration)

New tables, all RLS-enabled with the standard grants:

- `visual_assets` — one row per generated asset
  - `id`, `post_id` (fk posts, nullable for reply assistant), `kind` (`carousel|infographic|image_post|chart|poll|reply`), `payload jsonb`, `status` (`generating|ready|failed`), `error text`, `created_at`, `updated_at`
- `reply_drafts` — `id`, `source_text`, `variants jsonb` (short/thoughtful/witty/disagree/lead/dm), `created_at`

`payload` shape per kind:
- carousel: `{ slides: [{n, headline, body, visual_direction, icon_hint}], cta_slide, caption, sources[] }`
- infographic: `{ title, blocks: [{icon, label, value, note}], caption, sources[] }`
- image_post: `{ concept, overlay_text, style, image_prompt, caption, first_comment, risk_notes }`
- chart: `{ type: bar|line|comparison|ranking, title, data:[{label,value,series?}], unit, sources[] }` — or `{ insufficient_data: true }`
- poll: `{ question, options[4], caption, follow_up_comment, reply_strategy, cta }`

## 2. Edge functions (one per kind, Claude Sonnet 4.5, all use existing sanitiser + voice rules)

- `gen-carousel` — 6–8 slides, last slide = soft CTA to build.londonra.com, British-warm tone, no fake numbers
- `gen-infographic` — title + 3–5 blocks + sources from `news_items`/`trend_radar` referenced in the post
- `gen-image-post` — concept, overlay text (≤6 words), style, full image prompt, caption, first comment, risk notes
- `gen-chart` — requires verified numeric data: pulls from `news_items.facts`/`trend_radar.metrics` or accepts user-pasted data. If neither present → returns `{ insufficient_data: true }` so UI shows the "create conceptual visual instead?" prompt
- `gen-poll` — question + 4 options + caption + follow-up + reply strategy + optional CTA
- `reply-assistant` — takes pasted post/comment, returns 6 variants

Each writes a `visual_assets` row (status `generating` → `ready`) so the UI can poll/subscribe.

## 3. Frontend — `src/components/visual-studio/`

`VisualStudio.tsx` mounts inside `DraftCard.tsx` as a `<Collapsible>`. Tabs use existing shadcn `Tabs`. Each tab has: empty state → Generate button → loading skeleton → preview → export/copy actions.

Components:
- `CarouselPreview.tsx` — uses existing `ui/carousel` (embla) in 9:16 portrait frame, swipeable, slide counter. Renders each slide to an offscreen `<div>` and uses `html-to-image` → PNG (zip via `jszip`) and `jspdf` for the PDF.
- `InfographicPreview.tsx` — vertical 1080×1920 SVG/HTML composition, lucide icons, source panel, export PNG via `html-to-image`.
- `ImagePostPreview.tsx` — square card mock showing overlay text on a placeholder gradient, prompt block with copy button, caption + first comment blocks.
- `ChartPreview.tsx` — `recharts` (already in deps) bar/line/comparison/ranking; "paste your data" textarea fallback; export PNG via `html-to-image`; source links list. If `insufficient_data`, shows the prompt to switch to conceptual visual (routes to image-post tab).
- `PollPreview.tsx` — LinkedIn-style poll mock, copy buttons for caption + follow-up + strategy.
- `ReplyAssistant.tsx` — textarea + Generate, then 6 labelled reply cards each with copy button. Lives in the same Visual Studio (post-scoped) and also as a standalone entry in the sidebar for ad-hoc use.

Shared:
- `useVisualAsset(postId, kind)` hook — fetch latest, subscribe to realtime updates, trigger generation.
- `exportNode(node, filename)` helper wrapping `html-to-image`.
- All previews wrapped in a `max-w-[420px] mx-auto` mobile frame so the studio is phone-shaped even on desktop.

## 4. Dependencies to add

`html-to-image`, `jspdf`, `jszip`. (`recharts`, `embla-carousel-react`, `lucide-react` already present.)

## 5. Safety rails (carried over from Wave 3)

- All generated text routed through `_shared/content-sanitize.ts` (no em-dashes, no markdown, no hashtags).
- Carousel/infographic/poll generators reuse the voice scorer; assets below 7.0 are flagged with a "Regenerate" hint but still shown.
- Chart generator hard-blocks fabricated numbers — only renders if data has a source URL.
- Nothing publishes to LinkedIn. Export = local download only.

## 6. Out of scope (this wave)

- Real AI image rendering inside the app (we ship the prompt + preview mock; image generation hook can be added next wave).
- Server-side PDF rendering (client-side `jspdf` is enough for 6–8 slides).
- Analytics on visual asset usage.

## Files

New:
- `supabase/migrations/<ts>_visual_assets.sql`
- `supabase/functions/gen-carousel/index.ts`
- `supabase/functions/gen-infographic/index.ts`
- `supabase/functions/gen-image-post/index.ts`
- `supabase/functions/gen-chart/index.ts`
- `supabase/functions/gen-poll/index.ts`
- `supabase/functions/reply-assistant/index.ts`
- `src/components/visual-studio/VisualStudio.tsx`
- `src/components/visual-studio/CarouselPreview.tsx`
- `src/components/visual-studio/InfographicPreview.tsx`
- `src/components/visual-studio/ImagePostPreview.tsx`
- `src/components/visual-studio/ChartPreview.tsx`
- `src/components/visual-studio/PollPreview.tsx`
- `src/components/visual-studio/ReplyAssistant.tsx`
- `src/components/visual-studio/useVisualAsset.ts`
- `src/components/visual-studio/exportNode.ts`

Edited:
- `src/components/DraftCard.tsx` — mount `<VisualStudio postId={…} />`
- `src/components/SidebarPanel.tsx` — add standalone Reply Assistant entry
- `src/types/database.ts` / `src/integrations/supabase/types.ts` — regenerated

After build I'll run a smoke test: generate one of each asset on a real draft, export the carousel PDF + slide PNGs, export the infographic PNG, and screenshot the mobile preview to confirm it's truly swipeable and readable.
