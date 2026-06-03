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

// Claude 3 Haiku pricing
const INPUT_COST_PER_TOKEN = 0.25 / 1_000_000;
const OUTPUT_COST_PER_TOKEN = 1.25 / 1_000_000;

interface RSSArticle {
  title: string;
  url: string;
  source: string;
  pubDate: string;
}

interface ScoredArticle {
  title: string;
  url: string;
  source: string;
  summary: string;
  relevance_score: number;
}

async function fetchGoogleNewsRSS(query: string): Promise<RSSArticle[]> {
  const url = `https://news.google.com/rss/search?q=${encodeURIComponent(query)}&hl=en-GB&gl=GB&ceid=GB:en`;
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; NewsBot/1.0)",
        "Accept": "application/rss+xml, application/xml, text/xml",
      },
    });
    if (!response.ok) {
      console.error(`Google News RSS error [${response.status}] for query: ${query}`);
      return [];
    }
    const xml = await response.text();
    const items: RSSArticle[] = [];
    const itemRegex = /<item>([\s\S]*?)<\/item>/g;
    let match;
    while ((match = itemRegex.exec(xml)) !== null) {
      if (items.length >= 3) break;
      const block = match[1];
      const title = block.match(/<title>([\s\S]*?)<\/title>/)?.[1]?.trim() || "";
      const link = block.match(/<link>([\s\S]*?)<\/link>/)?.[1]?.trim() || "";
      const source = block.match(/<source[^>]*>([\s\S]*?)<\/source>/)?.[1]?.trim() || "Unknown";
      const pubDate = block.match(/<pubDate>([\s\S]*?)<\/pubDate>/)?.[1]?.trim() || "";
      if (title && link) {
        items.push({ title, url: link, source, pubDate });
      }
    }
    return items;
  } catch (err) {
    console.error(`Failed to fetch RSS for query "${query}":`, err);
    return [];
  }
}

function normalizeTitle(t: string): string {
  return t.toLowerCase().replace(/[^a-z0-9 ]/g, "").replace(/\s+/g, " ").trim();
}

function deduplicateByTitle(articles: RSSArticle[]): RSSArticle[] {
  const seen = new Set<string>();
  return articles.filter((a) => {
    const norm = normalizeTitle(a.title);
    if (seen.has(norm)) return false;
    seen.add(norm);
    return true;
  });
}

