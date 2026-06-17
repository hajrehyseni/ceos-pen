import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Flame, RefreshCw, ChevronRight, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

interface Trend {
  id: string;
  title: string;
  summary: string;
  angle: string | null;
  source_url: string | null;
  heat_score: number;
}

export function CompactNewsList() {
  const { toast } = useToast();
  const [trends, setTrends] = useState<Trend[]>([]);
  const [scanning, setScanning] = useState(false);
  const [allOpen, setAllOpen] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("trend_radar")
      .select("id,title,summary,angle,source_url,heat_score")
      .gte("expires_at", new Date().toISOString())
      .order("heat_score", { ascending: false })
      .limit(12);
    if (data) setTrends(data as Trend[]);
  };

  useEffect(() => { load(); }, []);

  const handleScan = async () => {
    setScanning(true);
    try {
      const { data, error } = await supabase.functions.invoke("scan-trends");
      if (error) throw error;
      toast({ title: "AI News refreshed", description: `${data?.trends || 0} new items` });
      await load();
    } catch (e: any) {
      toast({ title: "Refresh failed", description: e.message, variant: "destructive" });
    }
    setScanning(false);
  };

  const top = trends.slice(0, 3);

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <h2 className="label-eyebrow flex items-center gap-1.5">
          <Flame className="w-3 h-3 text-pillar-defence" />
          AI News
        </h2>
        <button
          onClick={handleScan}
          disabled={scanning}
          className="text-muted-foreground hover:text-foreground transition h-8 w-8 -mr-2 flex items-center justify-center rounded-full active:bg-secondary/40"
          aria-label="Refresh AI News"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${scanning ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="card-surface overflow-hidden">
        {top.length === 0 ? (
          <p className="text-xs text-muted-foreground p-4 text-center">
            No fresh news yet. Tap refresh to scan.
          </p>
        ) : (
          <ul className="divide-y divide-[hsl(var(--hairline)/0.06)]">
            {top.map((t) => (
              <li key={t.id}>
                <a
                  href={t.source_url || "#"}
                  target={t.source_url ? "_blank" : undefined}
                  rel="noopener noreferrer"
                  className="flex items-start gap-2 px-4 py-3 active:bg-secondary/40 transition"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-[14px] text-foreground font-medium leading-snug line-clamp-2">{t.title}</p>
                    <p className="text-[12px] text-muted-foreground leading-snug line-clamp-1 mt-0.5">{t.summary}</p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground/60 mt-0.5 shrink-0" />
                </a>
              </li>
            ))}
          </ul>
        )}
        {trends.length > 3 && (
          <Sheet open={allOpen} onOpenChange={setAllOpen}>
            <SheetTrigger asChild>
              <button className="w-full flex items-center justify-center gap-1 px-3 py-3 text-xs font-medium text-primary active:bg-secondary/40 transition hairline-t">
                See all {trends.length} <ChevronRight className="w-3 h-3" />
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="bg-card border-border max-h-[85vh] overflow-y-auto">
              <SheetHeader>
                <SheetTitle>AI News · {trends.length} items</SheetTitle>
              </SheetHeader>
              <ul className="pt-3 space-y-2">
                {trends.map((t) => (
                  <li key={t.id} className="card-surface p-3 space-y-1">
                    <p className="text-sm font-medium text-foreground leading-snug">{t.title}</p>
                    <p className="text-xs text-muted-foreground leading-relaxed">{t.summary}</p>
                    {t.angle && <p className="text-xs text-foreground"><span className="text-muted-foreground">Angle: </span>{t.angle}</p>}
                    {t.source_url && (
                      <a href={t.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
                        <ExternalLink className="w-3 h-3" /> Source
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </SheetContent>
          </Sheet>
        )}
      </div>
    </section>
  );
}
