import { Post, PostMetrics } from "@/types/database";
import { PILLARS, PillarKey } from "@/lib/constants";

interface RecentPerformanceProps {
  posts: Post[];
  metrics: PostMetrics[];
}

export function RecentPerformance({ posts, metrics }: RecentPerformanceProps) {
  const published = posts
    .filter((p) => p.status === "published")
    .sort((a, b) => new Date(b.published_at!).getTime() - new Date(a.published_at!).getTime())
    .slice(0, 5);

  return (
    <div className="card-surface p-5 space-y-3">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">Recent Performance</h3>
      {published.length === 0 ? (
        <p className="text-xs text-muted-foreground">No published posts yet</p>
      ) : (
        <div className="space-y-2">
          {published.map((post) => {
            const m = metrics.find((met) => met.post_id === post.id);
            const pillar = PILLARS[post.pillar as PillarKey];
            return (
              <div key={post.id} className="text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="text-muted-foreground">
                    {new Date(post.published_at!).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                  </span>
                  <span className="text-muted-foreground">{pillar?.label}</span>
                </div>
                <p className="text-foreground truncate">{post.content.slice(0, 50)}...</p>
                <div className="flex gap-3 text-muted-foreground">
                  <span>❤️ {m?.likes || 0}</span>
                  <span>💬 {m?.comments || 0}</span>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
