import { Post } from "@/types/database";
import { PILLARS, PillarKey } from "@/lib/constants";
import { ShieldCheck, ArrowUpCircle, Link2 } from "lucide-react";
import { detectScorecard } from "@/lib/scorecard";

const pillarClassMap: Record<string, string> = {
  ai_agents: "bg-pillar-ai/15 text-pillar-ai",
  defence_training: "bg-pillar-defence/15 text-pillar-defence",
  academic_research: "bg-pillar-academic/15 text-pillar-academic",
  ceo_journey: "bg-pillar-ceo/15 text-pillar-ceo",
  curated_commentary: "bg-pillar-commentary/15 text-pillar-commentary",
};

interface Props {
  post: Post;
  onPromote: () => void;
  onOpen: () => void;
}

export function AlternateDraftCard({ post, onPromote, onOpen }: Props) {
  const pillar = PILLARS[post.pillar as PillarKey];
  const score = typeof post.virality_score === "number" ? post.virality_score : null;
  const verified = post.verification_status === "passed";
  const scorecard = detectScorecard(post).ok;
  const preview = post.content
    .split("\n")
    .filter((l) => l.trim().length > 0)
    .slice(0, 2)
    .join(" · ");

  return (
    <article className="card-surface p-4 space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${pillarClassMap[post.pillar] || ""}`}>
          {pillar?.label || post.pillar}
        </span>
        <div className="flex items-center gap-2 text-[10px]">
          {scorecard && (
            <span className="inline-flex items-center gap-1 text-primary" title="Scorecard attached">
              <Link2 className="w-3 h-3" />
            </span>
          )}
          {verified && (
            <span className="inline-flex items-center gap-1 text-success">
              <ShieldCheck className="w-3 h-3" /> verified
            </span>
          )}
          {score !== null && (
            <span className="text-foreground/70 font-medium num">{score.toFixed(1)}</span>
          )}
        </div>
      </div>

      <button
        onClick={onOpen}
        className="text-left w-full"
      >
        <p className="font-serif text-[15px] leading-snug text-foreground line-clamp-2">
          {preview}
        </p>
      </button>

      <div className="flex items-center justify-between pt-1">
        <button
          onClick={onOpen}
          className="text-[11px] text-muted-foreground hover:text-foreground transition"
        >
          Open draft
        </button>
        <button
          onClick={onPromote}
          className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline"
        >
          <ArrowUpCircle className="w-3.5 h-3.5" /> Make today's pick
        </button>
      </div>
    </article>
  );
}
