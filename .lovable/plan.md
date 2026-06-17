## CEO Pen — UX, Branding, Scorecard & Layout Overhaul

A focused pass across backend, mobile, desktop, branding, AI News, CTA UX and Visual Studio. Scope is large but each section is concrete.

---

### 1. Scorecard URL guarantee (backend + UI + publish)

**Constant + helper** (`supabase/functions/_shared/scorecard.ts` — new):
```ts
export const SCORECARD_URL = "https://build.londonra.com";
export const DEFAULT_SOFT_CTA = `If you want to see how ready your business actually is for AI, the Build to Certify scorecard takes 4 minutes: ${SCORECARD_URL}`;
export const DEFAULT_HARD_CTA = DEFAULT_SOFT_CTA;
export function normaliseScorecardUrl(text?: string | null): string {
  if (!text) return text ?? "";
  // strip protocol-less first to avoid double https://
  return text
    .replace(/https?:\/\/build\.londonra\.com/gi, SCORECARD_URL)
    .replace(/(?<!https?:\/\/)build\.londonra\.com/gi, SCORECARD_URL);
}
export function ensureScorecard(body: string, firstComment: string | null, ctaMode: "soft"|"hard") {
  body = normaliseScorecardUrl(body);
  firstComment = normaliseScorecardUrl(firstComment);
  const inBody = body.includes(SCORECARD_URL);
  const inComment = !!firstComment && firstComment.includes(SCORECARD_URL);
  if (!inBody && !inComment) {
    if (ctaMode === "hard") body = `${body.trim()}\n\n${DEFAULT_HARD_CTA}`;
    else firstComment = DEFAULT_SOFT_CTA;
  }
  return { body, firstComment };
}
```

**Apply in `generate-draft/index.ts`** after model output, before insert.
**Apply in `auto-publish/index.ts`** and `publish-to-linkedin/index.ts` before push — final safety net.

**Client mirror** in `src/lib/scorecard.ts`: same `SCORECARD_URL`, `normaliseScorecardUrl`, `detectScorecard(post) → { location: "body"|"first_comment"|"missing" }`.

**UI badge**: `ScorecardBadge` component shows green pill with location, or amber "Scorecard missing" + "Attach scorecard" button that sets `first_comment_text = DEFAULT_SOFT_CTA` via supabase update.

**Verification**: after edits, generate 10 drafts via `supabase--read-query` SELECT on most recent 10 and assert presence; report counts.

---

### 2. Layout: split mobile and desktop

Add `useIsDesktop()` check at `Index.tsx` and branch:

```text
Mobile (<768px)              Desktop (>=1024px)
────────────────────         ──────────────────────────────
Header                       Left col (300px)
Greeting                     ├─ Draft queue list
Hero draft (compact)         └─ AI News (compact)
[Reject][Open][Approve]      Main col (flex)
AI News (3)                  ├─ Selected draft full
Bottom tabs                  ├─ First comment block
                             ├─ Scorecard panel
                             └─ Action bar
                             Right col (320px)
                             ├─ Visual Studio tabs
                             ├─ Scores
                             └─ Agent status
```

Hero card strips: `1/105`, swipe text, big metadata. Keep pill, verified, hook (first 2 lines), scorecard badge, 3 buttons.

`OpenDraftSheet.tsx` for mobile full-screen, reused as right-panel content on desktop. New `DesktopLayout.tsx` orchestrates 3-column grid.

---

### 3. Branding refinement

- Drop Caveat entirely (greeting in Fraunces 28px ink).
- Show 3 logo directions via design--create_directions? No — user said "show options before finalising". Use a small in-app `LogoPicker` is overkill; instead implement **Premium Wordmark** (Fraunces semibold, full-stop accent in Ink Indigo) as default, keep `CeoPenGlyph` as CP monogram for favicon/splash. Cursor variant available as optional `CeoPenCursor.tsx` for splash. State this in reply and let user request swap.
- Theme tightening in `index.css`: bg `#0B0B0F`, surface `#15151B`, hairline `#222230`, single accent Ink Indigo `#6366F1`, success `#10B981`, danger `#EF4444`. Remove glows.

---

### 4. AI News editorial feed

- Today: 3 items, `NewsRow` shows title (15px serif), one-line summary, source · credibility · share-worthiness chips.
- Full sheet `NewsDetailSheet.tsx`: 10 items, each expandable to {why it matters, CEO angle, suggested hook, visual idea, scorecard angle, source link}. "Generate" menu → text / carousel / image / poll / infographic — all routed through existing generate functions with `seed_news_id` param so scorecard injection still runs.

---

### 5. CTA panel inside Open modal

`CtaPanel.tsx` shows: placement chip, current CTA text (truncated), quality auto-assessed (`tone-tune` heuristic or simple length/keyword check client-side first), buttons: Soften CTA, Move to first comment, Move to body. Soften calls `tone-tune` edge fn with prompt `soften this CTA`.

---

### 6. Visual Studio inside Open modal

Replace `VisualStudio` dialog with inline `VisualStudioPanel` rendered inside `OpenDraftSheet`. Tabs: Carousel, Image, Infographic, Poll, Reply, Chart. Each empty state matches spec copy. Create / Preview / Copy / Export / Retry per asset; rely on existing `useVisualAsset` hook.

---

### 7. Microcopy

Centralise in `src/lib/copy.ts`. Replace existing strings across HeroDraftCard, OpenDraftSheet, CompactNewsList, AgentStatusFooter, error toasters.

---

### 8. Verification (definition of done)

1. Run `supabase--read-query` to confirm last 10 drafts have URL.
2. Drive Playwright at 390×844 → screenshot Today.
3. Playwright at 1440×900 → screenshot Desktop.
4. Open one draft → screenshot Open modal with CTA panel + Visual Studio visible.
5. Trigger `generate-draft` 10x via curl `supabase--curl_edge_functions`, requery, assert all 10 contain `https://build.londonra.com`.

Report screenshots + counts before claiming done.

---

### Files

**New**
- `supabase/functions/_shared/scorecard.ts`
- `src/lib/scorecard.ts` (replace existing)
- `src/lib/copy.ts`
- `src/components/ScorecardBadge.tsx`
- `src/components/CtaPanel.tsx`
- `src/components/OpenDraftSheet.tsx`
- `src/components/VisualStudioPanel.tsx`
- `src/components/DesktopLayout.tsx`
- `src/components/mobile/NewsRow.tsx`
- `src/components/NewsDetailSheet.tsx`
- `src/components/brand/CeoPenWordmark.tsx`

**Edit**
- `supabase/functions/generate-draft/index.ts`
- `supabase/functions/auto-publish/index.ts`
- `supabase/functions/publish-to-linkedin/index.ts`
- `src/pages/Index.tsx`
- `src/components/HeaderBar.tsx`
- `src/components/mobile/HeroDraftCard.tsx`
- `src/components/mobile/CompactNewsList.tsx`
- `src/components/mobile/BottomTabBar.tsx`
- `src/components/visual-studio/VisualStudio.tsx` (thin re-export of panel)
- `src/components/DraftCard.tsx`
- `src/index.css`
- `tailwind.config.ts`
- `index.html`, `public/favicon.svg`

**Remove**
- `@fontsource/caveat` from `package.json` / `main.tsx`
- `src/components/brand/CeoPenMark.tsx` (Caveat signature)

---

### Out of scope

- No new database tables; existing `posts.first_comment_text` is sufficient.
- No edge function `verify_jwt` changes.
- No new secrets — `https://build.londonra.com` is hardcoded as a public URL.
