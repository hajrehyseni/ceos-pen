import { useState } from "react";
import { Post, PostMetrics } from "@/types/database";
import { PILLARS, PillarKey } from "@/lib/constants";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

interface PublishedViewProps {
  posts: Post[];
  metrics: PostMetrics[];
}

export function PublishedView({ posts, metrics }: PublishedViewProps) {
  const [selectedPost, setSelectedPost] = useState<Post | null>(null);

  const published = posts
    .filter((p) => p.status === "published")
    .sort((a, b) => new Date(b.published_at!).getTime() - new Date(a.published_at!).getTime());

  const pillarColorMap: Record<string, string> = {
    ai_agents: "bg-pillar-ai/15 text-pillar-ai",
    defence_training: "bg-pillar-defence/15 text-pillar-defence",
    academic_research: "bg-pillar-academic/15 text-pillar-academic",
    ceo_journey: "bg-pillar-ceo/15 text-pillar-ceo",
    curated_commentary: "bg-pillar-commentary/15 text-pillar-commentary",
  };

  return (
    <>
      <div className="card-surface overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border">
              <th className="text-left p-4 text-muted-foreground font-medium">Date</th>
              <th className="text-left p-4 text-muted-foreground font-medium">Pillar</th>
              <th className="text-left p-4 text-muted-foreground font-medium hidden md:table-cell">Preview</th>
              <th className="text-right p-4 text-muted-foreground font-medium">Likes</th>
              <th className="text-right p-4 text-muted-foreground font-medium">Comments</th>
              <th className="text-right p-4 text-muted-foreground font-medium hidden lg:table-cell">Reposts</th>
              <th className="text-right p-4 text-muted-foreground font-medium hidden lg:table-cell">Impressions</th>
            </tr>
          </thead>
          <tbody>
            {published.map((post) => {
              const m = metrics.find((met) => met.post_id === post.id);
              const pillar = PILLARS[post.pillar as PillarKey];
              return (
                <tr
                  key={post.id}
                  className="border-b border-border/50 hover:bg-secondary/50 cursor-pointer transition-colors"
                  onClick={() => setSelectedPost(post)}
                >
                  <td className="p-4 text-muted-foreground">
                    {new Date(post.published_at!).toLocaleDateString("en-GB", { day: "numeric", month: "short" })}
                  </td>
                  <td className="p-4">
                    <span className={`text-xs px-2 py-1 rounded-full ${pillarColorMap[post.pillar] || ""}`}>
                      {pillar?.label}
                    </span>
                  </td>
                  <td className="p-4 text-foreground hidden md:table-cell max-w-xs truncate">
                    {post.content.slice(0, 80)}...
                  </td>
                  <td className="p-4 text-right text-foreground">{m?.likes || 0}</td>
                  <td className="p-4 text-right text-foreground">{m?.comments || 0}</td>
                  <td className="p-4 text-right text-foreground hidden lg:table-cell">{m?.reposts || 0}</td>
                  <td className="p-4 text-right text-foreground hidden lg:table-cell">{m?.impressions || 0}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {published.length === 0 && (
          <div className="p-8 text-center text-muted-foreground">No published posts yet</div>
        )}
      </div>

      <Dialog open={!!selectedPost} onOpenChange={() => setSelectedPost(null)}>
        <DialogContent className="max-w-2xl bg-card border-border">
          <DialogHeader>
            <DialogTitle className="text-foreground">
              {selectedPost && PILLARS[selectedPost.pillar as PillarKey]?.label} —{" "}
              {selectedPost?.published_at && new Date(selectedPost.published_at).toLocaleDateString("en-GB")}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">{selectedPost?.content}</p>
        </DialogContent>
      </Dialog>
    </>
  );
}
