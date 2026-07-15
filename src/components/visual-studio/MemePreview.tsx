import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Sparkles, Copy, Loader2, RefreshCw, Laugh, ImageIcon } from "lucide-react";
import { useVisualAsset } from "./useVisualAsset";
import { copyText, downloadBlob, nodeToPngBlob } from "./exportNode";
import { useToast } from "@/hooks/use-toast";

const FORMAT_LABELS: Record<string, string> = {
  drake: "Drake",
  distracted_bf: "Distracted boyfriend",
  this_is_fine: "This is fine",
  two_buttons: "Two buttons",
  change_my_mind: "Change my mind",
  expanding_brain: "Expanding brain",
  top_bottom: "Top / bottom",
};

// Distinct gradients per format so each meme still feels visually different
// without needing licensed base images.
const FORMAT_BG: Record<string, string> = {
  drake:           "linear-gradient(160deg,#111827 0%,#312e81 100%)",
  distracted_bf:   "linear-gradient(160deg,#0f172a 0%,#7c2d12 100%)",
  this_is_fine:    "linear-gradient(160deg,#7c2d12 0%,#f59e0b 100%)",
  two_buttons:     "linear-gradient(160deg,#0f172a 0%,#0369a1 100%)",
  change_my_mind:  "linear-gradient(160deg,#111827 0%,#065f46 100%)",
  expanding_brain: "linear-gradient(160deg,#111827 0%,#4c1d95 100%)",
  top_bottom:      "linear-gradient(160deg,#0f172a 0%,#1f2937 100%)",
};

