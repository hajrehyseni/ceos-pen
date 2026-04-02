

# Replace Firecrawl with Google News RSS in collect-news

## What Changes

Swap the Firecrawl Search API calls for free Google News RSS feed fetches. This removes the Firecrawl dependency (and its cost) while still providing real, verified articles.

## New Flow

```text
For each query in PILLAR_SEARCH_QUERIES:
  → Fetch https://news.google.com/rss/search?q={query}&hl=en-GB&gl=GB&ceid=GB:en
  → Parse XML: extract <item> → title, link, source, pubDate
  → Collect all items across queries
  → Deduplicate by normalized title similarity
  → Send real article list to Claude for scoring + summarization
  → Store in news_items with REAL data
```

## Changes to `supabase/functions/collect-news/index.ts`

1. **Remove Firecrawl**: Delete the `searchFirecrawl` function, `FirecrawlResult` interface, and the `FIRECRAWL_API_KEY` check.

2. **Add `fetchGoogleNewsRSS` function**: For a given query, fetch the Google News RSS URL, parse the XML response to extract each `<item>`'s `<title>`, `<link>`, `<source>`, and `<pubDate>`. Use regex-based XML parsing (no external XML library needed in Deno).

3. **Add title-based deduplication**: Replace `deduplicateByUrl` with `deduplicateByTitle` — normalize titles (lowercase, strip punctuation) and skip near-duplicates.

4. **Update `scoreArticles`**: Change input type from `FirecrawlResult[]` to the new RSS article interface. Since RSS items don't include content snippets, Claude will score/summarize based on title + source + publication date only. Update the prompt accordingly.

5. **Update handler**: Replace Firecrawl search calls with Google News RSS fetches. Remove Firecrawl-specific logging fields, update `source` to `"google_news_rss"` in agent_log and response.

## Technical Details

- **RSS URL pattern**: `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-GB&gl=GB&ceid=GB:en`
- **XML parsing**: Regex extraction — `/<item>([\s\S]*?)<\/item>/g`, then extract `<title>`, `<link>`, `<source[^>]*>([^<]+)`, `<pubDate>`
- **No new dependencies or secrets needed** — Google News RSS is free and unauthenticated
- **Claude prompt update**: "Here are real articles from Google News RSS. For each, write a 2-3 sentence summary based on the title and source. Score relevance 1-10. Do NOT invent information beyond what the title conveys."

