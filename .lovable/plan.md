
# Ghostwriter v2 — Hajre's CEO voice, engineered for engagement & lead-magnet conversion

Every change below has one north star: **posts must sound like Hajre (CEO of London Royal Academy), drive comments, and funnel readers to `build.londonra.com`.** Nothing fabricated, nothing hallucinated, nothing that smells like AI.

## 1. Password — change, don't remove

You want the friction gone but the dashboard still exposes your LinkedIn token, so we'll keep one gate, just change it to **`LRA2026`** and persist the unlock so you only type it once per device (90-day cookie instead of sessionStorage).

- Update `DASHBOARD_PASSWORD` secret to `LRA2026`.
- `PasswordGate` switches from `sessionStorage` → 90-day cookie. Type it once, forget about it.
- Roll back the half-built Supabase Auth swap (admin user / signInWithPassword) so it stops nagging.

## 2. The Hajre Voice Engine

Goal: every draft reads like *you* wrote it on the tube, not like ChatGPT.

- **Voice fingerprint pass.** New edge function `score-voice` runs after generation: compares draft against your top-rated `voice_samples` on sentence length variance, contraction rate, British spellings, first-person ratio, question density, and forbidden-phrase list ("In today's fast-paced world", "leverage", "unlock", em-dashes, etc.). Produces a 0–10 score + diff.
- **Auto-rewrite under threshold.** Score < 7 → one rewrite pass with the specific failings injected into the prompt. Score < 7 again → flagged for manual edit, no auto-publish.
- **Winner harvesting.** After a post hits the "high engagement" threshold in `post_metrics` (likes + 3×comments > rolling median × 1.5), it's auto-inserted into `voice_samples` with `performance_rating = 9`. The corpus trains itself.
- **CEO context block** baked into the system prompt: who you are, that LRA is your academy, your worldview, your pet peeves, the 3 stories you reuse. One-time setup screen in Settings to capture this.

## 3. The Lead-Magnet CTA layer

`build.londonra.com` becomes a first-class citizen, not an afterthought.

- New `cta_library` table: rotating set of British-witty CTAs ("Built something proper at build.londonra.com — go nick the framework", "The full playbook lives at build.londonra.com, no email wall, just take it"). Generator picks one per post weighted by past CTR.
- **Soft-CTA vs hard-CTA rotation.** 60% soft (URL in comments mention), 40% hard (URL in post body). LinkedIn de-prioritises posts with outbound links in body, so we balance reach vs conversion.
- **Auto first-comment.** On publish, edge function posts the link as the first comment via LinkedIn UGC API. This is the #1 conversion trick on LinkedIn and we're not using it yet.
- Optional UTM tagging (`?utm_source=linkedin&utm_campaign=<post_id>`) so you can see in your analytics which posts drive visits.

## 4. Hook Lab + A/B Testing

- Generator produces **5 hook variants** per draft (curiosity, contrarian, stat, story, question). Scorer ranks them; top 1 ships, other 4 stored in `hook_variants` table.
- **Hook taxonomy tagging** on every post so we learn what works for *your* audience, not generic LinkedIn.
- After 14 days, weekly job compares engagement by hook type and feeds winning patterns into next week's prompt as few-shot examples.

## 5. Trend & Competitor Radar

- Daily Firecrawl job (`scan-trends`) hits:
  - LinkedIn search for your 7 pillar keywords (last 7 days, top engagement)
  - 3 competitor profiles you nominate in Settings
  - Niche RSS sources you already have
- Claude summarises into a `trend_radar` table: angle, why it's hot, suggested counter-take in your voice. Surfaces in Command Center sidebar so you see opportunities before drafting.
- Drafter pulls top 3 trends as optional source material, prioritising fresh angles over stale evergreen.

## 6. Stronger Fact-Checking (no hallucinations, ever)

Current verifier is a single Claude pass — it can still rubber-stamp made-up stats. Hardening:

- Verifier extracts every claim that contains a number, name, date, or "study shows"-style assertion.
- For each claim, Firecrawl scrapes the cited URL (or searches if none cited). If a claim has no verifiable source → `verification_status = 'failed'`, auto-publish blocked, draft tagged with the unverifiable claim highlighted.
- "Soft claims" (opinion, anecdote, your own stories) bypass the URL check but still get the AI-style-phrase filter.
- New `verification_evidence` jsonb on `posts` with the actual source quote next to each claim. You see receipts in the draft card.

