import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Flame, RefreshCw, ExternalLink, ChevronDown, ChevronUp } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface Trend {
  id: string;
  title: string;
  summary: string;
  angle: string | null;
  counter_take: string | null;
  source_url: string | null;
  heat_score: number;
  pillar: string | null;
  created_at: string;
}

export function TrendRadar() {
  const { toast } = useToast();
  const [trends, setTrends] = useState<Trend[]>([]);
  const [loading, setLoading] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  const load = async () => {
    setLoading(true);
    const { data } = await supabase
      .from("trend_radar")
      .select("*")
      .gte("expires_at", new Date().toISOString())
      .order("heat_score", { ascending: false })
      .limit(8);
    if (data) setTrends(data as Trend[]);
    setLoading(false);
  };

  useEffect(() => { load(); }, []);

  const handleScan = async () => {
    setScanning(true);
    try {
      const { data, error } = await supabase.functions.invoke("scan-trends");
      if (error) throw error;
      toast({ title: "Trends refreshed", description: `${data?.trends || 0} new trends` });
      await load();
    } catch (e: any) {
      toast({ title: "Scan failed", description: e.message, variant: "destructive" });
    }
    setScanning(false);
  };

  return (
    <div className="card-surface p-4 sm:p-5 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Flame className="w-4 h-4 text-pillar-defence" />
          Trend Radar
        </h3>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleScan}
          disabled={scanning}
          className="h-8 px-2"
          aria-label="Refresh trends"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${scanning ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {loading && trends.length === 0 ? (
        <div className="text-xs text-muted-foreground py-3">Loading…</div>
      ) : trends.length === 0 ? (
        <div className="text-xs text-muted-foreground py-3">
          No fresh trends yet. Tap refresh to scan now, or wait for the daily 05:15 UTC sweep.
        </div>
      ) : (
        <ul className="space-y-2">
          {trends.map((t) => {
            const open = !!expanded[t.id];
            return (
              <li key={t.id} className="rounded-md border border-border bg-secondary/40">
                <button
                  type="button"
                  onClick={() => setExpanded((s) => ({ ...s, [t.id]: !open }))}
                  className="w-full flex items-start gap-2 px-3 py-2 text-left"
                >
                  <span className="text-[11px] font-bold tabular-nums w-7 shrink-0 text-pillar-defence pt-0.5">
                    {t.heat_score}
                  </span>
                  <span className="flex-1 text-xs text-foreground leading-snug">{t.title}</span>
                  {open ? <ChevronUp className="w-3 h-3 mt-1 text-muted-foreground" /> : <ChevronDown className="w-3 h-3 mt-1 text-muted-foreground" />}
                </button>
                {open && (
                  <div className="px-3 pb-3 space-y-2 text-[11px]">
                    <p className="text-muted-foreground leading-relaxed">{t.summary}</p>
                    {t.angle && (
                      <p className="text-foreground"><span className="text-muted-foreground">Angle: </span>{t.angle}</p>
                    )}
                    {t.counter_take && (
                      <p className="text-foreground italic">"{t.counter_take}"</p>
                    )}
                    {t.source_url && (
                      <a
                        href={t.source_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-primary hover:underline"
                      >
                        <ExternalLink className="w-3 h-3" /> Source
                      </a>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
