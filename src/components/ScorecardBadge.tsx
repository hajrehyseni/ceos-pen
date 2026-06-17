import { useState } from "react";
import { Sparkles, AlertTriangle, Loader2 } from "lucide-react";
import { detectScorecard, DEFAULT_SOFT_CTA, normaliseScorecardUrl } from "@/lib/scorecard";
import { COPY } from "@/lib/copy";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import type { Post } from "@/types/database";

interface Props {
  post: Pick<Post, "id" | "content" | "first_comment_text">;
  onUpdate?: () => void;
  size?: "sm" | "md";
}

export function ScorecardBadge({ post, onUpdate, size = "md" }: Props) {
  const { toast } = useToast();
  const [busy, setBusy] = useState(false);
  const s = detectScorecard(post);
  const px = size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-2.5 py-1 text-[11px]";

  const attach = async () => {
    setBusy(true);
    // Also normalise body in case there's a bare URL hanging around.
    const cleanBody = normaliseScorecardUrl(post.content);
    const { error } = await supabase
      .from("posts")
      .update({
        first_comment_text: DEFAULT_SOFT_CTA,
        ...(cleanBody !== post.content ? { content: cleanBody } : {}),
      })
      .eq("id", post.id);
    setBusy(false);
    if (error) {
      toast({ title: COPY.errorGeneric, description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Scorecard attached", description: "Added to first comment." });
    onUpdate?.();
  };

  if (s.ok) {
    return (
      <span className={`inline-flex items-center gap-1 rounded-full bg-success/12 text-success ${px} font-medium`}>
        <Sparkles className="w-3 h-3" />
        Scorecard: {s.label}
      </span>
    );
  }

  return (
    <span className="inline-flex items-center gap-1.5">
      <span className={`inline-flex items-center gap-1 rounded-full bg-warning/12 text-warning ${px} font-medium`}>
        <AlertTriangle className="w-3 h-3" />
        Scorecard missing
      </span>
      <button
        onClick={attach}
        disabled={busy}
        className={`inline-flex items-center gap-1 rounded-full bg-primary text-primary-foreground ${px} font-medium tap-press disabled:opacity-60`}
      >
        {busy ? <Loader2 className="w-3 h-3 animate-spin" /> : null}
        {COPY.scorecardAttach}
      </button>
    </span>
  );
}
