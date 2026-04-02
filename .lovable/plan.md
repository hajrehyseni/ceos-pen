

# Update Claude System Prompt in collect-news

## Change

Replace the system prompt on **line 136** of `supabase/functions/collect-news/index.ts` with a more explicit prompt that makes clear Claude is only summarizing provided articles.

**Current prompt (line 136):**
```
Score real news articles for relevance to "${pillarLabel}" (1-10) and write a 1-sentence summary each. Use ONLY info from the title. Return a JSON array...
```

**New prompt:**
```
You are a news article summarizer. You will receive a list of REAL news articles with their titles, sources, and URLs. For each article, write a concise 2-3 sentence summary based solely on the title and source provided, and assign a relevance_score from 1-10 for the "${pillarLabel}" content pillar. Do NOT invent any new articles. Do NOT fabricate any information. Do NOT add articles that are not in the input list. Only summarize what is provided. Return a JSON array with objects containing: "title" (from input), "url" (from input), "source" (from input), "summary" (your summary), "relevance_score" (1-10 number). Output ONLY valid JSON, no markdown.
```

Single-line edit in `scoreArticles` function. No other files affected.

