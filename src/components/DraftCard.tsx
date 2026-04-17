import { useState } from "react";
import { Post } from "@/types/database";
import { PILLARS, PillarKey } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Check, Pencil, X, Copy, Send, ChevronDown, ChevronUp, Clock, Linkedin, AlertTriangle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

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
  const [loading, setLoading] = useState(false);

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
    <div className="card-surface p-6 space-y-4">
      {/* Pillar tag */}
      <div className="flex items-center justify-between">
        <span className={`text-xs font-medium px-3 py-1 rounded-full border ${pillarClasses}`}>
          {pillar?.label || post.pillar}
        </span>
        <span className="text-xs text-muted-foreground">
          {new Date(post.created_at).toLocaleDateString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
        </span>
      </div>

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
      <div className="flex items-center gap-3 flex-wrap">
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

      {/* Action buttons — Draft */}
      {post.status === "draft" && !editing && !rejecting && (
        <div className="flex gap-2 pt-2 border-t border-border">
          <Button size="sm" className="bg-success hover:bg-success/90 text-success-foreground" onClick={handleApprove} disabled={loading}>
            <Check className="w-4 h-4 mr-1" /> Approve
          </Button>
          <Button size="sm" className="bg-primary hover:bg-primary/90" onClick={() => setEditing(true)}>
            <Pencil className="w-4 h-4 mr-1" /> Edit
          </Button>
          <Button size="sm" variant="destructive" onClick={() => setRejecting(true)}>
            <X className="w-4 h-4 mr-1" /> Reject
          </Button>
        </div>
      )}

      {/* Action buttons — Approved */}
      {post.status === "approved" && (
        <div className="flex gap-2 pt-2 border-t border-border">
          <Button size="sm" variant="outline" onClick={handleCopy}>
            <Copy className="w-4 h-4 mr-1" /> Copy
          </Button>
          <Button
            size="sm"
            className="bg-[hsl(201,100%,35%)] hover:bg-[hsl(201,100%,30%)] text-white"
            onClick={handlePublishLinkedIn}
            disabled={loading}
          >
            <Linkedin className="w-4 h-4 mr-1" /> Publish to LinkedIn
          </Button>
          <Button size="sm" className="bg-success hover:bg-success/90 text-success-foreground" onClick={handleMarkPublished} disabled={loading}>
            <Send className="w-4 h-4 mr-1" /> Mark Published
          </Button>
        </div>
      )}
    </div>
  );
}
