## Goal

Rename the product to **CEO Pen** everywhere a user can see it. No logic changes — only labels, headings, empty states, button copy, toasts, metadata, and exported asset bylines.

## What changes

### 1. App identity & metadata
- `index.html`: `<title>`, `og:title`, `twitter:title`, `description` → "CEO Pen — sharp LinkedIn posts from verified AI news" (under 60 chars title, under 160 desc).
- `package.json` `name` left untouched (internal); user-facing only.

### 2. Header (`HeaderBar.tsx`)
- Brand line "LinkedIn Ghostwriter — LRA" → **CEO Pen**.
- Keep weekly counter + settings icon.
- "Generate Draft" button → **New Draft**; "News" button stays as **AI News**.

### 3. Tab bar (`pages/Index.tsx`)
- Rename tabs and add a daily landing tab:
  - `today` → **Today** (default tab — the daily briefing: today's pillar, top AI News items, today's drafts in one mobile-first scroll)
  - `drafts` → **Drafts**
  - `published` → **Published**
  - `analytics` → **Analytics**
- The new **Today** view is a thin composition of existing pieces (pillar header + condensed AI News list + today's DraftQueue items) — no new business logic.

### 4. Section renames
- `TrendRadar.tsx` heading "Trend Radar" → **AI News**. Empty-state copy updated to match. (Database table name `trend_radar` and edge function `scan-trends` stay — internal only.)
- `DraftQueue.tsx` heading "Draft Queue (n)" → **Drafts (n)**. Subline "Your ghostwriter runs at 7:30 AM UTC…" → "CEO Pen drafts at 7:30 AM UTC on weekdays."
- `SidebarPanel.tsx` "Reply Assistant" label stays (already correct).
- `ContentCalendar.tsx` heading "Content Calendar" → **This Week**.
- `SettingsPage.tsx` "Settings" stays.

### 5. Visual Studio
- `DraftCard.tsx` "Create Visual" button → **Open Visual Studio**.
- `VisualStudio.tsx` dialog title → **Visual Studio**.
- Tab order/labels unchanged: Carousel, Poll, Reply, Image, Infographic, Chart.

### 6. Scorecard CTA wording
- Replace user-facing strings "lead-magnet" → **Scorecard CTA** in the tone-tune button labels (`tone-tune/index.ts` `label` fields only — the internal `directive` prompts to the model stay the same, since they already point to `https://build.londonra.com`).
  - "Add natural lead-magnet CTA" → **Add Scorecard CTA (natural)**
  - "Add softer lead-magnet CTA" → **Add Scorecard CTA (soft)**
  - "Set lead-magnet as first comment" → **Scorecard in first comment**
- Settings page label for `lead_magnet_url` → **AI Readiness Scorecard URL** (default `https://build.londonra.com`).

### 7. Exported asset bylines
- `CarouselPreview.tsx` footer "LRA · Hajrë" → **CEO Pen · Hajrë**.
- `ChartPreview.tsx` footer "LRA · Verified" → **CEO Pen · Verified**.
- `ReplyAssistant.tsx` hint "Could spark an LRA conversation" → **"Could open a Scorecard conversation"**.

### 8. Toasts / system copy
- "Published to LinkedIn!" stays (accurate).
- "Trends refreshed" → **AI News refreshed**.
- "Draft generated" stays.

## What does NOT change
- Database tables, columns, edge function names, cron schedules, model prompts' internal wording, file paths.
- Auth, publishing, scoring, automation logic.
- Visual Studio behaviour and exports (only the byline string changes).
- Brand colours, fonts, layout.

## Definition of done
Every user-visible string referencing "Ghostwriter", "LRA", "Trend Radar", "Draft Queue", "Content Calendar", or "lead-magnet" is replaced with the CEO Pen vocabulary above. A grep for those strings in `src/` and `index.html` returns zero matches in user-facing contexts. Mobile preview shows: header "CEO Pen", tabs "Today / Drafts / Published / Analytics", sidebar shows "AI News" and "Reply Assistant", draft cards open "Visual Studio", Scorecard CTA buttons are clearly labelled.

## Technical notes
- Pure frontend string edits plus 3 label strings in `tone-tune/index.ts`. No migrations, no schema changes, no new dependencies.
- New `Today` tab is ~40 lines composing existing components — no new data fetches.
