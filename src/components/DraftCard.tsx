import { useState } from "react";
import { Post } from "@/types/database";
import { PILLARS, PillarKey } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Check, Pencil, X, Copy, Send, ChevronDown, ChevronUp, Clock, Linkedin, AlertTriangle, ShieldCheck, ShieldAlert, Sparkles, Wand2, Download } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { VisualStudio } from "@/components/visual-studio/VisualStudio";
import { ScorecardBadge } from "@/components/ScorecardBadge";
import { detectScorecard, normaliseScorecardUrl, DEFAULT_SOFT_CTA } from "@/lib/scorecard";
import { downloadText } from "@/components/visual-studio/exportNode";

interface DraftCardProps {
  post: Post;
  onUpdate: () => void;
}

const pillarColorMap: Record<string, string> = {
  ai_agents: "bg-pillar-ai/15 text-pillar-ai border-pillar-ai/30",
  defence_training: "bg-pillar-defence/15 text-pillar-defence border-pillar-defence/30",
  academic_research: "bg-pillar-academic/15 text-pillar-academic border-pillar-academic/30",
  ceo_journey: "bg-pillar-ceo/15 text-pillar-ceo border-pillar-ceo/30",
  curated_commentary: "bg-pillar-commentary/15 text-pillar-commentary border-pillar-commentary/30",
};

