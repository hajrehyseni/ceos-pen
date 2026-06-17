import { Sparkles, AlertTriangle, ChevronDown, ChevronUp } from "lucide-react";
import { useState } from "react";

export interface Quality {
  overall: number;
  mobile_readability: number;
  visual_clarity: number;
  hook_strength: number;
  cta_fit: number;
  source_confidence: number;
  export_readiness: number;
  notes: string[];
}

const LABELS: [keyof Quality, string][] = [
  ["mobile_readability", "Mobile readability"],
  ["visual_clarity", "Visual clarity"],
  ["hook_strength", "Hook strength"],
  ["cta_fit", "CTA fit"],
  ["source_confidence", "Source confidence"],
  ["export_readiness", "Export readiness"],
];

export function QualityBadge({ quality }: { quality?: Quality }) {
  const [open, setOpen] = useState(false);
  if (!quality || typeof quality.overall !== "number") return null;

  const passes = quality.overall >= 7;
  const tone = passes
    ? "border-success/40 bg-success/10 text-success"
    : "border-warning/40 bg-warning/10 text-warning";

  return (
    <div className={`rounded-md border text-xs ${tone}`}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center gap-2 px-3 py-2 text-left"
      >
        {passes ? <Sparkles className="w-3.5 h-3.5 shrink-0" /> : <AlertTriangle className="w-3.5 h-3.5 shrink-0" />}
        <span className="font-medium flex-1">
          Quality {quality.overall.toFixed(1)}/10 {passes ? "· ready" : "· needs improvement"}
        </span>
        {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </button>
      {open && (
        <div className="px-3 pb-3 pt-1 space-y-1.5">
          {LABELS.map(([k, label]) => {
            const v = Number(quality[k] ?? 0);
            return (
              <div key={k} className="flex items-center gap-2 text-[11px]">
                <span className="w-32 opacity-80">{label}</span>
                <div className="flex-1 h-1.5 rounded-full bg-current/20 overflow-hidden">
                  <div className="h-full bg-current opacity-70" style={{ width: `${v * 10}%` }} />
                </div>
                <span className="w-6 text-right tabular-nums">{v.toFixed(1)}</span>
              </div>
            );
          })}
          {quality.notes?.length > 0 && (
            <ul className="pl-4 list-disc text-[11px] pt-1 opacity-90">
              {quality.notes.map((n, i) => <li key={i}>{n}</li>)}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
