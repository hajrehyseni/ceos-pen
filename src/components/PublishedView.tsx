import { useEffect, useState } from "react";
import { Post, PostMetrics } from "@/types/database";
import { PILLARS, PillarKey } from "@/lib/constants";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Linkedin, Twitter, Cloud, AtSign, ExternalLink, CheckCircle2, Circle, XCircle, Loader2 } from "lucide-react";

interface PublishedViewProps {
  posts: Post[];
  metrics: PostMetrics[];
}

type ChannelVariant = {
  id: string;
  post_id: string;
  channel: "x" | "threads" | "bluesky";
  variant_text: string;
  char_count: number;
  status: "draft" | "approved" | "published" | "skipped";
  external_url: string | null;
  published_at: string | null;
};

const CHANNEL_META: Record<ChannelVariant["channel"], { label: string; Icon: any; limit: number }> = {
  x: { label: "X", Icon: Twitter, limit: 275 },
  threads: { label: "Threads", Icon: AtSign, limit: 500 },
  bluesky: { label: "Bluesky", Icon: Cloud, limit: 300 },
};

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
              <th className="text-left p-4 text-muted-foreground font-medium hidden md:table-cell">Channels</th>
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
                  <td className="p-4 hidden md:table-cell">
                    <ChannelChips postId={post.id} />
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
        <DialogContent className="max-w-2xl bg-card border-border max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-foreground flex items-center gap-2">
              <Linkedin className="w-4 h-4 text-primary" />
              {selectedPost && PILLARS[selectedPost.pillar as PillarKey]?.label} —{" "}
              {selectedPost?.published_at && new Date(selectedPost.published_at).toLocaleDateString("en-GB")}
            </DialogTitle>
          </DialogHeader>
          <p className="text-sm text-foreground leading-relaxed whitespace-pre-line">{selectedPost?.content}</p>
          {selectedPost && <ChannelsPanel post={selectedPost} />}
        </DialogContent>
      </Dialog>
    </>
  );
}

/* -------------------------------------------------------------------------- */
/*  ChannelChips — small status dots in the table row                          */
/* -------------------------------------------------------------------------- */

