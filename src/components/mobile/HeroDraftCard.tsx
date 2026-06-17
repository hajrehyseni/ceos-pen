import { useState } from "react";
import { Post } from "@/types/database";
import { PILLARS, PillarKey } from "@/lib/constants";
import { Check, X, ShieldCheck, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DraftCard } from "@/components/DraftCard";
import { ScorecardBadge } from "@/components/ScorecardBadge";
import { COPY } from "@/lib/copy";

interface Props {
  drafts: Post[];
  onUpdate: () => void;
}

const pillarClassMap: Record<string, string> = {
  ai_agents: "bg-pillar-ai/15 text-pillar-ai",
  defence_training: "bg-pillar-defence/15 text-pillar-defence",
  academic_research: "bg-pillar-academic/15 text-pillar-academic",
  ceo_journey: "bg-pillar-ceo/15 text-pillar-ceo",
  curated_commentary: "bg-pillar-commentary/15 text-pillar-commentary",
};

export function HeroDraftCard({ drafts, onUpdate }: Props) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();

  if (drafts.length === 0) {
    return (
      <section className="space-y-2">
        <h2 className="label-eyebrow px-1">Draft of the day</h2>
        <div className="card-surface p-8 text-center space-y-2">
          <p className="text-foreground font-medium font-serif text-lg">{COPY.emptyAllCaught}</p>
        </div>
      </section>
    );
  }

  const post = drafts[0];
  const pillar = PILLARS[post.pillar as PillarKey];
  const score = typeof post.virality_score === "number" ? post.virality_score : null;
  const verified = post.verification_status === "passed";
  const firstLine = post.content.split("\n").find((l) => l.trim().length > 0) || post.content;

  const handleApprove = async () => {
    setBusy(true);
    await supabase.from("posts").update({ status: "approved", approved_at: new Date().toISOString() }).eq("id", post.id);
    toast({ title: COPY.approveSuccess });
    onUpdate();
    setBusy(false);
  };

  const handleReject = async () => {
    setBusy(true);
    await supabase.from("posts").update({ status: "rejected", rejected_at: new Date().toISOString() }).eq("id", post.id);
    toast({ title: COPY.rejectSuccess });
    onUpdate();
    setBusy(false);
  };

  return (
    <section className="space-y-3">
      <h2 className="label-eyebrow px-1">Draft of the day</h2>

      <article className="card-elevated p-5 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${pillarClassMap[post.pillar] || ""}`}>
            {pillar?.label || post.pillar}
          </span>
          <div className="flex items-center gap-2 text-[10px]">
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

        <p className="font-serif text-[19px] leading-snug text-foreground line-clamp-3">
          {firstLine}
        </p>

        <ScorecardBadge post={post} onUpdate={onUpdate} size="sm" />
      </article>

      <div className="grid grid-cols-3 gap-2">
        <Button
          size="lg"
          variant="outline"
          className="h-12 text-[13px] font-medium rounded-xl border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive tap-press"
          onClick={handleReject}
          disabled={busy}
        >
          <X className="w-4 h-4 mr-1" /> Reject
        </Button>
        <Button
          size="lg"
          variant="outline"
          className="h-12 text-[13px] font-medium rounded-xl tap-press"
          onClick={() => setOpen(true)}
        >
          <ExternalLink className="w-4 h-4 mr-1" /> Open
        </Button>
        <Button
          size="lg"
          className="h-12 text-[13px] font-semibold rounded-xl bg-success hover:bg-success/90 text-success-foreground tap-press"
          onClick={handleApprove}
          disabled={busy}
        >
          <Check className="w-4 h-4 mr-1" /> Approve
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[calc(100vw-1rem)] sm:max-w-2xl max-h-[90vh] overflow-y-auto p-0 bg-transparent border-0 shadow-none">
          <DraftCard post={post} onUpdate={() => { onUpdate(); }} />
        </DialogContent>
      </Dialog>
    </section>
  );
}
