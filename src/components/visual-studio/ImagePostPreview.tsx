import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Copy, Loader2, RefreshCw, ImageIcon, AlertTriangle } from "lucide-react";
import { useVisualAsset } from "./useVisualAsset";
import { copyText, downloadBlob, nodeToPngBlob } from "./exportNode";
import { useToast } from "@/hooks/use-toast";
import { QualityBadge } from "./QualityBadge";
import { makeImageFallback } from "./visualDefaults";

export function ImagePostPreview({ postId, draftContent }: { postId: string; draftContent: string }) {
  const { toast } = useToast();
  const { asset, generating, generate, error } = useVisualAsset(postId, "image_post");
  const ref = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const p = asset?.payload ?? makeImageFallback(draftContent);

  async function copyField(name: string, value: string) {
    await copyText(value);
    toast({ title: `${name} copied` });
  }

  async function exportPng() {
    if (!ref.current) return;
    setExporting(true);
    try {
      const blob = await nodeToPngBlob(ref.current, 2);
      downloadBlob(blob, "image-post.png");
      toast({ title: "Image post exported" });
    } catch (e: any) {
      toast({ title: "Export failed", description: e.message, variant: "destructive" });
    }
    setExporting(false);
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
      {!asset && (
        <div className="rounded-md border border-primary/30 bg-primary/10 p-3 text-xs text-muted-foreground flex items-start justify-between gap-3">
          <span>Instant image preview from the draft. Create image post to polish concept, caption and first comment.</span>
          <Button size="sm" onClick={() => generate()} disabled={generating} className="shrink-0">
            <Sparkles className="w-3.5 h-3.5 mr-1" /> Create
          </Button>
        </div>
      )}
      <div className="w-[260px] sm:w-[340px] mx-auto overflow-hidden">
        <div
          ref={ref}
          className="aspect-square rounded-xl p-5 sm:p-6 flex items-center justify-center text-white text-center overflow-hidden"
          style={{ background: "radial-gradient(circle at 25% 20%,#22d3ee33 0,#22d3ee00 32%), linear-gradient(135deg,#0f172a 0%,#1f2937 48%,#312e81 100%)" }}
        >
          <div className="space-y-5">
            <div className="mx-auto h-14 w-14 rounded-full border border-white/20 bg-white/10 flex items-center justify-center">
              <ImageIcon className="w-7 h-7 opacity-80" />
            </div>
            <span className="block text-xl sm:text-2xl font-semibold leading-tight break-words">{p?.overlay_text}</span>
            <div className="text-[10px] uppercase tracking-widest opacity-55">London Royal Academy</div>
          </div>
        </div>
        <p className="text-[10px] text-muted-foreground italic mt-2 text-center break-words line-clamp-3">{p?.concept}</p>
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

      <div className="flex flex-wrap gap-2 pt-1">
        <Button size="sm" variant="outline" onClick={exportPng} disabled={exporting}>
          {exporting ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <ImageIcon className="w-3.5 h-3.5 mr-1" />}
          PNG
        </Button>
        <Button size="sm" variant="outline" onClick={() => copyField("Image package", `${p?.caption}\n\nFirst comment:\n${p?.first_comment}`)}>
          <Copy className="w-3.5 h-3.5 mr-1" /> Copy package
        </Button>
        <Button size="sm" variant="ghost" onClick={() => generate()} disabled={generating}>
          <RefreshCw className={`w-3.5 h-3.5 mr-1 ${generating ? "animate-spin" : ""}`} /> Regenerate
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
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
      <div className={`break-words ${mono ? "font-mono" : ""} ${multiline ? "whitespace-pre-line" : ""}`}>{value}</div>
    </div>
  );
}
