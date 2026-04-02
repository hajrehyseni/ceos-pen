import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DAY_PILLARS: Record<number, string> = {
  0: "ceo_journey",
  1: "ai_agents",
  2: "defence_training",
  3: "academic_research",
  4: "ceo_journey",
  5: "curated_commentary",
  6: "curated_commentary",
};

const PILLAR_LABELS: Record<string, string> = {
  ai_agents: "AI Agents",
  defence_training: "Defence Training",
  academic_research: "Academic Research",
  ceo_journey: "CEO Journey",
  curated_commentary: "Curated Commentary",
};

const PILLAR_SEARCH_QUERIES: Record<string, string[]> = {
  ai_agents: [
    "AI agents autonomous systems latest news",
    "LLM agent frameworks developments",
    "enterprise AI automation trends",
  ],
  defence_training: [
    "defence training simulation technology",
    "military AI training systems",
    "defence tech innovation UK",
  ],
  academic_research: [
    "AI academic research breakthroughs",
    "machine learning research papers published",
    "university AI research partnerships industry",
  ],
  ceo_journey: [
    "startup CEO leadership lessons",
    "tech founder scaling challenges",
    "CEO growth strategy insights",
  ],
  curated_commentary: [
    "AI industry analysis opinion",
    "technology trends commentary thought leadership",
    "digital transformation business impact",
  ],
};

// Claude Sonnet pricing
const INPUT_COST_PER_TOKEN = 3 / 1_000_000;
const OUTPUT_COST_PER_TOKEN = 15 / 1_000_000;

interface FirecrawlResult {
  url: string;
  title: string;
  description?: string;
  markdown?: string;
}

interface ScoredArticle {
  title: string;
  url: string;
  source: string;
  summary: string;
  relevance_score: number;
}

/**
 * Search for real articles using Firecrawl Search API.
 */
async function searchFirecrawl(
  query: string,
  apiKey: string
): Promise<FirecrawlResult[]> {
  const response = await fetch("https://api.firecrawl.dev/v1/search", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      query,
      limit: 10,
      tbs: "qdr:w", // last week
      scrapeOptions: { formats: ["markdown"] },
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    console.error(`Firecrawl search error [${response.status}]:`, errText);
    return [];
  }

  const data = await response.json();
  return (data.data || []) as FirecrawlResult[];
}

/**
 * Extract domain from URL for the source field.
 */
function extractDomain(url: string): string {
  try {
    const hostname = new URL(url).hostname;
    return hostname.replace(/^www\./, "");
  } catch {
    return "Unknown";
  }
}

/**
 * Deduplicate articles by URL.
 */
function deduplicateByUrl(articles: FirecrawlResult[]): FirecrawlResult[] {
  const seen = new Set<string>();
  return articles.filter((a) => {
    if (!a.url || seen.has(a.url)) return false;
    seen.add(a.url);
    return true;
  });
}

/**
 * Use Claude to score and summarize REAL articles only.
 */
