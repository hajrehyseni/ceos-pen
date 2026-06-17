import { Button } from "@/components/ui/button";
import { Sparkles, Copy, Loader2, RefreshCw, BarChart2 } from "lucide-react";
import { useVisualAsset } from "./useVisualAsset";
import { copyText } from "./exportNode";
import { useToast } from "@/hooks/use-toast";
import { QualityBadge } from "./QualityBadge";

export function PollPreview({ postId }: { postId: string }) {
  const { toast } = useToast();
  const { asset, generating, generate, error } = useVisualAsset(postId, "poll");
  const p = asset?.payload;

  async function cp(label: string, v?: string) {
    if (!v) return;
    await copyText(v);
    toast({ title: `${label} copied` });
  }

  if (!asset && !generating) {
    return (
      <div className="rounded-md border border-dashed border-border p-6 text-center space-y-3">
        <BarChart2 className="w-8 h-8 mx-auto text-muted-foreground" />
        <p className="text-sm text-muted-foreground">No poll yet.</p>
        <Button size="sm" onClick={() => generate()} disabled={generating}>
          <Sparkles className="w-4 h-4 mr-1" /> Create poll
        </Button>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  if (generating && !asset) {
    return (
      <div className="rounded-md border border-border p-6 text-center">
        <Loader2 className="w-6 h-6 mx-auto animate-spin text-primary" />
        <p className="text-xs text-muted-foreground mt-2">Drafting poll…</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="max-w-[360px] mx-auto">
        <div className="rounded-xl border border-border bg-card p-4 space-y-3">
          {p?.caption && <p className="text-xs whitespace-pre-line">{p.caption}</p>}
          <div className="rounded-lg border border-border bg-secondary/40 p-3 space-y-2">
            <div className="text-sm font-medium">{p?.question}</div>
            {(p?.options ?? []).map((o: string, i: number) => (
              <div key={i} className="rounded-md border border-border bg-background px-3 py-2 text-xs hover:bg-secondary/60 cursor-default">
                {o || <span className="text-muted-foreground italic">empty</span>}
              </div>
            ))}
            <div className="text-[10px] text-muted-foreground pt-1">1 week · LinkedIn poll</div>
          </div>
        </div>
      </div>

      <Block label="Follow-up comment (24h later)" value={p?.follow_up_comment} onCopy={(v) => cp("Follow-up", v)} />
      <Block label="Reply strategy" value={p?.reply_strategy} onCopy={(v) => cp("Strategy", v)} />
      {p?.cta && <Block label="Lead-magnet CTA" value={p.cta} onCopy={(v) => cp("CTA", v)} />}

      <QualityBadge quality={p?.quality} />

      <div className="flex flex-wrap gap-2 pt-1">
        <Button size="sm" variant="outline" onClick={() => cp("Poll caption", p?.caption)}>
          <Copy className="w-3.5 h-3.5 mr-1" /> Copy caption
        </Button>
        <Button size="sm" variant="ghost" onClick={() => generate()} disabled={generating}>
          <RefreshCw className={`w-3.5 h-3.5 mr-1 ${generating ? "animate-spin" : ""}`} /> Regenerate
        </Button>
      </div>
    </div>
  );
}

function Block({ label, value, onCopy }: { label: string; value?: string; onCopy: (v: string) => void }) {
  if (!value) return null;
  return (
    <div className="rounded-md bg-secondary/60 border border-border p-3 text-xs space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
        <button onClick={() => onCopy(value)} className="text-muted-foreground hover:text-foreground">
          <Copy className="w-3 h-3" />
        </button>
      </div>
      <div className="whitespace-pre-line">{value}</div>
    </div>
  );
}