## 7. Format expansion

- **Carousels (PDF).** New format option. Generator outputs 6–10 slide outline → Lovable AI image gen creates each slide as image → assembled into PDF via `pdf-lib` in edge function → uploaded to Supabase Storage → published via LinkedIn document-share API. Template uses LRA dark/indigo brand. Roughly 1 carousel per week, scheduled for Tuesday/Thursday.
- **Visual infographics.** Same pipeline as carousels but single image, British-humour visual metaphors (e.g. "The 4 stages of a bad hire, drawn as Tube line stops"). Generator drafts the concept brief, image gen executes, you approve.
- **Polls.** Drafter can produce a poll variant on schedule slots flagged "low-effort engagement day" (Mondays, Fridays). Poll question + 4 options, all in your voice.
- **Repurpose winners.** Cron job: posts older than 21 days with engagement in top 25% get auto-fed into a "rewrite from a fresh angle" prompt and pushed into the draft queue.

## 8. Reply / DM assistant

- New edge function `fetch-comments` pulls comments on your published posts (LinkedIn UGC comments endpoint, needs `r_member_social` scope — we'll reconnect the connector with that scope).
- For each comment, Claude drafts a reply in your voice that (a) genuinely engages and (b) where natural, mentions the lead magnet.
- Command Center gets a new "Replies" tab — one-click approve/edit/send. No auto-send for replies; you stay in the loop.

## 9. Database additions

New tables (all with grants + RLS):
- `hook_variants` — variants per post, type, scorer ranking, eventual engagement
- `cta_library` — CTA copy, type (soft/hard), CTR history
- `trend_radar` — daily trend snapshots
- `verification_evidence` — per-claim source quotes (could be jsonb on `posts` instead)
- `comment_replies` — fetched comments + drafted replies + status
- `ceo_context` — one-row table with your CEO bio, worldview, stories, forbidden phrases

New `voice_samples` columns: `style_tags`, `auto_harvested` boolean.

## 10. Settings UI additions

- CEO context editor (bio, stories, forbidden phrases)
- Competitor profile URLs (up to 3)
- CTA rotation weights
- Lead magnet URL (default `build.londonra.com`, in case you launch more)
- Toggle: auto-first-comment on/off
- Toggle: hard-CTA frequency slider

## 11. What's NOT in scope this round

- Replacing the password with full Supabase Auth (you've vetoed — staying with simple gate)
- Per-end-user OAuth (this is your single-operator tool)
- Video posts (LinkedIn API support is awkward, defer)

## Technical notes

- All new edge functions deploy with `verify_jwt = false`, called by pg_cron (matches existing pattern).
- Carousel PDF generation uses `pdf-lib` via npm import in Deno.
- Image generation uses Lovable AI `google/gemini-3.1-flash-image-preview` (Nano Banana 2) for slide visuals.
- Comment fetching requires LinkedIn connector reconnect with `r_member_social` scope — I'll flag this when we get to step 8.
- All Claude calls stay on `claude-sonnet-4-20250514` (the model fix from last round).
- pg_cron schedule additions: `scan-trends` daily 06:00 UTC, `harvest-winners` daily 03:00 UTC, `repurpose-winners` Sundays 04:00 UTC, `fetch-comments` every 2h during UK waking hours.

## Suggested build order

Given the size, I'd ship in 4 waves so you see value fast:

1. **Wave 1 (foundation):** Password change to LRA2026 + 90-day cookie, CEO context block, voice scoring + auto-rewrite, hard fact-check with source receipts, CTA library + auto-first-comment.
2. **Wave 2 (engagement):** Hook lab A/B, winner harvesting back into voice_samples, repurpose-winners cron.
3. **Wave 3 (intel):** Trend & competitor radar, Command Center surfacing.
4. **Wave 4 (formats):** Carousels, infographics, polls, reply assistant (needs connector reconnect).

Tell me to start Wave 1 (or pick a different starting point) and I'll build.