async function scoreArticles(
  articles: FirecrawlResult[],
  pillarLabel: string,
  claudeApiKey: string
): Promise<{ scored: ScoredArticle[]; inputTokens: number; outputTokens: number }> {
  const articlesForClaude = articles.map((a) => ({
    title: a.title || "Untitled",
    url: a.url,
    source_domain: extractDomain(a.url),
    content_snippet: (a.markdown || a.description || "").slice(0, 800),
  }));

  const systemPrompt = `You are a news relevance scorer. You will receive REAL news articles that were found via web search. Your job is to:
1. Score each article's relevance to the content pillar "${pillarLabel}" on a scale of 1-10
2. Write a factual 2-3 sentence summary for each article using ONLY information present in the provided content

CRITICAL RULES:
- Do NOT invent, fabricate, or hallucinate any information
- Only use facts, names, numbers, and details that appear in the provided content snippets
- If the content snippet is too short to summarise meaningfully, write "Brief article about [topic from title]"
- Return EXACTLY a JSON array of objects with: "title", "url", "source", "summary", "relevance_score"
- Output ONLY the JSON array, no markdown formatting, no explanation`;

  const userMessage = `Here are ${articlesForClaude.length} real articles found via web search. Score and summarise each one:

${JSON.stringify(articlesForClaude, null, 2)}`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": claudeApiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
    }),
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Claude API error [${response.status}]: ${errText}`);
  }

  const claudeData = await response.json();
  const rawText = claudeData.content?.[0]?.text ?? "[]";
  const inputTokens = claudeData.usage?.input_tokens ?? 0;
  const outputTokens = claudeData.usage?.output_tokens ?? 0;

  const cleaned = rawText.replace(/```json?\n?/g, "").replace(/```\n?/g, "").trim();
  const scored = JSON.parse(cleaned) as ScoredArticle[];

  return { scored, inputTokens, outputTokens };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const now = new Date();
    const dayOfWeek = now.getDay();
    const pillar = DAY_PILLARS[dayOfWeek];
    if (!pillar) throw new Error(`No content pillar configured for day ${dayOfWeek}`);
    const pillarLabel = PILLAR_LABELS[pillar];

    const FIRECRAWL_API_KEY = Deno.env.get("FIRECRAWL_API_KEY");
    if (!FIRECRAWL_API_KEY) throw new Error("FIRECRAWL_API_KEY is not configured");

    const CLAUDE_API_KEY = Deno.env.get("CLAUDE_API_KEY");
    if (!CLAUDE_API_KEY) throw new Error("CLAUDE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Phase 1: Search for real articles using Firecrawl
    const searchQueries = PILLAR_SEARCH_QUERIES[pillar];
    console.log(`Searching for "${pillarLabel}" articles with ${searchQueries.length} queries...`);

    const searchPromises = searchQueries.map((q) => searchFirecrawl(q, FIRECRAWL_API_KEY));
    const searchResults = await Promise.all(searchPromises);

    const allArticles = searchResults.flat();
    const uniqueArticles = deduplicateByUrl(allArticles);

    console.log(`Found ${allArticles.length} total results, ${uniqueArticles.length} unique after dedup`);

    if (uniqueArticles.length === 0) {
      // Log the empty result
      await supabase.from("agent_log").insert({
        action: "news_collected",
        api_cost_usd: 0,
        tokens_used: 0,
        details: {
          pillar,
          items_collected: 0,
          warning: "No articles found from Firecrawl search",
        },
      });

      return new Response(
        JSON.stringify({ status: "success", count: 0, pillar, cost: 0, warning: "No articles found" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Phase 2: Score and summarise with Claude
    const { scored, inputTokens, outputTokens } = await scoreArticles(
      uniqueArticles,
      pillarLabel,
      CLAUDE_API_KEY
    );

    const totalTokens = inputTokens + outputTokens;
    const apiCost = inputTokens * INPUT_COST_PER_TOKEN + outputTokens * OUTPUT_COST_PER_TOKEN;

    if (!Array.isArray(scored) || scored.length === 0) {
      throw new Error("No scored articles returned from Claude");
    }

    // Insert into news_items table
    const rows = scored.map((item) => ({
      title: item.title?.slice(0, 500) || "Untitled",
      source: item.source?.slice(0, 200) || "Unknown",
      url: item.url || null,
      summary: item.summary?.slice(0, 1000) || null,
      relevance_score: Math.min(10, Math.max(1, item.relevance_score || 5)),
      pillar_match: pillar,
    }));

    const { data: inserted, error: insertError } = await supabase
      .from("news_items")
      .insert(rows)
      .select("id");

    if (insertError) throw new Error(`Insert failed: ${insertError.message}`);

    // Log to agent_log
    await supabase.from("agent_log").insert({
      action: "news_collected",
      api_cost_usd: parseFloat(apiCost.toFixed(6)),
      tokens_used: totalTokens,
      details: {
        pillar,
        model: "claude-sonnet-4-20250514",
        source: "firecrawl_search",
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        firecrawl_results: allArticles.length,
        unique_articles: uniqueArticles.length,
        items_collected: inserted?.length ?? 0,
      },
    });

    return new Response(
      JSON.stringify({
        status: "success",
        count: inserted?.length ?? 0,
        pillar,
        cost: parseFloat(apiCost.toFixed(6)),
        source: "firecrawl_search",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("collect-news error:", e);
    return new Response(
      JSON.stringify({ status: "error", error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
