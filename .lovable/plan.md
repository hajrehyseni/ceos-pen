
# CEO PEN — Audit & Growth Plan

## Where we are today (audit)

**Working well**
- Fact-checked drafts, virality + usefulness scorer, quick tweaks, Visual Studio (carousel/poll/image/infographic/chart/reply), scorecard CTA logic, LinkedIn publish, draft history, downloads via signed storage.
- 5 content pillars on a weekly rota; auto-publish gated by verification + engagement.

**Gaps vs. what you're asking for**
1. **No meme format.** Visual Studio has 6 tabs but no one-click meme generator (top/bottom text on a reaction image).
2. **Virality score is single-number.** No comparison to your published winners, no "why this will/won't fly" plain-English verdict, no predicted reach band.
3. **Posts skew essay-ish.** No dedicated "Story mode" that forces scene → tension → turn → lesson with short paragraphs and white space tuned for phone reading.
4. **No "screenshot tip" pipeline.** Nothing captures useful practices from Claude Code, Codex, n8n, Hugging Face, Cursor, etc., and turns them into 60–90 word posts + a screenshot.
5. **Sources are RSS-only.** No changelog/docs/HN/Reddit/YouTube-transcript pull for tool-tip content.

---

## Proposed upgrades (phased, each shippable on its own)

### Phase 1 — Meme Studio (one-click)
- New Visual Studio tab **Meme** + a `Meme` shortcut button on every draft card ("Turn into meme").
- Edge function `gen-meme`: Claude picks a meme *format* (Drake, Distracted BF, "This is Fine", Two Buttons, Change my Mind, custom reaction) that matches the draft's tension, then writes the caption(s).
- Rendering: HTML/Canvas template (Impact-style top/bottom text, safe margins, watermark off). Curated base-image library stored in `visual-exports` bucket. No external meme API needed.
- Export uses existing `downloadBlob` → signed URL flow; also "Add to Visual Studio" so it attaches to the post.

### Phase 2 — Virality Score v2
- Extend scorer to output: `predicted_reach_band` (low/mid/high/breakout), `similar_winner_id` (nearest match from `harvest-winners` table), and a one-line **verdict in Hajrë's voice** ("Punchy hook, weak turn — will hit ~2k impressions unless you sharpen line 3").
- Draft card: replace bare "7.2/10" with a compact panel: score, band, closest winner (click to open), plus the existing axis bars behind the chevron.
- Auto-publish rule adds `predicted_reach_band !== 'low'` as a gate.

### Phase 3 — Story Mode drafts
- New generator variant `generate-draft --shape=story` producing 180–260 word narratives with:
  - Line 1 = scene, Line 2 = tension, mid = turn, close = lesson + soft CTA
  - Enforced short paragraphs (≤ 2 sentences), whitespace between beats.
- Add a **Format** control to the daily rota so certain slots default to Story (Wed/Sat) and others to Insight/Meme/Tip.
- Quick-tweak "Rewrite as story" available on any existing draft.

### Phase 4 — Screenshot Tips pipeline
- New pillar `tool_tips` covering: Claude Code, Codex, n8n, Hugging Face, Cursor, Lovable, Perplexity, Gemini CLI, LangGraph.
- New collector `collect-tool-tips` that pulls from:
  - Official changelogs / release notes (Firecrawl on known URLs)
  - Docs "What's new" pages
  - Reddit r/ClaudeAI, r/OpenAI, r/LocalLLaMA top weekly
  - Hacker News front-page items matching tool names
- Draft template = 60–90 words: `What broke → the trick → why it works → try it`. No fabrication; must cite the source page.
- Visual Studio **Screenshot** tab: paste/upload a screenshot, or auto-fetch a hero image via `fetch_website` screenshot; frame it in a branded phone/browser mockup with a caption bar.
- Auto-schedule these into Fri/Sun slots since they perform well as short reads.

### Phase 5 — Small polish (bundled)
- "Turn into meme / story / tip" buttons live next to Quick Tweaks on every draft.
- Homepage adds a **Formats today** row (Story · Insight · Tip · Meme) so you see variety at a glance.
- Analytics view: split engagement averages by format so we learn which shape wins for you.

---

## Technical section

**New tables**
- `meme_templates(id, name, image_path, top_zone jsonb, bottom_zone jsonb, tone_tags text[])` — seeded with ~12 formats.
- `tool_sources(id, tool, url, kind, enabled)` — feeds for the tip collector.
- Extend `posts`: `format text default 'insight'`, `predicted_reach_band text`, `similar_winner_id uuid`.
- Extend `visual_assets.kind` enum with `meme` and `screenshot`.

**New edge functions**
- `gen-meme` (Claude + template picker + server-side render via `satori` or canvas in Deno; falls back to client-side render if easier).
- `collect-tool-tips` (Firecrawl + Reddit RSS + HN Algolia) → drops into `news_items` with `pillar='tool_tips'`.
- `gen-screenshot-post` (short-form draft + optional screenshot fetch).

**Modified functions**
- `generate-draft`: accept `format` and `shape`; add Story system prompt variant.
- Scorer: add `predicted_reach_band`, `similar_winner_id` (embed compare vs. winners table), and `verdict` line.

**Frontend**
- `VisualStudio.tsx`: add `Meme` and `Screenshot` tabs.
- `DraftCard.tsx`: add format badge, "Turn into meme/story/tip" buttons, new verdict line above the score bar.
- `Index.tsx`: "Formats today" strip.

**No breaking changes** — everything additive; existing drafts default to `format='insight'`.

---

## Suggested order to ship
1. Phase 2 (Virality v2) — fastest win, no new UI surface.
2. Phase 1 (Meme Studio) — highest "wow", isolated.
3. Phase 3 (Story mode) — prompt work + one tweak button.
4. Phase 4 (Screenshot Tips) — biggest, new pillar + collector.
5. Phase 5 polish.

Want me to start with **Phase 1 + 2 together**, or a different order? I can also drop any phase you don't want.
