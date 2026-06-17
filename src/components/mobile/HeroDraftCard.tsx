import { useState, useMemo } from "react";
import { motion, useMotionValue, useTransform, PanInfo, AnimatePresence } from "framer-motion";
import { Post } from "@/types/database";
import { PILLARS, PillarKey } from "@/lib/constants";
import { Check, X, Linkedin, ShieldCheck, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DraftCard } from "@/components/DraftCard";

interface Props {
  drafts: Post[];
  onUpdate: () => void;
}

const SWIPE_X = 110;
const SWIPE_VELOCITY = 500;

const pillarClassMap: Record<string, string> = {
  ai_agents: "bg-pillar-ai/15 text-pillar-ai",
  defence_training: "bg-pillar-defence/15 text-pillar-defence",
  academic_research: "bg-pillar-academic/15 text-pillar-academic",
  ceo_journey: "bg-pillar-ceo/15 text-pillar-ceo",
  curated_commentary: "bg-pillar-commentary/15 text-pillar-commentary",
};

export function HeroDraftCard({ drafts, onUpdate }: Props) {
  const [index, setIndex] = useState(0);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const { toast } = useToast();
  const x = useMotionValue(0);
  const rotate = useTransform(x, [-220, 0, 220], [-6, 0, 6]);
  const approveOpacity = useTransform(x, [20, 90], [0, 1]);
  const rejectOpacity = useTransform(x, [-90, -20], [1, 0]);
  const bgTint = useTransform(
    x,
    [-160, 0, 160],
    ["hsl(350 80% 56% / 0.18)", "hsl(0 0% 0% / 0)", "hsl(152 70% 45% / 0.18)"]
  );

  if (drafts.length === 0) {
    return (
      <section className="space-y-2">
        <h2 className="label-eyebrow px-1">Draft of the day</h2>
        <div className="card-surface p-6 text-center space-y-2 hero-gradient">
          <p className="text-foreground font-semibold">All caught up</p>
          <p className="text-sm text-muted-foreground">CEO Pen drafts at 7:30 AM UTC on weekdays.</p>
        </div>
      </section>
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
    setIndex((i) => (i + 1) % Math.max(drafts.length, 1));
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
    const swipedRight = info.offset.x > SWIPE_X || info.velocity.x > SWIPE_VELOCITY;
    const swipedLeft = info.offset.x < -SWIPE_X || info.velocity.x < -SWIPE_VELOCITY;
    if (swipedRight) handleApprove();
    else if (swipedLeft) handleReject();
    else x.set(0);
  };

  const score = typeof post.virality_score === "number" ? post.virality_score : null;
  const verified = post.verification_status === "passed";
  const queued = drafts.length - 1;

  const firstLine = post.content.split("\n")[0];
  const rest = post.content.split("\n").slice(1).join("\n").trim();

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h2 className="label-eyebrow">Draft of the day</h2>
        {queued > 0 && (
          <span className="text-[10px] text-muted-foreground num">
            1 / {drafts.length}
          </span>
        )}
      </div>

      <div className="relative">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div
            key={post.id}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.5}
            onDragEnd={onDragEnd}
            initial={{ opacity: 0, y: 12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0 }}
            transition={{ type: "spring", stiffness: 380, damping: 32 }}
            className="relative overflow-hidden select-none touch-pan-y rounded-[var(--radius)]"
            style={{
              x,
              rotate,
              boxShadow: "var(--shadow-hero)",
            }}
          >
            <div className="hero-gradient">
              <motion.div
                className="absolute inset-0 pointer-events-none"
                style={{ background: bgTint }}
              />

              {/* Swipe action badges */}
              <motion.div
                style={{ opacity: approveOpacity }}
                className="pointer-events-none absolute top-4 right-4 z-10 px-2.5 py-1 rounded-md border-2 border-success text-success font-bold text-[11px] uppercase tracking-widest rotate-[8deg]"
              >
                Approve
              </motion.div>
              <motion.div
                style={{ opacity: rejectOpacity }}
                className="pointer-events-none absolute top-4 left-4 z-10 px-2.5 py-1 rounded-md border-2 border-destructive text-destructive font-bold text-[11px] uppercase tracking-widest -rotate-[8deg]"
              >
                Reject
              </motion.div>

              <div className="relative p-5">
                <div className="flex items-center justify-between mb-3 gap-2">
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
                      <span className="text-foreground/80 font-medium num">{score.toFixed(1)}</span>
                    )}
                  </div>
                </div>

                <p className="text-[17px] font-semibold text-foreground leading-snug mb-2 line-clamp-3">
                  {firstLine}
                </p>
                {rest && (
                  <p className="text-[13px] text-muted-foreground leading-relaxed line-clamp-4 whitespace-pre-line">
                    {rest}
                  </p>
                )}

                <div className="flex items-center gap-2 mt-4 text-[10px]">
                  <span
                    className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full ${
                      scorecard.ok
                        ? "bg-success/10 text-success"
                        : "bg-warning/10 text-warning"
                    }`}
                  >
                    <Sparkles className="w-3 h-3" />
                    Scorecard {scorecard.where}
                  </span>
                  {post.engagement_estimate && (
                    <span className={`px-2 py-0.5 rounded-full font-medium ${
                      post.engagement_estimate === "high" ? "badge-high" :
                      post.engagement_estimate === "medium" ? "badge-medium" : "badge-low"
                    }`}>{post.engagement_estimate}</span>
                  )}
                  <button
                    onClick={() => setOpen(true)}
                    className="ml-auto text-[11px] text-muted-foreground hover:text-foreground underline-offset-2 hover:underline"
                  >
                    Open
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Hint + 2 large primary actions */}
      <p className="text-center text-[10px] text-muted-foreground tracking-wider uppercase">
        Swipe → approve · swipe ← reject
      </p>

      <div className="grid grid-cols-2 gap-2">
        <Button
          size="lg"
          variant="outline"
          className="h-14 text-sm font-semibold rounded-2xl border-destructive/30 text-destructive hover:bg-destructive/10 hover:text-destructive tap-press"
          onClick={handleReject}
          disabled={busy}
        >
          <X className="w-5 h-5 mr-2" /> Reject
        </Button>
        {post.status === "approved" ? (
          <Button
            size="lg"
            className="h-14 text-sm font-semibold rounded-2xl text-white tap-press"
            style={{ background: "hsl(201 100% 35%)" }}
            onClick={handlePublish}
            disabled={busy}
          >
            <Linkedin className="w-5 h-5 mr-2" /> Publish
          </Button>
        ) : (
          <Button
            size="lg"
            className="h-14 text-sm font-semibold rounded-2xl bg-success hover:bg-success/90 text-success-foreground tap-press"
            onClick={handleApprove}
            disabled={busy}
          >
            <Check className="w-5 h-5 mr-2" /> Approve
          </Button>
        )}
      </div>

      {queued > 0 && (
        <div className="flex items-center justify-center gap-1.5">
          {drafts.slice(0, Math.min(drafts.length, 6)).map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              className={`h-1 rounded-full transition-all ${i === index ? "w-6 bg-primary" : "w-1 bg-border"}`}
              aria-label={`Go to draft ${i + 1}`}
            />
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-[calc(100vw-1rem)] sm:max-w-2xl max-h-[90vh] overflow-y-auto p-0 bg-transparent border-0 shadow-none">
          <DraftCard post={post} onUpdate={() => { onUpdate(); }} />
        </DialogContent>
      </Dialog>
    </section>
  );
}