export function DraftCard({ post, onUpdate }: DraftCardProps) {
  const { toast } = useToast();
  const [editing, setEditing] = useState(false);
  const [editContent, setEditContent] = useState(post.content);
  const [editNotes, setEditNotes] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [rejectionReason, setRejectionReason] = useState("");
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [verifyOpen, setVerifyOpen] = useState(false);
  const [scoreOpen, setScoreOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [tweaking, setTweaking] = useState<string | null>(null);

  const TWEAKS: Array<{ key: string; label: string }> = [
    { key: "add_british_humour", label: "Add British humour" },
    { key: "make_more_fun", label: "Make it more fun" },
    { key: "less_corporate", label: "Make it less corporate" },
    { key: "sound_more_like_hajre", label: "Sound more like Hajrë" },
    { key: "less_salesy_cta", label: "Soften CTA" },
  ];

  const scorecardStatus = detectScorecard(post);
  const scorecardOk = scorecardStatus.ok;

  const handleTweak = async (key: string, label: string) => {
    setTweaking(key);
    try {
      const { data, error } = await supabase.functions.invoke("tone-tune", {
        body: { post_id: post.id, tweak: key },
      });
      if (error) throw error;
      if (data?.status === "error") throw new Error(data.error);
      toast({ title: label, description: "Draft updated." });
      onUpdate();
    } catch (e: any) {
      toast({ title: "Tweak failed", description: e.message, variant: "destructive" });
    }
    setTweaking(null);
  };

  const pillar = PILLARS[post.pillar as PillarKey];
  const pillarClasses = pillarColorMap[post.pillar] || "";

  const handleApprove = async () => {
    setLoading(true);
    await supabase
      .from("posts")
      .update({ status: "approved", approved_at: new Date().toISOString() })
      .eq("id", post.id);
    toast({ title: "Post approved" });
    onUpdate();
    setLoading(false);
  };

  const handleSaveEdit = async () => {
    setLoading(true);
    await supabase
      .from("posts")
      .update({ content: editContent, edit_notes: editNotes || null })
      .eq("id", post.id);
    toast({ title: "Post updated" });
    setEditing(false);
    onUpdate();
    setLoading(false);
  };

  const handleReject = async () => {
    setLoading(true);
    await supabase
      .from("posts")
      .update({ status: "rejected", rejection_reason: rejectionReason || null, rejected_at: new Date().toISOString() })
      .eq("id", post.id);
    toast({ title: "Post rejected" });
    setRejecting(false);
    onUpdate();
    setLoading(false);
  };

  const handleCopy = async () => {
    await navigator.clipboard.writeText(post.content);
    toast({ title: "Copied to clipboard" });
  };

  const handleDownloadText = async () => {
    const body = post.first_comment_text
      ? `${post.content}\n\n---\nFirst comment:\n${post.first_comment_text}`
      : post.content;
    const stamp = new Date(post.created_at).toISOString().slice(0, 10);
    await downloadText(body, `ceo-pen-${post.pillar}-${stamp}.txt`);
    toast({ title: "Draft download started", description: "Check Safari Downloads if it is not visible." });
  };

  const handleMarkPublished = async () => {
    setLoading(true);
    await supabase
      .from("posts")
      .update({ status: "published", published_at: new Date().toISOString() })
      .eq("id", post.id);
    toast({ title: "Post marked as published" });
    onUpdate();
    setLoading(false);
  };

  const handlePublishLinkedIn = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke("publish-to-linkedin", {
        body: { post_id: post.id },
      });
      if (error) throw error;
      if (data?.status === "error") throw new Error(data.error);
      toast({ title: "Published to LinkedIn!", description: "Post is now live." });
      onUpdate();
    } catch (e: any) {
      toast({ title: "LinkedIn publish failed", description: e.message, variant: "destructive" });
    }
    setLoading(false);
  };

  const sources = post.source_material as any[] | null;

  return (
    <div className="card-surface p-4 sm:p-6 space-y-4">

      {/* Pillar tag */}
      <div className="flex items-center justify-between">
        <span className={`text-xs font-medium px-3 py-1 rounded-full border ${pillarClasses}`}>
          {pillar?.label || post.pillar}
        </span>
        <span className="text-xs text-muted-foreground">
          {new Date(post.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>

      {/* No-source warning */}
      {(!sources || sources.length === 0) && (
        <div className="flex items-start gap-2 px-3 py-2 rounded-md border border-warning/40 bg-warning/10 text-warning text-xs">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>No source — may contain fabricated content. Review carefully before publishing.</span>
        </div>
      )}

      {/* Fact-check verification badge */}
      {post.verification_status === "passed" && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-md border border-success/40 bg-success/10 text-success text-xs">
          <ShieldCheck className="w-4 h-4 shrink-0" />
          <span className="font-medium">Verified — every factual claim matches the source material.</span>
        </div>
      )}
      {post.verification_status === "failed" && (() => {
        const notes = post.verification_notes as any;
        const unsupported = Array.isArray(notes?.claims)
          ? notes.claims.filter((c: any) => !c.supported)
          : [];
        return (
          <div className="px-3 py-2 rounded-md border border-warning/40 bg-warning/10 text-warning text-xs space-y-2">
            <button
              type="button"
              onClick={() => setVerifyOpen(!verifyOpen)}
              className="flex items-start gap-2 w-full text-left"
            >
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="font-medium flex-1">
                Needs review — {unsupported.length} unsupported claim{unsupported.length === 1 ? "" : "s"} after fact-check
                {notes?.retried ? " (already retried once)" : ""}.
              </span>
              {verifyOpen ? <ChevronUp className="w-3 h-3 mt-1" /> : <ChevronDown className="w-3 h-3 mt-1" />}
            </button>
            {verifyOpen && unsupported.length > 0 && (
              <ul className="space-y-1 pl-6 list-disc">
                {unsupported.map((c: any, i: number) => (
                  <li key={i}>
                    <span className="italic">"{c.claim}"</span> — {c.reason}
                  </li>
                ))}
              </ul>
            )}
          </div>
        );
      })()}

      {/* Virality + usefulness score */}
      {typeof post.virality_score === "number" && post.score_breakdown && (() => {
        const sb = post.score_breakdown as any;
        const overall = Number(post.virality_score);
        const passes = !!sb.passes_bar;
        const band: "low" | "mid" | "high" | "breakout" =
          sb.predicted_reach_band === "breakout" || sb.predicted_reach_band === "high" ||
          sb.predicted_reach_band === "mid" || sb.predicted_reach_band === "low"
            ? sb.predicted_reach_band
            : overall >= 8.5 ? "breakout" : overall >= 7.5 ? "high" : overall >= 6 ? "mid" : "low";
        const verdict: string = typeof sb.verdict === "string" ? sb.verdict : "";
        const closest = sb.closest_winner as
          | { id: string; similarity: number; excerpt: string; score: number }
          | null
          | undefined;
        const tone = passes
          ? "border-success/40 bg-success/10 text-success"
          : overall >= 6.5
            ? "border-warning/40 bg-warning/10 text-warning"
            : "border-destructive/40 bg-destructive/10 text-destructive";
        const bandStyle: Record<typeof band, string> = {
          breakout: "bg-success/20 text-success border-success/40",
          high: "bg-success/15 text-success border-success/30",
          mid: "bg-warning/15 text-warning border-warning/30",
          low: "bg-destructive/15 text-destructive border-destructive/30",
        };
        const bandCopy: Record<typeof band, string> = {
          breakout: "Breakout · 20k+ likely",
          high: "High reach · 5-20k",
          mid: "Mid reach · 1-5k",
          low: "Low reach · scroll-past",
        };
        const fixes: string[] = Array.isArray(sb.fixes) ? sb.fixes : [];
        const u = sb.usefulness || {};
        const Bar = ({ label, val }: { label: string; val: number }) => (
          <div className="flex items-center gap-2 text-[11px]">
            <span className="w-20 text-muted-foreground">{label}</span>
            <div className="flex-1 h-1.5 rounded-full bg-secondary overflow-hidden">
              <div className="h-full bg-current opacity-70" style={{ width: `${Math.max(0, Math.min(10, val)) * 10}%` }} />
            </div>
            <span className="w-6 text-right tabular-nums">{val.toFixed(1)}</span>
          </div>
        );
        return (
          <div className={`px-3 py-2 rounded-md border text-xs space-y-2 ${tone}`}>
            <button type="button" onClick={() => setScoreOpen(!scoreOpen)} className="flex items-center gap-2 w-full text-left">
              <Sparkles className="w-4 h-4 shrink-0" />
              <span className="font-medium flex-1 tabular-nums">
                {overall.toFixed(1)}/10
                {sb.retried ? " (rewritten once)" : ""}
              </span>
              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${bandStyle[band]}`}>
                {bandCopy[band]}
              </span>
              {scoreOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            </button>
            {verdict && (
              <p className="text-[12px] italic leading-snug text-foreground/90 pl-6 pr-1">
                "{verdict}"
              </p>
            )}
            {scoreOpen && (
              <div className="space-y-2 pt-1">
                <Bar label="Hook" val={Number(sb.hook_strength ?? 0)} />
                <Bar label="Specific" val={Number(sb.specificity ?? 0)} />
                <Bar label="Emotional" val={Number(sb.emotional_pull ?? 0)} />
                <Bar label="Shareable" val={Number(sb.shareability ?? 0)} />
                {typeof sb.humour_fit === "number" && <Bar label="Humour" val={Number(sb.humour_fit)} />}
                {typeof sb.lead_magnet_fit === "number" && <Bar label="Lead-mag" val={Number(sb.lead_magnet_fit)} />}
                <div className="flex gap-3 pt-1 text-[11px] text-muted-foreground">
                  <span className={u.actionable_takeaway ? "text-success" : ""}>{u.actionable_takeaway ? "✓" : "·"} actionable</span>
                  <span className={u.contrarian_angle ? "text-success" : ""}>{u.contrarian_angle ? "✓" : "·"} contrarian</span>
                  <span className={u.data_or_example_led ? "text-success" : ""}>{u.data_or_example_led ? "✓" : "·"} data-led</span>
                </div>
                {closest && closest.similarity > 0 && (
                  <div className="mt-2 border-t border-border/50 pt-2 text-[11px] text-muted-foreground">
                    <div className="font-medium text-foreground/80 mb-1">
                      Closest past winner ({Math.round(closest.similarity * 100)}% overlap, {closest.score} engagement)
                    </div>
                    <p className="italic leading-snug">"{closest.excerpt}{closest.excerpt.length >= 180 ? "…" : ""}"</p>
                  </div>
                )}
                {fixes.length > 0 && (
                  <ul className="pt-1 space-y-1 pl-4 list-disc text-[11px]">
                    {fixes.map((f, i) => <li key={i}>{f}</li>)}
                  </ul>
                )}
              </div>
            )}
          </div>
        );
      })()}


      {/* Content */}
      {editing ? (
        <div className="space-y-3">
          <Textarea
            value={editContent}
            onChange={(e) => setEditContent(e.target.value)}
            className="min-h-[200px] bg-secondary border-border text-foreground text-sm"
          />
          <Input
            placeholder="Edit notes (optional)"
            value={editNotes}
            onChange={(e) => setEditNotes(e.target.value)}
            className="bg-secondary border-border"
          />
          <div className="flex gap-2">
            <Button size="sm" onClick={handleSaveEdit} disabled={loading}>Save</Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>Cancel</Button>
          </div>
        </div>
      ) : (
        <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">{post.content}</p>
      )}

      {/* Meta row */}
      <div className="flex items-center gap-2 flex-wrap">
        <ScorecardBadge post={post} onUpdate={onUpdate} size="sm" />
        {post.suggested_time && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="w-3 h-3" />
            {post.suggested_time}
          </span>
        )}
        {post.engagement_estimate && (
          <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
            post.engagement_estimate === "high" ? "badge-high" :
            post.engagement_estimate === "medium" ? "badge-medium" : "badge-low"
          }`}>
            {post.engagement_estimate} engagement
          </span>
        )}
      </div>

      {/* Source material */}
      {sources && sources.length > 0 && (
        <div>
          <button
            onClick={() => setSourcesOpen(!sourcesOpen)}
            className="flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground transition-colors"
          >
            {sourcesOpen ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
            {sources.length} source{sources.length > 1 ? "s" : ""}
          </button>
          {sourcesOpen && (
            <ul className="mt-2 space-y-1 pl-4">
              {sources.map((s: any, i: number) => (
                <li key={i} className="text-xs text-muted-foreground">• {s.title || s.url || JSON.stringify(s)}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Rejection input */}
      {rejecting && (
        <div className="flex gap-2">
          <Input
            placeholder="Rejection reason (optional)"
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            className="bg-secondary border-border flex-1"
            autoFocus
          />
          <Button size="sm" variant="destructive" onClick={handleReject} disabled={loading}>Confirm</Button>
          <Button size="sm" variant="ghost" onClick={() => setRejecting(false)}>Cancel</Button>
        </div>
      )}

      {/* Quick tweaks — only when not editing/rejecting and post is still mutable */}
      {(post.status === "draft" || post.status === "approved") && !editing && !rejecting && (
        <div className="pt-2 border-t border-border">
          <div className="flex items-center gap-1.5 text-[11px] font-medium text-muted-foreground mb-2">
            <Wand2 className="w-3 h-3" /> Quick tweaks
          </div>
          <div className="flex flex-wrap gap-1.5">
            {TWEAKS.map((t) => (
              <button
                key={t.key}
                type="button"
                onClick={() => handleTweak(t.key, t.label)}
                disabled={tweaking !== null || loading}
                className="text-[11px] px-2.5 py-1.5 rounded-full border border-border bg-secondary text-foreground hover:bg-secondary/70 hover:border-primary/40 transition disabled:opacity-40 disabled:cursor-not-allowed min-h-[28px]"
              >
                {tweaking === t.key ? "…" : t.label}
              </button>
            ))}
          </div>
          {post.first_comment_text && (
            <div className="mt-2 text-[11px] text-muted-foreground border border-dashed border-border rounded-md px-2 py-1.5">
              <span className="font-medium text-foreground">First comment:</span> {post.first_comment_text}
            </div>
          )}
        </div>
      )}

      {/* Action buttons — Draft */}
      {post.status === "draft" && !editing && !rejecting && (
        <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-border">
          <Button size="sm" className="min-h-11 bg-success hover:bg-success/90 text-success-foreground flex-1" onClick={handleApprove} disabled={loading}>
            <Check className="w-4 h-4 mr-1" /> Approve
          </Button>
          <Button size="sm" className="min-h-11 bg-primary hover:bg-primary/90 flex-1" onClick={() => setEditing(true)}>
            <Pencil className="w-4 h-4 mr-1" /> Edit
          </Button>
          <Button size="sm" variant="destructive" className="min-h-11 flex-1" onClick={() => setRejecting(true)}>
            <X className="w-4 h-4 mr-1" /> Reject
          </Button>
        </div>
      )}

      {/* Action buttons — Approved */}
      {post.status === "approved" && (
        <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-border">
          <Button size="sm" variant="outline" className="min-h-11 flex-1" onClick={handleCopy}>
            <Copy className="w-4 h-4 mr-1" /> Copy
          </Button>
          <Button size="sm" variant="outline" className="min-h-11 flex-1" onClick={handleDownloadText}>
            <Download className="w-4 h-4 mr-1" /> Save .txt
          </Button>
          <Button
            size="sm"
            className="min-h-11 bg-[hsl(201,100%,35%)] hover:bg-[hsl(201,100%,30%)] text-white flex-1"
            onClick={handlePublishLinkedIn}
            disabled={loading}
          >
            <Linkedin className="w-4 h-4 mr-1" /> Publish to LinkedIn
          </Button>
          <Button size="sm" className="min-h-11 bg-success hover:bg-success/90 text-success-foreground flex-1" onClick={handleMarkPublished} disabled={loading}>
            <Send className="w-4 h-4 mr-1" /> Mark Published
          </Button>
        </div>
      )}

      <VisualStudio postId={post.id} draftContent={post.content} />
    </div>
  );
}
