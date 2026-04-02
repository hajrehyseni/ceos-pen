

# Fix: Replace Fabricated News with Real Web Search

## Problem
The `collect-news` function asks Claude to invent news items from memory. Claude generates plausible-sounding but fake headlines, fake URLs, and fake statistics. These hallucinated sources then flow into `generate-draft`, producing LinkedIn posts with fabricated citations.

## Solution
Replace the Claude-based news fabrication with **Firecrawl Search** — a real web search API that returns verified URLs, titles, and content from actual indexed pages. Claude is then used only to score and summarize the real results.

You already have a Firecrawl connection in your workspace (`std_01kfddc74xf9aaqrg3xm5wt7k1`) — it just needs to be linked to this project.

## Architecture

```text
BEFORE:
  Claude → "invent 15 news items" → fake data → DB

AFTER:
  Firecrawl Search (3 queries per pillar) → real articles
    → Claude "score & summarize these REAL articles" → DB
```

## Steps

### 1. Link Firecrawl connector to project
Connect the existing Firecrawl workspace connection so the `FIRECRAWL_API_KEY` secret is available to edge functions.

### 2. Rewrite `collect-news` edge function
- **Phase 1 — Real search**: For each of the 3 search queries per pillar, call the Firecrawl Search API (`POST https://api.firecrawl.dev/v1/search`) with `scrapeOptions: { formats: ['markdown'] }` and `tbs: 'qdr:w'` (last week). This returns real URLs, titles, and page content.
- **Phase 2 — AI scoring**: Pass the real search results to Claude with a revised prompt: "Here are real articles. Score relevance 1-10 and write a 2-3 sentence summary for each. Do NOT invent any information." Claude only processes what Firecrawl found.
- **Deduplication**: Filter out duplicate URLs across the 3 queries before scoring.
- **Insert**: Store results with real URLs, real source names, and AI-generated summaries into `news_items`.
- **Cost logging**: Log both Firecrawl usage and Claude token costs in `agent_log`.

### 3. No changes needed to `generate-draft`
The draft generation function already reads from `news_items` and passes them as source material. Since the table schema is unchanged, drafts will automatically use real sources.

## Technical Details

**Firecrawl Search call** (per query):
```
POST https://api.firecrawl.dev/v1/search
{ query: "AI agents autonomous systems latest news", limit: 10, tbs: "qdr:w", scrapeOptions: { formats: ["markdown"] } }
```

**Revised Claude prompt** (scoring only):
- System: "You are given REAL news articles with their URLs. Score and summarize each. Never fabricate information."
- Input: Array of `{title, url, source_domain, content_snippet}` from Firecrawl
- Output: Same array with added `relevance_score` and `summary`

**Fallback**: If Firecrawl returns no results for a query, skip it. If all queries return empty, log a warning and return `count: 0` instead of fabricating.