async function scoreArticles(
  articles: RSSArticle[],
  pillarLabel: string,
  claudeApiKey: string
): Promise<{ scored: ScoredArticle[]; inputTokens: number; outputTokens: number }> {
  const articlesForClaude = articles.map((a) => ({
    title: a.title,
    url: a.url,
    source: a.source,
    published: a.pubDate,
  }));

  const systemPrompt = `You are a news article summarizer. You will receive a list of REAL news articles with their titles, sources, and URLs. For each article, write a concise 2-3 sentence summary based solely on the title and source provided, and assign a relevance_score from 1-10 for the "${pillarLabel}" content pillar. Do NOT invent any new articles. Do NOT fabricate any information. Do NOT add articles that are not in the input list. Only summarize what is provided. Return a JSON array with objects containing: "title" (from input), "url" (from input), "source" (from input), "summary" (your summary), "relevance_score" (1-10 number). Output ONLY valid JSON, no markdown.`;

  const userMessage = `Here are ${articlesForClaude.length} real articles from Google News RSS. Score and summarise each one:

${JSON.stringify(articlesForClaude, null, 2)}`;

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": claudeApiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-3-5-haiku-20241022",
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

    const CLAUDE_API_KEY = Deno.env.get("CLAUDE_API_KEY");
    if (!CLAUDE_API_KEY) throw new Error("CLAUDE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Phase 1: Fetch real articles from Google News RSS
    const searchQueries = PILLAR_SEARCH_QUERIES[pillar];
    console.log(`Fetching Google News RSS for "${pillarLabel}" with ${searchQueries.length} queries...`);

    const rssPromises = searchQueries.map((q) => fetchGoogleNewsRSS(q));
    const rssResults = await Promise.all(rssPromises);

    const allArticles = rssResults.flat();
    const uniqueArticles = deduplicateByTitle(allArticles);

    console.log(`Found ${allArticles.length} total results, ${uniqueArticles.length} unique after dedup`);

    // Phase 2: Score and summarise pillar articles with Claude
    let pillarInsertedCount = 0;
    let pillarInputTokens = 0;
    let pillarOutputTokens = 0;

    if (uniqueArticles.length > 0) {
      const { scored, inputTokens, outputTokens } = await scoreArticles(
        uniqueArticles,
        pillarLabel,
        CLAUDE_API_KEY
      );
      pillarInputTokens = inputTokens;
      pillarOutputTokens = outputTokens;

      if (Array.isArray(scored) && scored.length > 0) {
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
        pillarInsertedCount = inserted?.length ?? 0;
      }
    }

    // Phase 3: ALWAYS sweep current AI news so every draft (regardless of
    // pillar) can stay grounded in what's actually happening in the world.
    // Skip when today's pillar is already ai_agents to avoid duplicate work.
    let aiInsertedCount = 0;
    let aiInputTokens = 0;
    let aiOutputTokens = 0;

    if (pillar !== "ai_agents") {
      const aiQueries = [
        ...PILLAR_SEARCH_QUERIES.ai_agents,
        "latest AI news this week",
        "OpenAI Anthropic Google AI announcement",
      ];
      console.log(`AI landscape sweep: ${aiQueries.length} queries...`);
      const aiRss = await Promise.all(aiQueries.map((q) => fetchGoogleNewsRSS(q)));
      const aiUnique = deduplicateByTitle(aiRss.flat());
      console.log(`AI sweep: ${aiUnique.length} unique articles`);

      if (aiUnique.length > 0) {
        try {
          const aiResult = await scoreArticles(aiUnique, PILLAR_LABELS.ai_agents, CLAUDE_API_KEY);
          aiInputTokens = aiResult.inputTokens;
          aiOutputTokens = aiResult.outputTokens;
          if (Array.isArray(aiResult.scored) && aiResult.scored.length > 0) {
            const aiRows = aiResult.scored.map((item) => ({
              title: item.title?.slice(0, 500) || "Untitled",
              source: item.source?.slice(0, 200) || "Unknown",
              url: item.url || null,
              summary: item.summary?.slice(0, 1000) || null,
              relevance_score: Math.min(10, Math.max(1, item.relevance_score || 5)),
              pillar_match: "ai_agents",
            }));
            const { data: aiInserted, error: aiErr } = await supabase
              .from("news_items")
              .insert(aiRows)
              .select("id");
            if (aiErr) console.error("AI sweep insert error:", aiErr.message);
            else aiInsertedCount = aiInserted?.length ?? 0;
          }
        } catch (err) {
          console.error("AI sweep scoring failed:", err);
        }
      }
    }

    const totalInputTokens = pillarInputTokens + aiInputTokens;
    const totalOutputTokens = pillarOutputTokens + aiOutputTokens;
    const totalTokens = totalInputTokens + totalOutputTokens;
    const apiCost = totalInputTokens * INPUT_COST_PER_TOKEN + totalOutputTokens * OUTPUT_COST_PER_TOKEN;

    await supabase.from("agent_log").insert({
      action: "news_collected",
      api_cost_usd: parseFloat(apiCost.toFixed(6)),
      tokens_used: totalTokens,
      details: {
        pillar,
        model: "claude-3-5-haiku-20241022",
        source: "google_news_rss",
        input_tokens: totalInputTokens,
        output_tokens: totalOutputTokens,
        rss_results: allArticles.length,
        unique_articles: uniqueArticles.length,
        pillar_items_collected: pillarInsertedCount,
        ai_landscape_items_collected: aiInsertedCount,
        items_collected: pillarInsertedCount + aiInsertedCount,
      },
    });

    return new Response(
      JSON.stringify({
        status: "success",
        count: pillarInsertedCount + aiInsertedCount,
        pillar_items: pillarInsertedCount,
        ai_landscape_items: aiInsertedCount,
        pillar,
        cost: parseFloat(apiCost.toFixed(6)),
        source: "google_news_rss",
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
