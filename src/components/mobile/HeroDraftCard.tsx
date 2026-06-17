import { useState, useMemo } from "react";
import { motion, useMotionValue, useTransform, PanInfo } from "framer-motion";
import { Post } from "@/types/database";
import { PILLARS, PillarKey } from "@/lib/constants";
import { Check, X, Pencil, Linkedin, ShieldCheck, MessageCircleHeart } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DraftCard } from "@/components/DraftCard";

interface Props {
  drafts: Post[];
  onUpdate: () => void;
}

const SWIPE_THRESHOLD = 90;

const pillarClassMap: Record<string, string> = {
  ai_agents: "bg-pillar-ai/15 text-pillar-ai border-pillar-ai/40",
  defence_training: "bg-pillar-defence/15 text-pillar-defence border-pillar-defence/40",
  academic_research: "bg-pillar-academic/15 text-pillar-academic border-pillar-academic/40",
  ceo_journey: "bg-pillar-ceo/15 text-pillar-ceo border-pillar-ceo/40",
  curated_commentary: "bg-pillar-commentary/15 text-pillar-commentary border-pillar-commentary/40",
};

export function HeroDraftCard({ drafts, onUpdate }: Props) {
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-200, 0, 200], [-8, 0, 8]);
  const approveOpacity = useTransform(x, [0, 60, 120], [0, 0.6, 1]);
  const rejectOpacity = useTransform(x, [-120, -60, 0], [1, 0.6, 0]);

  if (drafts.length === 0) {
    return (
      <div className="card-surface p-6 text-center space-y-2">
        <p className="text-foreground font-semibold">All caught up</p>
        <p className="text-sm text-muted-foreground">No drafts in the queue. CEO Pen drafts at 7:30 AM UTC on weekdays.</p>
      </div>
    );
  }

  const post = drafts[index % drafts.length];
  const pillar = PILLARS[post.pillar as PillarKey];

  const scorecard = useMemo(() => {
    const inBody = /londonra\.com/i.test(post.content);
    const inComment = !!post.first_comment_text && /londonra\.com/i.test(post.first_comment_text);
    if (inBody) return { ok: true, where: "in body" as const };
    if (inComment) return { ok: true, where: "first comment" as const };
    return { ok: false, where: "missing" as const };
  }, [post.content, post.first_comment_text]);

  const advance = () => {
    setIndex((i) => (i + 1) % drafts.length);
    x.set(0);
  };

  const handleApprove = async () => {
    setBusy(true);
    await supabase.from("posts").update({ status: "approved", approved_at: new Date().toISOString() }).eq("id", post.id);
    toast({ title: "Approved" });
    onUpdate();
    advance();
    setBusy(false);
  };

  const handleReject = async () => {
    setBusy(true);
    await supabase.from("posts").update({ status: "rejected", rejected_at: new Date().toISOString() }).eq("id", post.id);
    toast({ title: "Rejected" });
    onUpdate();
    advance();
    setBusy(false);
  };

  const handlePublish = async () => {
    setBusy(true);
    try {
      const { data, error } = await supabase.functions.invoke("publish-to-linkedin", { body: { post_id: post.id } });
      if (error) throw error;
      if (data?.status === "error") throw new Error(data.error);
      toast({ title: "Published to LinkedIn" });
      onUpdate();
      advance();
    } catch (e: any) {
      toast({ title: "Publish failed", description: e.message, variant: "destructive" });
    }
    setBusy(false);
  };

  const onDragEnd = (_: any, info: PanInfo) => {
    if (info.offset.x > SWIPE_THRESHOLD) handleApprove();
    else if (info.offset.x < -SWIPE_THRESHOLD) handleReject();
    else x.set(0);
  };

  const score = typeof post.virality_score === "number" ? post.virality_score : null;
  const verified = post.verification_status === "passed";
  const queued = drafts.length - 1;

  return (
    <div className="space-y-3">
      <h2 className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground px-1">
        Draft of the day
      </h2>

      <div className="relative">
        <motion.div
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.6}
          style={{ x, rotate }}
          onDragEnd={onDragEnd}
          className="card-surface relative overflow-hidden p-4 select-none cursor-grab active:cursor-grabbing touch-pan-y"
        >
          <motion.div
            style={{ opacity: approveOpacity }}
            className="pointer-events-none absolute top-3 left-3 z-10 px-2 py-1 rounded-md border-2 border-success text-success font-bold text-xs uppercase tracking-wider rotate-[-12deg]"
          >
            Approve
          </motion.div>
          <motion.div
            style={{ opacity: rejectOpacity }}
            className="pointer-events-none absolute top-3 right-3 z-10 px-2 py-1 rounded-md border-2 border-destructive text-destructive font-bold text-xs uppercase tracking-wider rotate-[12deg]"
          >
            Reject
          </motion.div>

          <div className="flex items-center justify-between mb-3 gap-2">
            <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${pillarClassMap[post.pillar] || ""}`}>
              {pillar?.label || post.pillar}
            </span>
            <div className="flex items-center gap-2 text-[10px]">
              {verified && score !== null ? (
                <span className="inline-flex items-center gap-1 text-success">
                  <ShieldCheck className="w-3 h-3" /> {score.toFixed(1)} verified
                </span>
              ) : verified ? (
                <span className="inline-flex items-center gap-1 text-success">
                  <ShieldCheck className="w-3 h-3" /> verified
                </span>
              ) : score !== null ? (
                <span className="text-primary font-medium">{score.toFixed(1)}</span>
              ) : null}
            </div>
          </div>

          <p className="text-base font-semibold text-foreground leading-snug line-clamp-2 mb-2">
            {post.content.split("\n")[0]}
          </p>
          <p className="text-sm text-muted-foreground leading-relaxed line-clamp-4 whitespace-pre-line">
            {post.content.split("\n").slice(1).join("\n").trim() || post.content.slice(post.content.split("\n")[0].length).trim()}
          </p>

          <div className="flex items-center gap-2 mt-3 text-[10px]">
            <span
              className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full border ${
                scorecard.ok
                  ? "border-success/40 bg-success/10 text-success"
                  : "border-warning/40 bg-warning/10 text-warning"
              }`}
            >
              <MessageCircleHeart className="w-3 h-3" />
              Scorecard: {scorecard.where}
            </span>
            {post.engagement_estimate && (
              <span className={`px-1.5 py-0.5 rounded-full font-medium ${
                post.engagement_estimate === "high" ? "badge-high" :
                post.engagement_estimate === "medium" ? "badge-medium" : "badge-low"
              }`}>{post.engagement_estimate}</span>
            )}
          </div>
        </motion.div>
      </div>

      {/* Action bar — 3 buttons */}
      <div className="grid grid-cols-5 gap-2">
        <Button size="sm" variant="destructive" className="min-h-11 col-span-1" onClick={handleReject} disabled={busy} aria-label="Reject">
          <X className="w-4 h-4" />
        </Button>
        <Button size="sm" variant="outline" className="min-h-11 col-span-2" onClick={() => setOpen(true)}>
          <Pencil className="w-4 h-4 mr-1" /> Open
        </Button>
        {post.status === "approved" ? (
          <Button size="sm" className="min-h-11 col-span-2 bg-[hsl(201,100%,35%)] hover:bg-[hsl(201,100%,30%)] text-white" onClick={handlePublish} disabled={busy}>
            <Linkedin className="w-4 h-4 mr-1" /> Publish
          </Button>
        ) : (
          <Button size="sm" className="min-h-11 col-span-2 bg-success hover:bg-success/90 text-success-foreground" onClick={handleApprove} disabled={busy}>
            <Check className="w-4 h-4 mr-1" /> Approve
          </Button>
        )}
      </div>

      {queued > 0 && (
        <div className="flex items-center justify-center gap-2 pt-0.5">
          {drafts.slice(0, Math.min(drafts.length, 6)).map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              className={`h-1.5 rounded-full transition-all ${i === index ? "w-5 bg-primary" : "w-1.5 bg-border"}`}
              aria-label={`Go to draft ${i + 1}`}
            />
          ))}
          <span className="text-[10px] text-muted-foreground ml-1">{queued} more queued</span>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[calc(100vw-1rem)] sm:max-w-2xl max-h-[90vh] overflow-y-auto p-0 bg-transparent border-0 shadow-none">
          <DraftCard post={post} onUpdate={() => { onUpdate(); }} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
