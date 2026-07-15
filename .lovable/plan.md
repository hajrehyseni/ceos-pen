
# CEO Pen — Audit & Next-Phase Plan

## 1. What's shipped and working

**Content loop (solid)**
- Research → Draft → Verify → Score → Tone-tune → Visual studio → Publish → Analytics → Comment mining → Weekly brief.
- 26 edge functions covering the whole loop. Auto-publish gated on `verification_status='passed'` AND `engagement_estimate='high'`. First-comment auto-post is live. LinkedIn UGC publish + sanitiser.
- Phase B (Reddit / arXiv / Competitor collectors, embedding dedup) and Phase D (weekly brief, hook leaderboard, heatmap analytics) shipped.
- Phase C shipped the generation half of cross-posting: `repurpose-channel` writes X/Threads/Bluesky variants into `channel_variants` every 15 min, plus Sunday newsletter digest via Resend.

**Voice + safety**
- Hajrë voice, no-fabrication rule, forbidden-phrases list, hook A/B, prompt registry, comment-sentiment miner.

## 2. Gaps I found (what must be improved)

### A. Cross-channel is 50% built — biggest miss
`channel_variants` rows are generated but:
- No UI surfaces them anywhere (no page shows X/Threads/Bluesky drafts).
- No publisher — nothing actually posts them. X connector isn't linked. No Bluesky/Threads adapters.
- No per-channel scoring or fact-check of the shortened variants.
- No thread splitter/character validator — a 300-char tweet in a "thread" string will just fail silently.

### B. Draft-queue UX (Phase E never shipped)
- `DraftCard.tsx` is 456 lines and doing too much (edit, tune, visualise, verify, publish, score, first-comment).
- No mobile swipe review (project memory says mobile-first CEO product).
- No bulk actions (approve-all-high, reject-all-low). No side-by-side variant/tone diff.

### C. Trust & Safety (Phase F never shipped)
- Fact-check is still Claude-judging-Claude. No persisted source URLs per claim, no rendered footnotes.
- No PII/defamation guard on named humans/companies.
- No versioned prompt A/B; `prompt_registry` exists but nothing writes `prompt_version` onto posts or compares winners by version.

### D. Publishing intelligence still coarse
- `slot-picker.ts` helper exists but nothing calls it — `generate-draft` still uses fixed UK slots.
- No "hold for event" logic (delay if a bigger beat drops the same hour).
- Auto-publish window in Settings copy says "08:00–12:00 UTC Mon–Fri" — narrower than reality; needs to reflect dynamic slots when we wire them.

### E. Analytics gaps
- `post_metrics` is written by hand or by scheduled job? I don't see a `sync-linkedin-metrics` function. Weekly-brief maths depend on it — without a metric pull, cost-per-engaged and heatmaps drift to zero.
- No cross-channel analytics (X impressions/likes not merged into the picture).

### F. Operational hygiene
- 17 RLS-permissive warnings (all `USING (true)`). Acceptable for a single-user password gate, but leaves the door open if you ever add a teammate. Worth a proper roles table before then.
- `harvest-winners` and `repurpose-winners` exist but I can't confirm they're on cron (need to verify in the cron audit).
- No error alerting — silent failures land in `agent_log` but nothing pings you.
- No dead-letter / retry pattern for LinkedIn 5xx.