export function MemePreview({ postId, draftContent }: { postId: string; draftContent: string }) {
  const { toast } = useToast();
  const { asset, generating, generate, error } = useVisualAsset(postId, "meme" as any);
  const ref = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const p: any = asset?.payload;

  async function exportPng() {
    if (!ref.current) return;
    setExporting(true);
    try {
      const blob = await nodeToPngBlob(ref.current, 2);
      await downloadBlob(blob, `meme-${p?.format_id ?? "post"}.png`);
      toast({ title: "Meme download started" });
    } catch (e: any) {
      toast({ title: "Export failed", description: e.message, variant: "destructive" });
    }
    setExporting(false);
  }

  async function copyField(name: string, value: string) {
    await copyText(value);
    toast({ title: `${name} copied` });
  }

  if (!asset && !generating) {
    return (
      <div className="rounded-md border border-primary/30 bg-primary/10 p-4 text-xs text-muted-foreground space-y-3">
        <div className="flex items-start gap-2">
          <Laugh className="w-4 h-4 mt-0.5 text-primary shrink-0" />
          <div className="flex-1">
            <div className="font-medium text-foreground mb-1">Meme Studio</div>
            <p>Turn this draft into a shareable meme. Claude picks the format that matches the draft's tension and writes the captions in Hajrë's voice.</p>
          </div>
        </div>
        <Button size="sm" onClick={() => generate()} className="w-full">
          <Sparkles className="w-3.5 h-3.5 mr-1" /> Generate meme
        </Button>
        <p className="text-[10px] italic opacity-70">
          Rendered as an original branded meme card. No copyrighted base images — safe to post.
        </p>
      </div>
    );
  }

  if (generating && !asset) {
    return (
      <div className="rounded-md border border-border p-6 text-center">
        <Loader2 className="w-6 h-6 mx-auto animate-spin text-primary" />
        <p className="text-xs text-muted-foreground mt-2">Picking a format and writing captions…</p>
      </div>
    );
  }

  const formatId: string = p?.format_id ?? "top_bottom";
  const zones = (p?.zones ?? {}) as Record<string, string>;
  const bg = FORMAT_BG[formatId] ?? FORMAT_BG.top_bottom;

  return (
    <div className="space-y-3">
      <div className="w-[280px] sm:w-[360px] mx-auto">
        <div
          ref={ref}
          className="aspect-square rounded-xl p-6 flex flex-col text-white overflow-hidden"
          style={{ background: bg }}
        >
          <div className="text-[10px] uppercase tracking-widest opacity-60 mb-2">
            {FORMAT_LABELS[formatId] ?? formatId}
          </div>
          <div className="flex-1 flex flex-col justify-center gap-3">
            <MemeBody formatId={formatId} zones={zones} />
          </div>
          <div className="text-[9px] uppercase tracking-widest opacity-45 mt-3 text-right">
            @londonroyalacademy
          </div>
        </div>
        {p?.why_this_format && (
          <p className="text-[10px] text-muted-foreground italic mt-2 text-center px-2">
            {p.why_this_format}
          </p>
        )}
      </div>

      <div className="flex flex-wrap gap-2 justify-center">
        <Button size="sm" variant="outline" onClick={exportPng} disabled={exporting}>
          {exporting ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <ImageIcon className="w-3.5 h-3.5 mr-1" />}
          Download PNG
        </Button>
        <Button size="sm" variant="ghost" onClick={() => generate()} disabled={generating}>
          <RefreshCw className={`w-3.5 h-3.5 mr-1 ${generating ? "animate-spin" : ""}`} /> New format
        </Button>
      </div>

      {p?.linkedin_caption && (
        <Field label="LinkedIn caption" value={p.linkedin_caption} onCopy={(v) => copyField("Caption", v)} multiline />
      )}
      {p?.first_comment && (
        <Field label="First comment" value={p.first_comment} onCopy={(v) => copyField("First comment", v)} multiline />
      )}
      {p?.alt_text && (
        <Field label="Alt text (accessibility)" value={p.alt_text} onCopy={(v) => copyField("Alt text", v)} />
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}

function MemeBody({ formatId, zones }: { formatId: string; zones: Record<string, string> }) {
  const entries = Object.entries(zones);
  if (entries.length === 0) return <p className="text-center opacity-60 text-sm">No captions yet</p>;

  if (formatId === "drake") {
    return (
      <div className="space-y-3">
        <Row label="✗ Reject" text={zones.reject} tone="reject" />
        <Row label="✓ Prefer" text={zones.prefer} tone="prefer" />
      </div>
    );
  }
  if (formatId === "expanding_brain") {
    return (
      <div className="space-y-2">
        {["tier_1", "tier_2", "tier_3", "tier_4"].map((k, i) =>
          zones[k] ? <Row key={k} label={`${i + 1}.`} text={zones[k]} tone={i === 3 ? "prefer" : "neutral"} /> : null,
        )}
      </div>
    );
  }
  if (formatId === "two_buttons") {
    return (
      <div className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <ButtonCell text={zones.button_a} />
          <ButtonCell text={zones.button_b} />
        </div>
        {zones.who_is_choosing && (
          <p className="text-center text-sm italic opacity-90">…{zones.who_is_choosing}, sweating</p>
        )}
      </div>
    );
  }
  if (formatId === "change_my_mind") {
    return (
      <div className="rounded-lg border-2 border-white/70 p-4 text-center">
        <p className="text-xl font-bold leading-snug">{zones.claim}</p>
        <p className="text-[10px] uppercase tracking-widest opacity-60 mt-3">Change my mind</p>
      </div>
    );
  }
  if (formatId === "this_is_fine") {
    return (
      <div className="space-y-4 text-center">
        <p className="text-base opacity-90">{zones.situation}</p>
        <p className="text-2xl font-bold">"{zones.reaction}"</p>
      </div>
    );
  }
  if (formatId === "distracted_bf") {
    return (
      <div className="space-y-2 text-center">
        <p className="text-[10px] uppercase tracking-widest opacity-60">Glancing at</p>
        <p className="text-lg font-bold">{zones.glancing_at}</p>
        <p className="text-[10px] uppercase tracking-widest opacity-60 pt-1">Meanwhile</p>
        <p className="text-sm opacity-90">{zones.girlfriend}</p>
        <p className="text-[10px] uppercase tracking-widest opacity-60 pt-1">Reaction</p>
        <p className="text-base italic">"{zones.boyfriend_reaction}"</p>
      </div>
    );
  }
  // top/bottom fallback
  return (
    <div className="flex flex-col justify-between h-full py-2">
      <p className="text-2xl font-bold text-center leading-tight uppercase" style={{ textShadow: "0 2px 8px rgba(0,0,0,0.4)" }}>
        {zones.top ?? entries[0]?.[1]}
      </p>
      <p className="text-2xl font-bold text-center leading-tight uppercase mt-6" style={{ textShadow: "0 2px 8px rgba(0,0,0,0.4)" }}>
        {zones.bottom ?? entries[1]?.[1]}
      </p>
    </div>
  );
}

function Row({ label, text, tone }: { label: string; text?: string; tone: "reject" | "prefer" | "neutral" }) {
  if (!text) return null;
  const toneClass = tone === "reject" ? "border-red-400/60" : tone === "prefer" ? "border-emerald-400/60" : "border-white/30";
  return (
    <div className={`rounded-md border-l-4 ${toneClass} bg-white/5 px-3 py-2`}>
      <div className="text-[10px] uppercase tracking-wider opacity-60">{label}</div>
      <div className="text-sm font-medium leading-snug">{text}</div>
    </div>
  );
}

function ButtonCell({ text }: { text?: string }) {
  return (
    <div className="rounded-md bg-red-500/80 border border-red-300/60 px-3 py-3 text-center text-sm font-semibold leading-tight">
      {text ?? "…"}
    </div>
  );
}

function Field({
  label, value, onCopy, multiline,
}: { label: string; value: string; onCopy: (v: string) => void; multiline?: boolean }) {
  return (
    <div className="rounded-md bg-secondary/60 border border-border p-3 text-xs space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
        <button onClick={() => onCopy(value)} className="text-muted-foreground hover:text-foreground">
          <Copy className="w-3 h-3" />
        </button>
      </div>
      <div className={`break-words ${multiline ? "whitespace-pre-line" : ""}`}>{value}</div>
    </div>
  );
}
