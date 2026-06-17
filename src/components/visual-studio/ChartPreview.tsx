import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Download, Loader2, RefreshCw, BarChart3, ExternalLink, AlertTriangle } from "lucide-react";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, LineChart, Line, Tooltip, CartesianGrid } from "recharts";
import { useVisualAsset } from "./useVisualAsset";
import { nodeToPngBlob, downloadBlob } from "./exportNode";
import { useToast } from "@/hooks/use-toast";

export function ChartPreview({ postId, onSwitchToImagePost }: { postId: string; onSwitchToImagePost?: () => void }) {
  const { toast } = useToast();
  const { asset, generating, generate, error } = useVisualAsset(postId, "chart");
  const ref = useRef<HTMLDivElement>(null);
  const [exporting, setExporting] = useState(false);
  const [userData, setUserData] = useState("");
  const [showPaste, setShowPaste] = useState(false);

  const p = asset?.payload;

  async function exportPng() {
    if (!ref.current) return;
    setExporting(true);
    try {
      const blob = await nodeToPngBlob(ref.current, 2);
      downloadBlob(blob, "chart.png");
      toast({ title: "Chart exported" });
    } catch (e: any) {
      toast({ title: "Export failed", description: e.message, variant: "destructive" });
    }
    setExporting(false);
  }

  if (!asset && !generating) {
    return (
      <div className="rounded-md border border-dashed border-border p-6 text-center space-y-3">
        <BarChart3 className="w-8 h-8 mx-auto text-muted-foreground" />
        <p className="text-sm text-muted-foreground">No chart yet. Only verified numbers will be used.</p>
        <Button size="sm" onClick={() => generate()} disabled={generating}>
          <Sparkles className="w-4 h-4 mr-1" /> Create chart
        </Button>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    );
  }

  if (generating && !asset) {
    return (
      <div className="rounded-md border border-border p-6 text-center">
        <Loader2 className="w-6 h-6 mx-auto animate-spin text-primary" />
        <p className="text-xs text-muted-foreground mt-2">Looking for verified numbers…</p>
      </div>
    );
  }

  if (p?.insufficient_data) {
    return (
      <div className="space-y-3">
        <div className="rounded-md border border-warning/40 bg-warning/10 text-warning p-3 text-xs flex gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">No verified numerical data available.</p>
            <p className="opacity-80">{p.reason}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          {onSwitchToImagePost && (
            <Button size="sm" onClick={onSwitchToImagePost}>
              Create conceptual visual instead
            </Button>
          )}
          <Button size="sm" variant="outline" onClick={() => setShowPaste(!showPaste)}>
            Paste my own data
          </Button>
          <Button size="sm" variant="ghost" onClick={() => generate()} disabled={generating}>
            <RefreshCw className={`w-3.5 h-3.5 mr-1 ${generating ? "animate-spin" : ""}`} /> Retry
          </Button>
        </div>
        {showPaste && (
          <div className="space-y-2">
            <Textarea
              value={userData}
              onChange={(e) => setUserData(e.target.value)}
              placeholder={'Label, value\nQ1, 12\nQ2, 18\nQ3, 24'}
              className="text-xs font-mono min-h-[120px]"
            />
            <Button size="sm" onClick={() => generate({ user_data: userData })} disabled={!userData.trim() || generating}>
              <Sparkles className="w-3.5 h-3.5 mr-1" /> Build chart from this
            </Button>
          </div>
        )}
      </div>
    );
  }

  const data = (p?.data ?? []) as { label: string; value: number; series?: string }[];
  const type = p?.type ?? "bar";

  return (
    <div className="space-y-3">
      <div className="max-w-[360px] mx-auto">
        <div ref={ref} className="rounded-xl p-5 text-white" style={{ background: "linear-gradient(170deg,#0f172a,#1e1b4b)", aspectRatio: "4/5" }}>
          <div className="text-[10px] uppercase tracking-widest opacity-60">LRA · Verified</div>
          <h4 className="text-lg font-semibold leading-tight mt-1">{p?.title}</h4>
          {p?.unit && <p className="text-[10px] opacity-60">in {p.unit}</p>}
          <div className="h-[55%] mt-4">
            <ResponsiveContainer width="100%" height="100%">
              {type === "line" ? (
                <LineChart data={data}>
                  <CartesianGrid stroke="#ffffff15" />
                  <XAxis dataKey="label" tick={{ fill: "#ffffffaa", fontSize: 10 }} />
                  <YAxis tick={{ fill: "#ffffffaa", fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #ffffff20", fontSize: 12 }} />
                  <Line type="monotone" dataKey="value" stroke="#a5b4fc" strokeWidth={2.5} dot={{ r: 3 }} />
                </LineChart>
              ) : (
                <BarChart data={data}>
                  <CartesianGrid stroke="#ffffff15" />
                  <XAxis dataKey="label" tick={{ fill: "#ffffffaa", fontSize: 10 }} />
                  <YAxis tick={{ fill: "#ffffffaa", fontSize: 10 }} />
                  <Tooltip contentStyle={{ background: "#0f172a", border: "1px solid #ffffff20", fontSize: 12 }} />
                  <Bar dataKey="value" fill="#818cf8" radius={[4, 4, 0, 0]} />
                </BarChart>
              )}
            </ResponsiveContainer>
          </div>
          {p?.caption && <p className="text-xs opacity-85 mt-2 leading-snug">{p.caption}</p>}
          <div className="text-[10px] opacity-50 mt-2">build.londonra.com</div>
        </div>
      </div>

      {Array.isArray(p?.sources) && p.sources.length > 0 && (
        <div className="rounded-md border border-border p-3 text-xs space-y-1">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Sources</div>
          {p.sources.map((s: any, i: number) => (
            <a key={i} href={s.url} target="_blank" rel="noreferrer" className="flex items-start gap-1 text-muted-foreground hover:text-foreground">
              <ExternalLink className="w-3 h-3 mt-0.5 shrink-0" />
              <span className="truncate">{s.title || s.url}</span>
            </a>
          ))}
        </div>
      )}

      <div className="flex flex-wrap gap-2 pt-1">
        <Button size="sm" variant="outline" onClick={exportPng} disabled={exporting}>
          {exporting ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Download className="w-3.5 h-3.5 mr-1" />}
          PNG
        </Button>
        <Button size="sm" variant="ghost" onClick={() => generate()} disabled={generating}>
          <RefreshCw className={`w-3.5 h-3.5 mr-1 ${generating ? "animate-spin" : ""}`} /> Regenerate
        </Button>
      </div>
    </div>
  );
}
