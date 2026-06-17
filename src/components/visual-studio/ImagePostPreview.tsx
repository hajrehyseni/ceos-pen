import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Copy, Loader2, RefreshCw, ImageIcon, AlertTriangle } from "lucide-react";
import { useVisualAsset } from "./useVisualAsset";
import { copyText } from "./exportNode";
import { useToast } from "@/hooks/use-toast";
import { QualityBadge } from "./QualityBadge";

export function ImagePostPreview({ postId }: { postId: string }) {
  const { toast } = useToast();
  const { asset, generating, generate, error } = useVisualAsset(postId, "image_post");
  const p = asset?.payload;

  async function copyField(name: string, value: string) {
    await copyText(value);
    toast({ title: `${name} copied` });
  }

  if (!asset && !generating) {
    return (
      <div className="rounded-md border border-dashed border-border p-6 text-center space-y-3">
        <ImageIcon className="w-8 h-8 mx-auto text-muted-foreground" />
        <p className="text-sm text-muted-foreground">No image post yet.</p>
        <Button size="sm" onClick={() => generate()} disabled={generating}>
          <Sparkles className="w-4 h-4 mr-1" /> Create image post
        </Button>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  if (generating && !asset) {
    return (
      <div className="rounded-md border border-border p-6 text-center">
        <Loader2 className="w-6 h-6 mx-auto animate-spin text-primary" />
        <p className="text-xs text-muted-foreground mt-2">Designing image concept…</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="max-w-[360px] mx-auto">
        <div
          className="aspect-square rounded-xl p-6 flex items-center justify-center text-white text-center"
          style={{ background: "linear-gradient(135deg,#0f172a 0%,#312e81 50%,#4338ca 100%)" }}
        >
          <span className="text-2xl font-semibold leading-tight">{p?.overlay_text}</span>
        </div>
        <p className="text-[10px] text-muted-foreground italic mt-2 text-center">{p?.concept}</p>
      </div>

      <Field label="Style" value={p?.style} onCopy={(v) => copyField("Style", v)} />
      <Field label="Image prompt (paste into your image tool)" value={p?.image_prompt} onCopy={(v) => copyField("Prompt", v)} mono />
      <Field label="Caption" value={p?.caption} onCopy={(v) => copyField("Caption", v)} multiline />
      <Field label="First comment" value={p?.first_comment} onCopy={(v) => copyField("First comment", v)} multiline />

      {p?.risk_notes && (
        <div className="rounded-md border border-warning/40 bg-warning/10 text-warning p-3 text-xs flex gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <span>{p.risk_notes}</span>
        </div>
      )}

      <QualityBadge quality={p?.quality} />

      <div className="flex gap-2 pt-1">
        <Button size="sm" variant="ghost" onClick={() => generate()} disabled={generating}>
          <RefreshCw className={`w-3.5 h-3.5 mr-1 ${generating ? "animate-spin" : ""}`} /> Regenerate
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  value,
  onCopy,
  mono,
  multiline,
}: {
  label: string;
  value?: string;
  onCopy: (v: string) => void;
  mono?: boolean;
  multiline?: boolean;
}) {
  if (!value) return null;
  return (
    <div className="rounded-md bg-secondary/60 border border-border p-3 text-xs space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
        <button onClick={() => onCopy(value)} className="text-muted-foreground hover:text-foreground">
          <Copy className="w-3 h-3" />
        </button>
      </div>
      <div className={`${mono ? "font-mono" : ""} ${multiline ? "whitespace-pre-line" : ""}`}>{value}</div>
    </div>
  );
}
