import { Post, PostMetrics, AgentLog } from "@/types/database";
import { PILLARS, PillarKey } from "@/lib/constants";
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";

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

export function AnalyticsView({ posts, metrics, agentLogs }: AnalyticsViewProps) {
  // Weekly posts count (last 8 weeks)
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

  // Engagement by pillar
  const pillarData = Object.entries(PILLARS).map(([key, val]) => {
    const pillarPosts = posts.filter((p) => p.pillar === key && p.status === "published");
    const pillarMetrics = metrics.filter((m) => pillarPosts.some((p) => p.id === m.post_id));
    const avgLikes = pillarMetrics.length > 0
      ? Math.round(pillarMetrics.reduce((s, m) => s + m.likes, 0) / pillarMetrics.length)
      : 0;
    return { pillar: val.label, avgLikes, key };
  });

  // Approval rate
  const totalDecided = posts.filter((p) => p.status === "approved" || p.status === "published" || p.status === "rejected").length;
  const totalApproved = posts.filter((p) => p.status === "approved" || p.status === "published").length;
  const approvalRate = totalDecided > 0 ? Math.round((totalApproved / totalDecided) * 100) : 0;

  // API cost this month
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthlyCost = agentLogs
    .filter((l) => new Date(l.created_at) >= monthStart)
    .reduce((sum, l) => sum + (Number(l.api_cost_usd) || 0), 0);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
          <p className="text-sm text-muted-foreground mt-1">API Cost This Month</p>
        </div>
      </div>

      <div className="card-surface p-5 space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Weekly Posts (Last 8 Weeks)</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={weeklyData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(215 28% 17%)" />
              <XAxis dataKey="week" tick={{ fill: "#94a3b8", fontSize: 11 }} />
              <YAxis tick={{ fill: "#94a3b8", fontSize: 11 }} allowDecimals={false} />
              <Tooltip
                contentStyle={{ backgroundColor: "#111827", border: "1px solid #1e293b", borderRadius: 8, color: "#e2e8f0" }}
              />
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
              <Tooltip
                contentStyle={{ backgroundColor: "#111827", border: "1px solid #1e293b", borderRadius: 8, color: "#e2e8f0" }}
              />
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