### G. Product surface for a busy CEO
- No unified "today" screen: what published, what's queued, what needs my approval, what one insight to act on.
- No "kill switch" per pillar even though pillars are hard-coded to weekdays.
- No inbox/DM triage loop (`reply-assistant` isn't wired to a real inbox surface).

## 3. Priority order (what I recommend building next, in this order)

I've grouped everything into six phases. Phase G is the headline — X publishing — because it's the biggest visible win and the current unfinished promise.

```text
G. X + Bluesky + Threads publishing (finish Phase C properly)   ← START HERE
H. Mobile-first Draft Queue UX (Phase E)
I. LinkedIn + X metrics sync + cross-channel analytics
J. Trust & Safety v2 (Phase F: citations, PII guard, prompt A/B)
K. Command Centre "Today" + kill switches + alerting
L. Reply/DM triage loop
```

## 4. Phase G — X + Bluesky + Threads publishing (headline)

**Why now:** you already generate the variants; you just can't send them. Small surface, huge leverage.

**Build:**
1. **X (Twitter) publisher** — connect the X connector (OAuth 1.0a user context — required for write). New edge fn `publish-x` that:
   - Reads `channel_variants` row for channel='x', status='approved'.
   - Splits the `\n---\n` separator into a real thread, validates each tweet ≤275 chars, publishes via `POST /2/tweets` with `reply.in_reply_to_tweet_id` chaining.
   - Writes `external_url`, `published_at`, `status='published'` back.
   - Logs cost/tokens/errors to `agent_log`.
2. **Bluesky publisher** — new fn `publish-bluesky` using AT Protocol (`com.atproto.repo.createRecord`), app password auth. Single post.
3. **Threads publisher** — Meta Threads API (`/me/threads` container → publish). Single post. Needs Meta app + long-lived token.
4. **Auto-publish integration** — after LinkedIn publishes and `repurpose-channel` runs, mark variants `status='approved'` automatically only when the source post had `engagement_estimate='high'` AND `verification_status='passed'` (same gate as LinkedIn). Everything else stays `draft` for manual review.
5. **UI: Channels tab in Published view** — table per post showing LinkedIn ✓, X status, Bluesky status, Threads status, with "Approve & publish" / "Edit" / "Skip" per channel. Copy-to-clipboard fallback for any channel not yet connected.
6. **Per-channel scorer pass** — mini scorer on each variant (≤200 tokens) checking char limits, no hashtags/emojis, hook strength. Reject below threshold.
7. **Secrets & connectors** to request from you:
   - X: connect the X connector (OAuth 1.0a with Read+Write permission — default is Read only, this is the #1 cause of 401s).
   - Bluesky: `BLUESKY_HANDLE`, `BLUESKY_APP_PASSWORD`.
   - Threads: `THREADS_ACCESS_TOKEN`, `THREADS_USER_ID` (via Meta Developer app).

## 5. Phase H — Mobile-first Draft Queue UX

- Split `DraftCard.tsx` into: `DraftHeader`, `DraftBody`, `DraftScore`, `DraftActions`, `DraftEditPanel`, `DraftVisualPanel`.
- Mobile: swipeable card stack — right approve, left reject, up "tweak". Uses existing `HeroDraftCard` as base.
- Desktop: bulk actions bar — "Approve all High", "Reject all Low", "Regenerate all Failed-verification".
- Side-by-side diff view for tone-tune and hook variants (already stored in `hook_variants`).

## 6. Phase I — Metrics sync + cross-channel analytics

- New `sync-linkedin-metrics` cron (hourly) hitting LinkedIn `/socialActions` + `/organizationalEntityShareStatistics` (or member-share equivalent), writing to `post_metrics`.
- New `sync-x-metrics` for X public metrics.
- Extend `AnalyticsView` heatmap to add a channel filter chip (LinkedIn / X / Bluesky / Threads / All).
- Add cost-per-engaged-impression card that spans channels.

## 7. Phase J — Trust & Safety v2

- Persist source URLs per claim inside `score_breakdown.sources[]`; render as footnotes in the draft body preview.
- Named-entity guard: any claim mentioning a specific person/company must have a matching source URL or verifier fails it.
- Wire `prompt_registry.version` onto every generated post; add a weekly A/B card in Analytics: "Prompt v3 outperforms v2 on virality by +18%".
- External fact-check pass (Firecrawl search on top-3 claims) for pillars where reputational risk matters (`ceo_journey`, `curated_commentary`).

## 8. Phase K — Command Centre "Today" + hygiene

- New `/today` route: what published in last 24h, what's queued for the next 24h, what needs approval, one action from the latest weekly brief.
- Pillar kill switches on Settings (soft-disable a pillar until date X).
- Slack/email alert on any `agent_log` action ending in `_failed` more than 3× in an hour (via Resend + a tiny webhook or Slack connector).
- Wire the existing `slot-picker.ts` into `generate-draft` so `suggested_time` reflects real audience windows; drop the fixed slot list.

## 9. Phase L — Reply/DM triage loop

- Poll LinkedIn comments on last 14 days of published posts, group by post, draft a reply for each using `reply-assistant`, surface in a Triage view for one-tap send.
- Same pattern for X replies once Phase G is live.

## 10. Suggested first batch

**Phase G end-to-end** (X + Bluesky + Threads publish, Channels UI, auto-approve gate) — one shippable increment that turns CEO Pen from "LinkedIn poster" into a genuine multi-channel distribution engine. I'd bundle a small slice of Phase I with it: cross-channel status column in the Published view.

Tell me if you want me to lead with all of Phase G, or narrow it to just X for the first ship (Bluesky/Threads follow-up).
