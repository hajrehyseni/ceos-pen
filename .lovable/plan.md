# Plan: Maximum engagement, usefulness, and virality

Stack three reinforcing mechanisms on top of the existing draft → verify pipeline. Final pipeline becomes:

```text
Hook brainstorm (3 variants, pick best)
        ↓
Draft body around winning hook (with winner examples)
        ↓
Fact-check verifier (existing)
        ↓
Virality + usefulness scorer (0–10 each)
        ↓
  pass → save as 'high'
  fail → one rewrite with specific fixes → rescore → save
        ↓
Auto-publish gate: verification=passed AND engagement_estimate='high'
```

## 1. Hook-first generation (`generate-draft`)

New first Claude Sonnet call asks for **3 distinct hook openers** for today's pillar + news, each using a different shape (tension / contradiction / confession / scene). Returns JSON. Second call picks the strongest hook and writes the 150–350 word body around it. Same total token budget; structurally stronger openers.

## 2. Winner pattern library (few-shot)

Before generating, query `post_metrics` joined to `posts` for the top 3 posts by `(likes + 2*comments + 3*reposts)` over the last 90 days. Inject as `HIGH-PERFORMING PAST POSTS — match this energy` block in the user message. Falls back to `voice_samples` (current behaviour) when metrics are thin.

## 3. Virality + usefulness scorer (third Claude Haiku pass)

New `scoreDraft` helper. Returns JSON:

```json
{
  "hook_strength": 0-10,
  "specificity": 0-10,
  "emotional_pull": 0-10,
  "shareability": 0-10,
  "usefulness": { "actionable_takeaway": bool, "contrarian_angle": bool, "data_or_example_led": bool },
  "overall": 0-10,
  "fixes": ["...", "..."]
}
```

**Pass criteria (all required):**
- `overall ≥ 7.5`
- `hook_strength ≥ 7`
- `usefulness.actionable_takeaway === true` AND (`usefulness.contrarian_angle === true` OR `usefulness.data_or_example_led === true`)

**Fail → one rewrite** with the `fixes` array appended to the prompt, then rescore. Final score determines `engagement_estimate`:
- pass → `high`
- borderline (overall 6.5–7.5) → `medium`
- below → `low`

## 4. Auto-publish gate (`auto-publish`)

Tighten to:
```ts
verification_status === 'passed' AND engagement_estimate === 'high'
```
Anything else stays in draft queue for manual review. Log `auto_publish_skipped_low_engagement` when held back.

## 5. Schema additions

Migration on `posts`:
- `virality_score numeric` — overall 0–10
- `score_breakdown jsonb` — full scorer JSON for audit/UI

## 6. UI (`DraftCard.tsx`)

Add a compact score badge next to verification badge:
- Pill with overall score (green ≥7.5, amber 6.5–7.5, red <6.5)
- Expand reveals hook/specificity/emotional/shareability bars and the three usefulness booleans
- Show `fixes` list when score is below the bar

## 7. Memory updates

- Update `mem://features/ai-generation-logic` — note hook-first, winner examples, scorer gate
- Update `mem://features/post-workflow` — auto-publish now requires `high` engagement
- New `mem://features/virality-scorer` — pass criteria, weights, retry behaviour
- Update `mem://index.md` Core: "Auto-publish requires verified + high engagement score."

## Technical details

- **Models:** Hook brainstorm + body + rewrite use Sonnet (`claude-sonnet-4-20250514`). Scorer uses Haiku (`claude-3-haiku-20240307`).
- **Cost:** +1 Sonnet call (~$0.01) for hook brainstorm, +1–2 Haiku calls (~$0.002) for scoring. Roughly $0.012–$0.015 extra per draft.
- **Token tracking:** Extend `agent_log.details` with `hook_input_tokens`, `hook_output_tokens`, `scorer_input_tokens`, `scorer_output_tokens`, `scorer_retried`.
- **Order matters:** Fact verifier runs BEFORE scorer — no point scoring a hallucinated draft. Scorer rewrite re-runs the verifier on the new draft.
- **Winner query:** Single Supabase RPC or inline join; cap at 3 examples, posts older than 7 days only (so metrics are settled).

## Out of scope

- No changes to `collect-news` or RSS pipeline
- No changes to LinkedIn publishing path beyond the auto-publish gate
- No live A/B testing infrastructure
