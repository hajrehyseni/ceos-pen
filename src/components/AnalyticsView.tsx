import { useEffect, useState } from "react";
import { Post, PostMetrics, AgentLog, WeeklyBrief } from "@/types/database";
import { PILLARS } from "@/lib/constants";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

interface AnalyticsViewProps {
  posts: Post[];
  metrics: PostMetrics[];
  agentLogs: AgentLog[];
}

const pillarChartColors: Record<string, string> = {
  ai_agents: "#6366f1",
  defence_training: "#22c55e",
  academic_research: "#22d3ee",
  ceo_journey: "#eab308",
  curated_commentary: "#f97316",
};

const HOUR_BUCKETS = [7, 9, 12, 14, 17, 19, 21];

function engagedScore(m?: PostMetrics) {
  if (!m) return 0;
  return m.likes + 2 * m.comments + 3 * m.reposts;
}

type ChannelFilter = "all" | "linkedin" | "x" | "bluesky" | "threads";

export function AnalyticsView({ posts, metrics, agentLogs }: AnalyticsViewProps) {
  const [brief, setBrief] = useState<WeeklyBrief | null>(null);
  const [briefLoading, setBriefLoading] = useState(false);
  const [channel, setChannel] = useState<ChannelFilter>("linkedin");
  const [syncing, setSyncing] = useState(false);

  useEffect(() => {
    supabase
      .from("weekly_briefs")
      .select("*")
      .order("week_start", { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => setBrief(data as unknown as WeeklyBrief));
  }, []);

  const syncLinkedInMetrics = async () => {
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("sync-linkedin-metrics", { body: {} });
      if (error) throw error;
      console.log("sync-linkedin-metrics:", data);
    } catch (e) {
      console.error("sync failed", e);
    } finally {
      setSyncing(false);
    }
  };


  const metricsById = new Map(metrics.map((m) => [m.post_id, m]));

  // Weekly posts (last 8 weeks)
  const weeklyData = Array.from({ length: 8 }, (_, i) => {
    const weekEnd = new Date();
    weekEnd.setDate(weekEnd.getDate() - i * 7);
    const weekStart = new Date(weekEnd);
    weekStart.setDate(weekStart.getDate() - 7);
    const count = posts.filter(
      (p) => p.status === "published" && p.published_at &&
        new Date(p.published_at) >= weekStart && new Date(p.published_at) < weekEnd
    ).length;
    return {
      week: weekStart.toLocaleDateString("en-GB", { day: "numeric", month: "short" }),
      posts: count,
    };
  }).reverse();

  // Avg likes by pillar
  const pillarData = Object.entries(PILLARS).map(([key, val]) => {
    const pillarPosts = posts.filter((p) => p.pillar === key && p.status === "published");
    const pillarMetrics = pillarPosts.map((p) => metricsById.get(p.id)).filter(Boolean) as PostMetrics[];
    const avgLikes = pillarMetrics.length > 0
      ? Math.round(pillarMetrics.reduce((s, m) => s + m.likes, 0) / pillarMetrics.length)
      : 0;
    return { pillar: val.label, avgLikes, key };
  });

  // Approval rate
  const totalDecided = posts.filter((p) => p.status === "approved" || p.status === "published" || p.status === "rejected").length;
  const totalApproved = posts.filter((p) => p.status === "approved" || p.status === "published").length;
  const approvalRate = totalDecided > 0 ? Math.round((totalApproved / totalDecided) * 100) : 0;

  // Monthly cost
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthlyCost = agentLogs
    .filter((l) => new Date(l.created_at) >= monthStart)
    .reduce((sum, l) => sum + (Number(l.api_cost_usd) || 0), 0);

  // Cost per engaged impression (last 30d)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000);
  const recentPosts = posts.filter((p) => p.status === "published" && p.published_at && new Date(p.published_at) >= thirtyDaysAgo);
  const engagedTotal = recentPosts.reduce((s, p) => s + engagedScore(metricsById.get(p.id)), 0);
  const cost30 = agentLogs
    .filter((l) => new Date(l.created_at) >= thirtyDaysAgo)
    .reduce((s, l) => s + (Number(l.api_cost_usd) || 0), 0);
  const costPerEngaged = engagedTotal > 0 ? cost30 / engagedTotal : null;

  // Pillar × time-of-day heatmap
  const heatmap: { pillar: string; hour: number; total: number; count: number; avg: number; key: string }[] = [];
  for (const [key, val] of Object.entries(PILLARS)) {
    for (const hour of HOUR_BUCKETS) {
      const rowPosts = recentPosts.filter((p) => {
        if (p.pillar !== key || !p.published_at) return false;
        const h = new Date(p.published_at).getHours();
        return Math.abs(h - hour) <= 1;
      });
      const total = rowPosts.reduce((s, p) => s + engagedScore(metricsById.get(p.id)), 0);
      const avg = rowPosts.length > 0 ? total / rowPosts.length : 0;
      heatmap.push({ pillar: val.label, hour, total, count: rowPosts.length, avg, key });
    }
  }
  const maxAvg = Math.max(1, ...heatmap.map((c) => c.avg));

  // Hook pattern leaderboard
  const hookAgg = new Map<string, { count: number; totalEngaged: number }>();
  for (const p of recentPosts) {
    const pattern = p.hook_pattern ?? "unknown";
    const engaged = engagedScore(metricsById.get(p.id));
    const cur = hookAgg.get(pattern) ?? { count: 0, totalEngaged: 0 };
    cur.count += 1;
    cur.totalEngaged += engaged;
    hookAgg.set(pattern, cur);
  }
  const hookRows = Array.from(hookAgg.entries())
    .map(([pattern, v]) => ({ pattern, count: v.count, avg: v.count ? Math.round(v.totalEngaged / v.count) : 0 }))
    .sort((a, b) => b.avg - a.avg);

  const runWeeklyBrief = async () => {
    setBriefLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("weekly-brief", { body: {} });
      if (error) throw error;
      const { data: latest } = await supabase
        .from("weekly_briefs")
        .select("*")
        .order("week_start", { ascending: false })
        .limit(1)
        .maybeSingle();
      setBrief(latest as unknown as WeeklyBrief);
      console.log("weekly-brief:", data);
    } catch (e) {
      console.error("weekly-brief failed", e);
    } finally {
      setBriefLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="card-surface p-5 text-center">
          <p className="text-3xl font-bold text-primary">{approvalRate}%</p>
          <p className="text-sm text-muted-foreground mt-1">Approval Rate</p>
        </div>
        <div className="card-surface p-5 text-center">
          <p className="text-3xl font-bold text-foreground">{totalApproved}</p>
          <p className="text-sm text-muted-foreground mt-1">Total Approved</p>
        </div>
        <div className="card-surface p-5 text-center">
          <p className="text-3xl font-bold text-warning">${monthlyCost.toFixed(2)}</p>
          <p className="text-sm text-muted-foreground mt-1">API Cost / Month</p>
        </div>
        <div className="card-surface p-5 text-center">
          <p className="text-3xl font-bold text-foreground">
            {costPerEngaged !== null ? `$${costPerEngaged.toFixed(4)}` : "—"}
          </p>
          <p className="text-sm text-muted-foreground mt-1">Cost / Engaged (30d)</p>
        </div>
      </div>

      {/* Weekly CEO brief */}
      <div className="card-surface p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Weekly CEO Brief</h3>
          <Button size="sm" variant="outline" onClick={runWeeklyBrief} disabled={briefLoading}>
            {briefLoading ? "Generating..." : brief ? "Regenerate" : "Generate"}
          </Button>
        </div>
        {brief ? (
          <div className="space-y-3">
            <p className="text-xs text-muted-foreground">Week of {brief.week_start}</p>
            <pre className="whitespace-pre-wrap text-sm text-foreground/90 font-sans leading-relaxed">
              {brief.summary_md}
            </pre>
            {brief.recommendations?.length > 0 && (
              <div className="pt-3 border-t border-border/50">
                <p className="text-xs font-semibold text-primary uppercase tracking-wider mb-2">Do this next week</p>
                <ul className="space-y-1 text-sm">
                  {brief.recommendations.map((r, i) => (
                    <li key={i} className="flex gap-2"><span className="text-primary">→</span>{r}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">No brief yet — generate one to see what worked, what flopped, and what to do next week.</p>
        )}
      </div>

      {/* Pillar × time heatmap */}
      <div className="card-surface p-5 space-y-3">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
            Pillar × Time Heatmap (avg engaged, last 30d)
          </h3>
          <div className="flex items-center gap-2 flex-wrap">
            <div className="flex items-center gap-1 rounded-full border border-border bg-secondary/40 p-0.5">
              {(["all", "linkedin", "x", "bluesky", "threads"] as ChannelFilter[]).map((c) => (
                <button
                  key={c}
                  onClick={() => setChannel(c)}
                  className={`text-[10px] px-2.5 py-1 rounded-full transition capitalize ${
                    channel === c ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {c === "x" ? "X" : c}
                </button>
              ))}
            </div>
            <Button size="sm" variant="outline" onClick={syncLinkedInMetrics} disabled={syncing} className="h-7 text-[11px]">
              {syncing ? "Syncing…" : "Sync LinkedIn now"}
            </Button>
          </div>
        </div>
        {channel !== "all" && channel !== "linkedin" ? (
          <p className="text-xs text-muted-foreground py-6 text-center">
            {channel === "x" ? "X" : channel[0].toUpperCase() + channel.slice(1)} metrics sync is not yet wired.
            Connect the channel secrets and add a <code className="text-[10px]">sync-{channel}-metrics</code> cron to light this up.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr>
                  <th className="text-left py-2 pr-3 text-muted-foreground font-medium">Pillar</th>
                  {HOUR_BUCKETS.map((h) => (
                    <th key={h} className="text-center py-2 px-2 text-muted-foreground font-medium">
                      {h.toString().padStart(2, "0")}:00
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Object.entries(PILLARS).map(([key, val]) => (
                  <tr key={key} className="border-t border-border/40">
                    <td className="py-2 pr-3 text-foreground/90">{val.label}</td>
                    {HOUR_BUCKETS.map((h) => {
                      const cell = heatmap.find((c) => c.key === key && c.hour === h);
                      const intensity = cell ? cell.avg / maxAvg : 0;
                      const alpha = 0.08 + intensity * 0.72;
                      return (
                        <td key={h} className="text-center py-2 px-1">
                          <div
                            className="rounded-md py-2 text-foreground"
                            style={{ background: `rgba(99, 102, 241, ${alpha.toFixed(2)})` }}
                            title={`${cell?.count ?? 0} posts, avg ${Math.round(cell?.avg ?? 0)} engaged`}
                          >
                            {cell && cell.count > 0 ? Math.round(cell.avg) : "·"}
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>


      {/* Hook leaderboard */}
      <div className="card-surface p-5 space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Hook Pattern Leaderboard (last 30d)
        </h3>
        {hookRows.length === 0 ? (
          <p className="text-sm text-muted-foreground">Not enough published posts yet.</p>
        ) : (
          <div className="space-y-2">
            {hookRows.map((h) => (
              <div key={h.pattern} className="flex items-center gap-3">
                <div className="w-40 text-sm text-foreground/90 capitalize">{h.pattern.replace(/_/g, " ")}</div>
                <div className="flex-1 h-6 bg-secondary/30 rounded overflow-hidden">
                  <div
                    className="h-full bg-primary/70"
                    style={{ width: `${Math.min(100, (h.avg / (hookRows[0]?.avg || 1)) * 100)}%` }}
                  />
                </div>
                <div className="w-24 text-right text-xs text-muted-foreground">
                  {h.avg} avg · {h.count} posts
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="card-surface p-5 space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Weekly Posts (Last 8 Weeks)</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeklyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(215 28% 17%)" />
              <XAxis dataKey="week" tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} allowDecimals={false} />
              <Tooltip contentStyle={{ backgroundColor: "#111827", border: "1px solid #1e293b", borderRadius: 8, color: "#e2e8f0" }} />
              <Bar dataKey="posts" fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className="card-surface p-5 space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Avg Likes by Pillar</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={pillarData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(215 28% 17%)" />
              <XAxis dataKey="pillar" tick={{ fill: "#94a3b8", fontSize: 10 }} />
              <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} allowDecimals={false} />
              <Tooltip contentStyle={{ backgroundColor: "#111827", border: "1px solid #1e293b", borderRadius: 8, color: "#e2e8f0" }} />
              <Bar dataKey="avgLikes" radius={[4, 4, 0, 0]}>
                {pillarData.map((entry) => (
                  <Cell key={entry.key} fill={pillarChartColors[entry.key] || "#6366f1"} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}
