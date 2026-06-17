import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RefreshCw, ChevronRight, ExternalLink } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { COPY } from "@/lib/copy";

interface Trend {
  id: string;
  title: string;
  summary: string;
  angle: string | null;
  counter_take: string | null;
  source_url: string | null;
  heat_score: number;
  pillar: string | null;
}

function credibilityFromHeat(h: number): { label: string; tone: string } {
  if (h >= 8) return { label: "high", tone: "text-success" };
  if (h >= 5) return { label: "medium", tone: "text-foreground/70" };
  return { label: "low", tone: "text-muted-foreground" };
}

function shareWorthiness(t: Trend): { label: string; tone: string } {
  const score = (t.heat_score || 0) + (t.angle ? 2 : 0) + (t.counter_take ? 2 : 0);
  if (score >= 9) return { label: "share-ready", tone: "text-primary" };
  if (score >= 5) return { label: "promising", tone: "text-foreground/70" };
  return { label: "weak", tone: "text-muted-foreground" };
}

export function CompactNewsList() {
  const { toast } = useToast();
  const [trends, setTrends] = useState<Trend[]>([]);
  const [scanning, setScanning] = useState(false);
  const [allOpen, setAllOpen] = useState(false);

  const load = async () => {
    const { data } = await supabase
      .from("trend_radar")
      .select("id,title,summary,angle,counter_take,source_url,heat_score,pillar")
      .gte("expires_at", new Date().toISOString())
      .order("heat_score", { ascending: false })
      .limit(10);
    if (data) setTrends(data as Trend[]);
  };

  useEffect(() => { load(); }, []);

  const handleScan = async () => {
    setScanning(true);
    try {
      const { data, error } = await supabase.functions.invoke("scan-trends");
      if (error) throw error;
      toast({ title: COPY.newsRefreshed, description: `${data?.trends || 0} new items` });
      await load();
    } catch (e: any) {
      toast({ title: COPY.errorGeneric, description: e.message, variant: "destructive" });
    }
    setScanning(false);
  };

  const top = trends.slice(0, 3);

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between px-1">
        <h2 className="label-eyebrow">AI News</h2>
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
          <p className="text-xs text-muted-foreground p-4 text-center">{COPY.newsEmpty}</p>
        ) : (
          <ul className="divide-y divide-[hsl(var(--hairline)/0.05)]">
            {top.map((t) => {
              const cred = credibilityFromHeat(t.heat_score);
              const share = shareWorthiness(t);
              return (
                <li key={t.id}>
                  <a
                    href={t.source_url || "#"}
                    target={t.source_url ? "_blank" : undefined}
                    rel="noopener noreferrer"
                    className="flex items-start gap-2 px-4 py-3 active:bg-secondary/40 transition"
                  >
                    <div className="flex-1 min-w-0 space-y-1">
                      <p className="font-serif text-[15px] text-foreground leading-snug line-clamp-2">{t.title}</p>
                      <p className="text-[12px] text-muted-foreground leading-snug line-clamp-1">{t.summary}</p>
                      <div className="flex items-center gap-2 text-[10px] pt-0.5">
                        {t.source_url && (
                          <span className="text-muted-foreground truncate max-w-[120px]">
                            {new URL(t.source_url).hostname.replace(/^www\./, "")}
                          </span>
                        )}
                        <span className={cred.tone}>· credibility {cred.label}</span>
                        <span className={share.tone}>· {share.label}</span>
                      </div>
                    </div>
                    <ChevronRight className="w-4 h-4 text-muted-foreground/60 mt-0.5 shrink-0" />
                  </a>
                </li>
              );
            })}
          </ul>
        )}
        {trends.length > 3 && (
          <Sheet open={allOpen} onOpenChange={setAllOpen}>
            <SheetTrigger asChild>
              <button className="w-full flex items-center justify-center gap-1 px-3 py-3 text-xs font-medium text-primary active:bg-secondary/40 transition hairline-t">
                See top {trends.length} <ChevronRight className="w-3 h-3" />
              </button>
            </SheetTrigger>
            <SheetContent side="bottom" className="bg-card border-border max-h-[88vh] overflow-y-auto">
              <SheetHeader>
                <SheetTitle className="font-serif text-xl">AI News · top {trends.length}</SheetTitle>
              </SheetHeader>
              <ul className="pt-3 space-y-3">
                {trends.map((t) => {
                  const cred = credibilityFromHeat(t.heat_score);
                  const share = shareWorthiness(t);
                  return (
                    <li key={t.id} className="card-surface p-4 space-y-2">
                      <p className="font-serif text-base text-foreground leading-snug">{t.title}</p>
                      <p className="text-xs text-muted-foreground leading-relaxed">{t.summary}</p>
                      {t.angle && (
                        <p className="text-xs text-foreground"><span className="label-eyebrow">CEO angle</span><br />{t.angle}</p>
                      )}
                      {t.counter_take && (
                        <p className="text-xs text-foreground"><span className="label-eyebrow">Counter-take</span><br />{t.counter_take}</p>
                      )}
                      <div className="flex flex-wrap items-center gap-2 text-[10px] pt-1">
                        {t.source_url && (
                          <a href={t.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline">
                            <ExternalLink className="w-3 h-3" /> {new URL(t.source_url).hostname.replace(/^www\./, "")}
                          </a>
                        )}
                        <span className={cred.tone}>credibility {cred.label}</span>
                        <span className={share.tone}>{share.label}</span>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </SheetContent>
          </Sheet>
        )}
      </div>
    </section>
  );
}
