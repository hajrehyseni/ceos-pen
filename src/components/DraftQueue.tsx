import { Post } from "@/types/database";
import { DraftCard } from "./DraftCard";
import { FileText } from "lucide-react";

interface DraftQueueProps {
  posts: Post[];
  onUpdate: () => void;
}

export function DraftQueue({ posts, onUpdate }: DraftQueueProps) {
  const drafts = posts.filter((p) => p.status === "draft" || p.status === "approved");

  if (drafts.length === 0) {
    return (
      <div className="card-surface p-12 flex flex-col items-center justify-center text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <FileText className="w-8 h-8 text-primary" />
        </div>
        <div>
          <p className="text-foreground font-medium">No drafts waiting</p>
          <p className="text-sm text-muted-foreground mt-1">
            CEO Pen drafts at 7:30 AM UTC on weekdays.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
        Drafts ({drafts.length})
      </h2>
      {drafts.map((post) => (
        <DraftCard key={post.id} post={post} onUpdate={onUpdate} />
      ))}
    </div>
  );
}
