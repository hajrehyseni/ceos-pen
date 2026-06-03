# Zero-fabrication guarantee: verifier pass on every draft

## Problem

The system prompt already says "no fabrication", but nothing actually checks the output. Claude can still invent a stat, a study, or attribute a quote to a real company that wasn't in the news items.

## Solution

Add a **verifier pass** to `generate-draft`. After Claude writes the draft, a second Claude call cross-checks every factual claim against the supplied `news_items` + `ai_landscape` source pool. Unsupported claims either get the draft regenerated (once) or block it from auto-publishing.

### What counts as a "fact" to check
- Named entities: companies, products, people, universities, government bodies
- Numbers: statistics, percentages, dollar/£ amounts, dates, model sizes
- Studies / reports / research references

The founder's own anecdotes, opinions, and observations are **exempt** — they're first-person voice, not external claims.

## Implementation

### 1. New verifier step in `generate-draft`

After Claude returns `postContent`, call Claude Haiku (cheap + fast) with structured JSON output:

```
SYSTEM: You are a fact-checker. Given a draft post and a list of source
items (titles, sources, summaries), identify every factual claim in the
draft that references: a named company/person/product/institution, a
number/statistic/date, or a study/report. For each claim, decide if it
is supported by the sources. Personal anecdotes and the author's own
opinions are exempt — do not flag them.

Return JSON:
{
  "verdict": "pass" | "fail",
  "claims": [
    { "claim": "...", "supported": true|false, "source_index": 3|null, "reason": "..." }
  ]
}
```

Pass = every flagged claim has `supported: true`. Otherwise fail.

### 2. Retry logic

- If verdict = `fail`: regenerate the draft **once** with an explicit instruction listing the unsupported claims and telling the model to remove them.
- If still failing on the retry: save the post with `status = 'draft'` and `engagement_estimate = 'needs_review'`, plus a new column `verification_status = 'failed'` and `verification_notes` (JSON) so it surfaces in the dashboard. **Auto-publish must skip these.**
- If verdict = `pass`: save with `verification_status = 'passed'` and `verification_notes` (full claim list).

### 3. Schema additions

Migration on `posts`:
- `verification_status TEXT` — `passed`, `failed`, `not_run` (default `not_run`)
- `verification_notes JSONB` — the full claim list from the verifier

### 4. Auto-publish guard

In `auto-publish`, skip any post where `verification_status != 'passed'`. Log it to `agent_log` as `auto_publish_skipped_verification`.

### 5. Dashboard surfacing

Minimal UI change: in `DraftCard`, show a small badge:
- Green "Verified" when `verification_status = 'passed'`
- Amber "Needs review" when `verification_status = 'failed'` with tooltip showing the unsupported claims

This lets the CEO see at a glance which drafts need eyeballs.

### 6. System prompt reinforcement

Update SYSTEM_PROMPT in `generate-draft` with an explicit list mirroring the verifier's rules so the model is less likely to fail on the first pass:

> Never invent company names, people, products, institutions, statistics, percentages, dates, dollar amounts, study names, or research citations. If the supplied news items don't support a specific fact, omit it — describe the pattern in your own words instead.

## Cost impact

- Verifier: Claude Haiku, ~$0.001 per draft (input ~2k tokens, output ~500).
- Retry happens maybe 10–20% of the time → ~$0.002 average per draft.
- Negligible vs. the Sonnet generation cost.

## Out of scope

- No live web verification (we trust the news_items as the ground truth).
- No change to RSS collection or AI landscape sweep — already shipped.
- No change to LinkedIn publishing path beyond the auto-publish guard.
