# Make drafts reflect current AI news

## Problem

`generate-draft` pulls `news_items` from the last 24h filtered by *today's pillar only*. On non-AI days (CEO Journey, Defence Training, Curated Commentary, etc.) the model gets little or no current AI context, so posts feel detached from what's actually happening in the world.

`collect-news` also only runs for the day's pillar, so AI headlines are only collected on Mondays.

## Fix

Two coordinated changes so every draft, on every pillar, sees fresh AI headlines:

### 1. `collect-news` — always sweep AI news daily

In addition to today's pillar sweep, always run the `ai_agents` RSS queries (plus a couple of broader "latest AI news this week" queries) and store them tagged `pillar_match = 'ai_agents'`. This guarantees a rolling pool of current AI items in the DB every day.

### 2. `generate-draft` — inject a "Current AI Landscape" block into every prompt

In the user message sent to Claude, add a new section alongside the existing pillar `NEWS ITEMS`:

```
CURRENT AI LANDSCAPE (last 48h — use to keep the post grounded in what's
actually happening, even if the pillar isn't AI):
1. <title> (<source>) — <url>
   <summary>
...
```

- Pull top 5–8 `news_items` where `pillar_match = 'ai_agents'` from the last 48h, ordered by `relevance_score`.
- On AI-pillar days these already drive the post, so skip the extra block to avoid duplication.
- Update SYSTEM_PROMPT with one line: *"You may reference the CURRENT AI LANDSCAPE items to make the post feel timely, but only if it fits the pillar naturally. Never force it. Still no fabrication — only facts from the provided items."*

### 3. Source-material tracking

Include the AI-landscape items in `source_material` on the post row so the dashboard still shows what grounded the draft.

## Out of scope

- No live web-fetch at draft time (kept for a later iteration if needed).
- No schema changes.
- No UI changes.
- No change to pg_cron schedules — `collect-news` already runs daily, we're just widening what it collects.

## Cost impact

- `collect-news`: +1 Claude Haiku scoring call per day (~$0.001/day).
- `generate-draft`: +5–8 short items in the prompt (~300–500 input tokens, <$0.002/draft).

Negligible.