function ChannelChips({ postId }: { postId: string }) {
  const [variants, setVariants] = useState<ChannelVariant[]>([]);
  useEffect(() => {
    supabase.from("channel_variants").select("*").eq("post_id", postId).then(({ data }) => {
      if (data) setVariants(data as ChannelVariant[]);
    });
  }, [postId]);

  const byChannel: Record<string, ChannelVariant | undefined> = {};
  for (const v of variants) byChannel[v.channel] = v;

  return (
    <div className="flex items-center gap-1.5">
      <span title="LinkedIn — published"><CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" /></span>
      {(["x", "threads", "bluesky"] as const).map((c) => {
        const v = byChannel[c];
        const { Icon, label } = CHANNEL_META[c];
        let color = "text-muted-foreground/40";
        let title = `${label} — not generated`;
        if (v?.status === "published") { color = "text-emerald-500"; title = `${label} — published`; }
        else if (v?.status === "approved") { color = "text-warning"; title = `${label} — approved, publishing`; }
        else if (v?.status === "draft") { color = "text-muted-foreground"; title = `${label} — draft`; }
        else if (v?.status === "skipped") { color = "text-destructive/60"; title = `${label} — skipped`; }
        return <span key={c} title={title}><Icon className={`w-3.5 h-3.5 ${color}`} /></span>;
      })}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/*  ChannelsPanel — inside the post dialog                                     */
/* -------------------------------------------------------------------------- */

function ChannelsPanel({ post }: { post: Post }) {
  const { toast } = useToast();
  const [variants, setVariants] = useState<ChannelVariant[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftText, setDraftText] = useState("");

  const load = () => {
    supabase.from("channel_variants").select("*").eq("post_id", post.id).then(({ data }) => {
      if (data) setVariants(data as ChannelVariant[]);
    });
  };
  useEffect(load, [post.id]);

  const byChannel: Record<string, ChannelVariant | undefined> = {};
  for (const v of variants) byChannel[v.channel] = v;

  const generate = async () => {
    setBusy("generate");
    const { error } = await supabase.functions.invoke("repurpose-channel", { body: { post_id: post.id } });
    setBusy(null);
    if (error) toast({ title: "Repurpose failed", description: error.message, variant: "destructive" });
    else { toast({ title: "Variants generated" }); load(); }
  };

  const saveEdit = async (v: ChannelVariant) => {
    await supabase.from("channel_variants")
      .update({ variant_text: draftText, char_count: draftText.length })
      .eq("id", v.id);
    setEditingId(null);
    load();
  };

  const approveAndPublish = async (v: ChannelVariant) => {
    setBusy(v.id);
    await supabase.from("channel_variants").update({ status: "approved" }).eq("id", v.id);
    const fn = { x: "publish-x", threads: "publish-threads", bluesky: "publish-bluesky" }[v.channel];
    const { data, error } = await supabase.functions.invoke(fn, { body: { variant_id: v.id } });
    setBusy(null);
    if (error) toast({ title: `${fn} failed`, description: error.message, variant: "destructive" });
    else { toast({ title: `${CHANNEL_META[v.channel].label} published`, description: JSON.stringify(data).slice(0, 140) }); load(); }
  };

  const skip = async (v: ChannelVariant) => {
    await supabase.from("channel_variants").update({ status: "skipped" }).eq("id", v.id);
    load();
  };

  return (
    <div className="mt-6 space-y-3 border-t border-border pt-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground">Cross-channel</h3>
        <Button size="sm" variant="outline" onClick={generate} disabled={busy === "generate"}>
          {busy === "generate" ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
          {variants.length ? "Regenerate variants" : "Generate variants"}
        </Button>
      </div>

      {(["x", "threads", "bluesky"] as const).map((c) => {
        const v = byChannel[c];
        const { Icon, label, limit } = CHANNEL_META[c];
        return (
          <div key={c} className="bg-secondary/40 rounded-md p-3 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Icon className="w-4 h-4 text-foreground" />
                <span className="text-sm font-medium text-foreground">{label}</span>
                <StatusPill status={v?.status} />
              </div>
              {v?.external_url && (
                <a href={v.external_url} target="_blank" rel="noreferrer" className="text-xs text-primary flex items-center gap-1">
                  View <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>

            {!v && <div className="text-xs text-muted-foreground">Not generated yet.</div>}

            {v && editingId === v.id ? (
              <>
                <Textarea rows={c === "x" ? 6 : 3} value={draftText}
                  onChange={(e) => setDraftText(e.target.value)}
                  className="bg-background border-border text-xs" />
                <div className="flex gap-2 justify-end">
                  <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>Cancel</Button>
                  <Button size="sm" onClick={() => saveEdit(v)}>Save</Button>
                </div>
              </>
            ) : v ? (
              <>
                <p className="text-xs text-foreground whitespace-pre-wrap leading-relaxed">{v.variant_text}</p>
                <div className="flex items-center justify-between">
                  <span className={`text-[10px] ${v.char_count > limit && c !== "x" ? "text-destructive" : "text-muted-foreground"}`}>
                    {v.char_count} chars {c !== "x" && `/ ${limit}`}
                  </span>
                  {v.status !== "published" && (
                    <div className="flex gap-1">
                      <Button size="sm" variant="ghost" onClick={() => { setEditingId(v.id); setDraftText(v.variant_text); }}>Edit</Button>
                      <Button size="sm" variant="ghost" onClick={() => skip(v)}>Skip</Button>
                      <Button size="sm" onClick={() => approveAndPublish(v)} disabled={busy === v.id}>
                        {busy === v.id ? <Loader2 className="w-3 h-3 animate-spin mr-1" /> : null}
                        Publish
                      </Button>
                    </div>
                  )}
                </div>
              </>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

function StatusPill({ status }: { status?: ChannelVariant["status"] }) {
  if (!status) return <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted text-muted-foreground">none</span>;
  const map = {
    draft: "bg-muted text-muted-foreground",
    approved: "bg-warning/20 text-warning",
    published: "bg-emerald-500/20 text-emerald-500",
    skipped: "bg-destructive/20 text-destructive",
  } as const;
  const Icon = status === "published" ? CheckCircle2 : status === "skipped" ? XCircle : Circle;
  return (
    <span className={`text-[10px] px-1.5 py-0.5 rounded flex items-center gap-1 ${map[status]}`}>
      <Icon className="w-3 h-3" /> {status}
    </span>
  );
}
