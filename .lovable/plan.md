# CEO Pen — Mobile UX Redesign

Goal: a Today screen the CEO and team look forward to opening on a phone. One clear hero, swipe to act, key numbers visible without scrolling.

## Screen order (Today tab)

```
┌────────────────────────────────────┐
│  CEO Pen          ⚙︎  ＋New        │  ← slim header (44px)
├────────────────────────────────────┤
│  TODAY    WEEK    MONTH            │
│  $0.42    $2.10   $7.85   ▲ 12%    │  ← three-up cost strip (tap → detail)
├────────────────────────────────────┤
│  ╭──────────────────────────────╮  │
│  │ DRAFT OF THE DAY · Pillar     │  │  ← hero draft card (swipeable)
│  │ "Hook line, big, 22px…"      │  │     swipe →  Approve
│  │ 3 lines of preview            │  │     swipe ←  Reject
│  │ [Open] [Visual] [Publish]     │  │
│  ╰──────────────────────────────╯  │
│  • • ○ ○   (2 more drafts queued)  │
├────────────────────────────────────┤
│  AI NEWS · 5 fresh                 │
│  ─ Item 1 (headline + 1 line)     │
│  ─ Item 2                          │
│  ─ Item 3            [See all →]   │
├────────────────────────────────────┤
│  Agent: last run 7:30 · next 19:00 │  ← thin status footer
└────────────────────────────────────┘
[ Today ] [ Drafts ] [ Published ] [ Analytics ]   ← bottom tab bar
```

## Key changes

1. **Bottom tab bar** replaces the current top tab row. Thumb-reachable, 4 icons + labels, active tab in indigo `#6366F1`. Top of screen becomes a slim 44px header with logo + ＋New + settings cog only.

2. **Three-up cost strip** (new component `CostStrip.tsx`) — Today / Week / Month spend pulled from `agent_log.api_cost_usd`. Always visible at top of Today. Tap → opens a sheet with sparkline + breakdown by function. Replaces the buried number in `AgentStatus`.

3. **Hero Draft of the Day** — biggest, boldest card. Pulls the highest-scoring `draft` for today (verification_status=passed, engagement_estimate desc). Swipe right = Approve (sets `status='approved'`), swipe left = Reject (`status='rejected'`). Small buttons under the card as fallback: Open, Visual, Publish. Dots show remaining queued drafts; tap a dot or swipe down to peek the next.

4. **AI News compact list** — 3 items by default, headline + 1-line summary, tap to expand, "See all" jumps to existing TrendRadar. No images, no chips, no clutter.

5. **Agent status footer** — one line: "Last run · Next run". Tap to expand into the existing AgentStatus card content.

6. **Drafts tab** — the existing DraftQueue, but each card gets the same swipe-to-approve/reject and a sticky bottom action bar when a card is opened full-screen.

7. **Tightened Command Centre look**:
   - Background `#0B1020`, surface `#141B32`, raised `#1E2A4A`, accent `#6366F1`.
   - 16px outer padding, 12px card padding, 12px gap between cards (currently inconsistent).
   - Headings: Inter 600, 13px uppercase tracked +0.08em for section labels; 22px for hero hook.
   - All tap targets ≥ 44px. Buttons get larger hit area on mobile.
   - Subtle 150ms ease on swipe; haptic-style scale 0.98 on press.

## Files

New:
- `src/components/mobile/BottomTabBar.tsx`
- `src/components/mobile/CostStrip.tsx`
- `src/components/mobile/HeroDraftCard.tsx` (wraps DraftCard, adds swipe via framer-motion `drag="x"`)
- `src/components/mobile/CompactNewsList.tsx`
- `src/components/mobile/AgentStatusFooter.tsx`

Edited:
- `src/pages/Index.tsx` — replace top tab row with BottomTabBar, rebuild `today` view to the layout above, pass `todaysDrafts` + sorted-by-score selection for hero.
- `src/components/HeaderBar.tsx` — slim to 44px, drop large title, keep ＋New + settings.
- `src/components/DraftCard.tsx` — add `compact` prop used by the queued-draft dots peek.
- `src/index.css` — tighten spacing tokens, add `--surface-raised`, ensure 44px min tap target utility.
- `tailwind.config.ts` — add the surface tokens if missing.

Unchanged: all backend, edge functions, schema, automation, scoring, publish logic, Visual Studio internals.

## Technical notes

- Swipe: use existing `framer-motion` (already in deps via shadcn) with `drag="x"`, `dragConstraints={{left:-120,right:120}}`, threshold ±80px triggers action, animates off-screen, then optimistic supabase update.
- Cost numbers: aggregate `agent_log.api_cost_usd` where `created_at >= startOfDay/Week/Month` in a single `useMemo` over the logs already fetched by Index.
- Hero pick: `drafts.filter(verification_status==='passed').sort((a,b)=>scoreRank(b)-scoreRank(a))[0] ?? drafts[0]`.
- Bottom tab bar uses `fixed bottom-0 inset-x-0` with `pb-[env(safe-area-inset-bottom)]` for iOS notch.
- No new dependencies.

## Out of scope

- Desktop layout (stays as-is, the mobile layout will simply centre at max-width 480px on larger screens for now).
- Push notifications, PWA install prompt, offline mode — note for a later pass.

## Definition of done

- On a 390×771 viewport: header + cost strip + hero draft + 3 news items + footer all visible within ~1.2 screens.
- Swipe right on hero draft approves it and the next queued draft slides into the hero slot.
- Cost strip shows three real numbers from `agent_log`.
- Bottom tab bar switches between Today / Drafts / Published / Analytics without page reload.
- All tap targets ≥ 44px; no horizontal scroll anywhere.
- Smoke test via Playwright on mobile viewport: screenshot of Today, swipe-approve a draft, tap cost strip → sheet opens, switch tabs.
