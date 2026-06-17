import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Download, Copy, Loader2, RefreshCw, ExternalLink, LayoutTemplate } from "lucide-react";
import * as Icons from "lucide-react";
import { useVisualAsset } from "./useVisualAsset";
import { nodeToPngBlob, downloadBlob, copyText } from "./exportNode";
import { useToast } from "@/hooks/use-toast";
import { QualityBadge } from "./QualityBadge";
import { makeInfographicFallback } from "./visualDefaults";

function getIcon(name: string) {
  const Comp = (Icons as any)[name];
  return Comp ?? Icons.Sparkles;
}

export function InfographicPreview({ postId, draftContent }: { postId: string; draftContent: string }) {
  const { toast } = useToast();
  const { asset, generating, generate, error } = useVisualAsset(postId, "infographic");
  const ref = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);

  const p = asset?.payload ?? makeInfographicFallback(draftContent);

  async function exportPng() {
    if (!ref.current) return;
    setExporting(true);
    try {
      const blob = await nodeToPngBlob(ref.current, 2);
      downloadBlob(blob, "infographic.png");
      toast({ title: "Infographic exported" });
    } catch (e: any) {
      toast({ title: "Export failed", description: e.message, variant: "destructive" });
    }
    setExporting(false);
  }

  async function copyCaption() {
    if (!p?.caption) return;
    await copyText(p.caption);
    toast({ title: "Caption copied" });
  }

  if (generating && !asset) {
    return (
      <div className="rounded-md border border-border p-6 text-center">
        <Loader2 className="w-6 h-6 mx-auto animate-spin text-primary" />
        <p className="text-xs text-muted-foreground mt-2">Building infographic…</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {!asset && (
        <div className="rounded-md border border-primary/30 bg-primary/10 p-3 text-xs text-muted-foreground flex items-start justify-between gap-3">
          <span>Instant infographic from the draft. Create infographic to polish blocks and source treatment.</span>
          <Button size="sm" onClick={() => generate()} disabled={generating} className="shrink-0">
            <Sparkles className="w-3.5 h-3.5 mr-1" /> Create
          </Button>
        </div>
      )}
      <div className="max-w-[360px] mx-auto">
        <div
          ref={ref}
          className="rounded-xl p-6 text-white"
          style={{ background: "linear-gradient(170deg,#0f172a 0%,#1e1b4b 60%,#312e81 100%)", aspectRatio: "9/16" }}
        >
          <div className="text-[10px] uppercase tracking-widest opacity-60 mb-3">London Royal Academy</div>
          <h4 className="text-xl font-semibold leading-tight">{p?.title}</h4>
          {p?.subtitle && <p className="text-xs opacity-70 mt-1">{p.subtitle}</p>}
          <div className="mt-5 space-y-3">
            {(p?.blocks ?? []).map((b: any, i: number) => {
              const Icon = getIcon(b.icon);
              return (
                <div key={i} className="rounded-lg bg-white/5 border border-white/10 p-3 flex gap-3">
                  <Icon className="w-5 h-5 mt-0.5 opacity-80 shrink-0" />
                  <div className="min-w-0">
                    <div className="flex items-baseline gap-2">
                      <span className="text-xs uppercase tracking-wide opacity-70">{b.label}</span>
                      {b.value && <span className="text-base font-semibold">{b.value}</span>}
                    </div>
                    <p className="text-xs opacity-85 leading-snug mt-0.5">{b.note}</p>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="mt-5 text-[10px] opacity-50">build.londonra.com</div>
        </div>
      </div>

      {p?.caption && (
        <div className="rounded-md bg-secondary/60 border border-border p-3 text-xs whitespace-pre-line">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Caption</div>
          {p.caption}
        </div>
      )}

      {Array.isArray(p?.sources) && p.sources.length > 0 && (
        <div className="rounded-md border border-border p-3 text-xs space-y-1">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Sources</div>
          {p.sources.map((s: any, i: number) => (
            <a
              key={i}
              href={s.url}
              target="_blank"
              rel="noreferrer"
              className="flex items-start gap-1 text-muted-foreground hover:text-foreground"
            >
              <ExternalLink className="w-3 h-3 mt-0.5 shrink-0" />
              <span className="truncate">{s.title || s.url}</span>
            </a>
          ))}
        </div>
      )}

      <QualityBadge quality={p?.quality} />

      <div className="flex flex-wrap gap-2 pt-1">
        <Button size="sm" variant="outline" onClick={exportPng} disabled={exporting}>
          {exporting ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Download className="w-3.5 h-3.5 mr-1" />}
          PNG
        </Button>
        <Button size="sm" variant="outline" onClick={copyCaption}>
          <Copy className="w-3.5 h-3.5 mr-1" /> Copy caption
        </Button>
        <Button size="sm" variant="ghost" onClick={() => generate()} disabled={generating}>
          <RefreshCw className={`w-3.5 h-3.5 mr-1 ${generating ? "animate-spin" : ""}`} /> Regenerate
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
