import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.4";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const DAY_PILLARS: Record<number, string> = {
  0: "ceo_journey", // Sunday
  1: "ai_agents", // Monday
  2: "defence_training", // Tuesday
  3: "academic_research", // Wednesday
  4: "ceo_journey", // Thursday
  5: "curated_commentary", // Friday
  6: "curated_commentary", // Saturday
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

const NEWS_SYSTEM_PROMPT = `You are a news research assistant. Given a content pillar theme, find and return the most relevant, recent, and noteworthy news items, trends, and developments.

Return EXACTLY a JSON array of objects. Each object must have:
- "title": A clear, specific headline (string)
- "source": The publication or organisation name (string)  
- "url": A plausible URL for the story (string, use real domains)
- "summary": A 2-3 sentence summary with specific details, names, numbers (string)
- "relevance_score": How relevant this is to the pillar on a scale of 1-10 (number)

Return 10-15 items. Focus on items from the last 7 days. Prioritise UK/European sources alongside global ones.
Output ONLY the JSON array, no markdown formatting, no explanation.`;

// Claude Sonnet pricing
const INPUT_COST_PER_TOKEN = 3 / 1_000_000;
const OUTPUT_COST_PER_TOKEN = 15 / 1_000_000;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const now = new Date();
    const dayOfWeek = now.getDay();

    // Determine pillar for all 7 days
    const pillar = DAY_PILLARS[dayOfWeek];
    if (!pillar) throw new Error(`No content pillar configured for day ${dayOfWeek}`);
    const pillarLabel = PILLAR_LABELS[pillar];

    const CLAUDE_API_KEY = Deno.env.get("CLAUDE_API_KEY");
    if (!CLAUDE_API_KEY) throw new Error("CLAUDE_API_KEY is not configured");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const searchQueries = PILLAR_SEARCH_QUERIES[pillar];
    const todayStr = now.toLocaleDateString("en-GB", {
      weekday: "long",
      day: "numeric",
      month: "long",
      year: "numeric",
    });

    const userMessage = `Today is ${todayStr}. The content pillar is: "${pillarLabel}".

Search themes to cover:
${searchQueries.map((q, i) => `${i + 1}. ${q}`).join("\n")}

Find the most relevant and recent news items, trends, reports, and developments related to this pillar. Include specific company names, statistics, and publication sources where possible.`;

    // Call Claude
    const claudeResponse = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": CLAUDE_API_KEY,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-20250514",
        max_tokens: 4096,
        system: NEWS_SYSTEM_PROMPT,
        messages: [{ role: "user", content: userMessage }],
      }),
    });

    if (!claudeResponse.ok) {
      const errText = await claudeResponse.text();
      throw new Error(`Claude API error [${claudeResponse.status}]: ${errText}`);
    }

    const claudeData = await claudeResponse.json();
    const rawText = claudeData.content?.[0]?.text ?? "[]";

    const inputTokens = claudeData.usage?.input_tokens ?? 0;
    const outputTokens = claudeData.usage?.output_tokens ?? 0;
    const totalTokens = inputTokens + outputTokens;
    const apiCost = inputTokens * INPUT_COST_PER_TOKEN + outputTokens * OUTPUT_COST_PER_TOKEN;

    // Parse news items from Claude response
    let newsItems: Array<{
      title: string;
      source: string;
      url: string;
      summary: string;
      relevance_score: number;
    }> = [];

    try {
      // Strip any markdown code fences if present
      const cleaned = rawText.replace(/```json?\n?/g, "").replace(/```\n?/g, "").trim();
      newsItems = JSON.parse(cleaned);
    } catch (parseErr) {
      console.error("Failed to parse Claude news response:", parseErr, rawText.slice(0, 500));
      throw new Error("Failed to parse news items from AI response");
    }

    if (!Array.isArray(newsItems) || newsItems.length === 0) {
      throw new Error("No news items returned from AI");
    }

    // Insert into news_items table
    const rows = newsItems.map((item) => ({
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
        input_tokens: inputTokens,
        output_tokens: outputTokens,
        items_collected: inserted?.length ?? 0,
      },
    });

    return new Response(
      JSON.stringify({
        status: "success",
        count: inserted?.length ?? 0,
        pillar,
        cost: parseFloat(apiCost.toFixed(6)),
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
