import { Post, PostMetrics, AgentLog } from "@/types/database";
import { PILLARS, PillarKey } from "@/lib/constants";

interface QuickStatsProps {
  posts: Post[];
  metrics: PostMetrics[];
  agentLogs: AgentLog[];
}

export function QuickStats({ posts, metrics, agentLogs }: QuickStatsProps) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const publishedPosts = posts.filter((p) => p.status === "published");
  const recentPublished = publishedPosts.filter(
    (p) => p.published_at && new Date(p.published_at) > thirtyDaysAgo
  );

  const recentMetrics = metrics.filter((m) =>
    recentPublished.some((p) => p.id === m.post_id)
  );

  const avgLikes = recentMetrics.length > 0
    ? Math.round(recentMetrics.reduce((sum, m) => sum + m.likes, 0) / recentMetrics.length)
    : 0;

  const avgComments = recentMetrics.length > 0
    ? Math.round(recentMetrics.reduce((sum, m) => sum + m.comments, 0) / recentMetrics.length)
    : 0;

  // Best pillar
  const pillarLikes: Record<string, { total: number; count: number }> = {};
  recentPublished.forEach((p) => {
    const m = recentMetrics.find((met) => met.post_id === p.id);
    if (m) {
      if (!pillarLikes[p.pillar]) pillarLikes[p.pillar] = { total: 0, count: 0 };
      pillarLikes[p.pillar].total += m.likes;
      pillarLikes[p.pillar].count += 1;
    }
  });

  let bestPillar = "—";
  let bestAvg = 0;
  Object.entries(pillarLikes).forEach(([key, val]) => {
    const avg = val.total / val.count;
    if (avg > bestAvg) {
      bestAvg = avg;
      bestPillar = PILLARS[key as PillarKey]?.label || key;
    }
  });

  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const publishedThisMonth = publishedPosts.filter(
    (p) => p.published_at && new Date(p.published_at) >= monthStart
  ).length;

  const apiCostMonth = agentLogs
    .filter((l) => new Date(l.created_at) >= monthStart)
    .reduce((sum, l) => sum + (Number(l.api_cost_usd) || 0), 0);

  const stats = [
    { label: "Avg Likes", value: avgLikes.toString() },
    { label: "Avg Comments", value: avgComments.toString() },
    { label: "Best Pillar", value: bestPillar },
    { label: "Published (Month)", value: publishedThisMonth.toString() },
    { label: "API Cost (Month)", value: `$${apiCostMonth.toFixed(2)}` },
  ];

  return (
    <div className="card-surface p-5 space-y-3">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Quick Stats</h3>
      <div className="space-y-2">
        {stats.map((s) => (
          <div key={s.label} className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">{s.label}</span>
            <span className="text-foreground font-medium">{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
