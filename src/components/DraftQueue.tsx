import { useState } from "react";
import { Post } from "@/types/database";
import { DraftCard } from "./DraftCard";
import { PILLARS, PillarKey } from "@/lib/constants";
import { FileText, CheckCircle2, XCircle, ChevronRight, ShieldCheck, Link2, Wand2, Loader2 } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { detectScorecard } from "@/lib/scorecard";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

interface DraftQueueProps {
  posts: Post[];
  onUpdate: () => void;
}

const pillarClassMap: Record<string, string> = {
  ai_agents: "bg-pillar-ai/15 text-pillar-ai",
  defence_training: "bg-pillar-defence/15 text-pillar-defence",
  academic_research: "bg-pillar-academic/15 text-pillar-academic",
  ceo_journey: "bg-pillar-ceo/15 text-pillar-ceo",
  curated_commentary: "bg-pillar-commentary/15 text-pillar-commentary",
};

function Row({ post, onClick }: { post: Post; onClick: () => void }) {
  const pillar = PILLARS[post.pillar as PillarKey];
  const first = post.content.split("\n").find((l) => l.trim().length > 0) || post.content;
  const scorecard = detectScorecard(post).ok;
  const verified = post.verification_status === "passed";
  const date = new Date(post.approved_at || post.created_at);

  return (
    <button
      onClick={onClick}
      className="w-full text-left p-4 hover:bg-secondary/40 active:bg-secondary/60 transition flex items-start gap-3"
    >
      <div className="flex-1 min-w-0 space-y-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full ${pillarClassMap[post.pillar] || ""}`}>
            {pillar?.label || post.pillar}
          </span>
          <span className="text-[10px] text-muted-foreground">
            {date.toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
          </span>
          {verified && (
            <span className="inline-flex items-center gap-1 text-[10px] text-success">
              <ShieldCheck className="w-3 h-3" />
            </span>
          )}
          {scorecard && (
            <span className="inline-flex items-center gap-1 text-[10px] text-primary" title="Scorecard attached">
              <Link2 className="w-3 h-3" />
            </span>
          )}
        </div>
        <p className="font-serif text-[14px] leading-snug text-foreground line-clamp-2">{first}</p>
      </div>
      <ChevronRight className="w-4 h-4 text-muted-foreground/60 shrink-0 mt-1" />
    </button>
  );
}

function Section({
  title, icon: Icon, tone, posts, onOpen, emptyText,
}: {
  title: string; icon: typeof FileText; tone: string; posts: Post[];
  onOpen: (p: Post) => void; emptyText?: string;
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <div className={`flex items-center gap-1.5 label-eyebrow ${tone}`}>
          <Icon className="w-3 h-3" /> {title}
        </div>
        <span className="text-[10px] text-muted-foreground num">{posts.length}</span>
      </div>
      {posts.length === 0 ? (
        emptyText ? <p className="text-xs text-muted-foreground px-1">{emptyText}</p> : null
      ) : (
        <div className="card-surface divide-y divide-[hsl(var(--hairline)/0.06)]">
          {posts.map((p) => (
            <Row key={p.id} post={p} onClick={() => onOpen(p)} />
          ))}
        </div>
      )}
    </div>
  );
}

export function DraftQueue({ posts, onUpdate }: DraftQueueProps) {
  const { toast } = useToast();
  const [openPost, setOpenPost] = useState<Post | null>(null);
  const [busy, setBusy] = useState<null | "approve_high" | "reject_low" | "regen_failed">(null);

  const drafts = posts
    .filter((p) => p.status === "draft")
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  const approved = posts
    .filter((p) => p.status === "approved")
    .sort((a, b) => new Date(b.approved_at || b.created_at).getTime() - new Date(a.approved_at || a.created_at).getTime());
  const rejected = posts
    .filter((p) => p.status === "rejected")
    .sort((a, b) => new Date(b.rejected_at || b.created_at).getTime() - new Date(a.rejected_at || a.created_at).getTime())
    .slice(0, 20);

  const livePost = openPost ? posts.find((p) => p.id === openPost.id) || openPost : null;

  const highDrafts = drafts.filter(
    (d) => d.engagement_estimate === "high" && d.verification_status === "passed"
  );
  const lowDrafts = drafts.filter((d) => d.engagement_estimate === "low");
  const failedVerify = drafts.filter((d) => d.verification_status === "failed");

  const bulkApproveHigh = async () => {
    if (highDrafts.length === 0) return;
    setBusy("approve_high");
    const ids = highDrafts.map((d) => d.id);
    const { error } = await supabase
      .from("posts")
      .update({ status: "approved", approved_at: new Date().toISOString() })
      .in("id", ids);
    setBusy(null);
    if (error) toast({ title: "Bulk approve failed", description: error.message, variant: "destructive" });
    else toast({ title: `Approved ${ids.length} high-engagement draft${ids.length === 1 ? "" : "s"}` });
    onUpdate();
  };

  const bulkRejectLow = async () => {
    if (lowDrafts.length === 0) return;
    setBusy("reject_low");
    const ids = lowDrafts.map((d) => d.id);
    const { error } = await supabase
      .from("posts")
      .update({ status: "rejected", rejection_reason: "Bulk: low engagement", rejected_at: new Date().toISOString() })
      .in("id", ids);
    setBusy(null);
    if (error) toast({ title: "Bulk reject failed", description: error.message, variant: "destructive" });
    else toast({ title: `Rejected ${ids.length} low-engagement draft${ids.length === 1 ? "" : "s"}` });
    onUpdate();
  };

  const regenerateFailed = async () => {
    if (failedVerify.length === 0) return;
    setBusy("regen_failed");
    // Reject the failed set, then trigger fresh draft(s) — one per pillar in the set.
    const ids = failedVerify.map((d) => d.id);
    await supabase
      .from("posts")
      .update({ status: "rejected", rejection_reason: "Bulk: failed verification, regenerating", rejected_at: new Date().toISOString() })
      .in("id", ids);
    const pillars = Array.from(new Set(failedVerify.map((d) => d.pillar)));
    for (const pillar of pillars) {
      try {
        await supabase.functions.invoke("generate-draft", { body: { pillar_override: pillar } });
      } catch (e) {
        // continue
      }
    }
    setBusy(null);
    toast({ title: `Regenerating ${pillars.length} draft${pillars.length === 1 ? "" : "s"}` });
    onUpdate();
  };

  if (drafts.length === 0 && approved.length === 0 && rejected.length === 0) {
    return (
      <div className="card-surface p-12 flex flex-col items-center justify-center text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <FileText className="w-8 h-8 text-primary" />
        </div>
        <div>
          <p className="text-foreground font-medium">No drafts yet</p>
          <p className="text-sm text-muted-foreground mt-1">
            CEO Pen drafts at 7:30 AM UTC on weekdays.
          </p>
        </div>
      </div>
    );
  }

  const hasBulk = highDrafts.length + lowDrafts.length + failedVerify.length > 0;

  return (
    <>
      <div className="space-y-6">
        {hasBulk && (
          <div className="card-surface p-3 flex flex-wrap items-center gap-2">
            <span className="label-eyebrow text-muted-foreground pl-1 pr-2 flex items-center gap-1.5">
              <Wand2 className="w-3 h-3" /> Bulk actions
            </span>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-[11px]"
              disabled={busy !== null || highDrafts.length === 0}
              onClick={bulkApproveHigh}
            >
              {busy === "approve_high" && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
              Approve all High ({highDrafts.length})
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-[11px]"
              disabled={busy !== null || lowDrafts.length === 0}
              onClick={bulkRejectLow}
            >
              {busy === "reject_low" && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
              Reject all Low ({lowDrafts.length})
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-[11px]"
              disabled={busy !== null || failedVerify.length === 0}
              onClick={regenerateFailed}
            >
              {busy === "regen_failed" && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
              Regenerate Failed-verify ({failedVerify.length})
            </Button>
          </div>
        )}

        <Section
          title="Approved · awaiting publish"
          icon={CheckCircle2}
          tone="text-success"
          posts={approved}
          onOpen={setOpenPost}
          emptyText="Nothing approved is waiting to go out."
        />
        <Section
          title={`Drafts in queue`}
          icon={FileText}
          tone="text-foreground/70"
          posts={drafts}
          onOpen={setOpenPost}
          emptyText="No drafts in the queue right now."
        />
        {rejected.length > 0 && (
          <Section
            title="Recently rejected"
            icon={XCircle}
            tone="text-muted-foreground"
            posts={rejected}
            onOpen={setOpenPost}
          />
        )}
      </div>

      <Dialog open={!!livePost} onOpenChange={(o) => !o && setOpenPost(null)}>
        <DialogContent className="max-w-[calc(100vw-1rem)] sm:max-w-2xl max-h-[90vh] overflow-y-auto p-0 bg-transparent border-0 shadow-none">
          {livePost && <DraftCard post={livePost} onUpdate={onUpdate} />}
        </DialogContent>
      </Dialog>
    </>
  );
}
