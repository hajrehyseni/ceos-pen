import { useState } from "react";
import { getTodayPillar, PILLARS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Settings, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface HeaderBarProps {
  weeklyCount: number;
  onSettingsClick: () => void;
  onDataRefresh: () => void;
}

export function HeaderBar({ weeklyCount, onSettingsClick, onDataRefresh }: HeaderBarProps) {
  const { toast } = useToast();
  const [generatingDraft, setGeneratingDraft] = useState(false);

  const pillarKey = getTodayPillar();
  const pillar = PILLARS[pillarKey];
  const shortDateStr = new Date().toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short" });

  const handleGenerateDraft = async () => {
    setGeneratingDraft(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-draft");
      if (error) throw error;
      toast({ title: "Draft generated", description: `Post ID: ${data?.post_id || "created"}` });
      onDataRefresh();
    } catch (e: any) {
      toast({ title: "Generation failed", description: e.message, variant: "destructive" });
    }
    setGeneratingDraft(false);
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/90 backdrop-blur-xl">
      <div className="max-w-screen-sm mx-auto px-3 h-[52px] flex items-center justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <h1 className="text-base font-bold text-foreground tracking-tight">
            CEO <span className="text-primary">Pen</span>
          </h1>
          <span className="text-[11px] text-muted-foreground truncate hidden xs:inline">·</span>
          <span className="text-[11px] text-muted-foreground truncate">{shortDateStr}</span>
          <span className="text-[11px] text-muted-foreground">·</span>
          <span className={`text-[11px] text-${pillar.color} font-medium truncate`}>{pillar.label}</span>
        </div>

        <div className="flex items-center gap-1 shrink-0">
          <span className="text-[11px] text-muted-foreground mr-1 tabular-nums">
            <span className={`font-bold ${weeklyCount >= 5 ? "text-success" : "text-primary"}`}>{weeklyCount}</span>/5
          </span>
          <Button
            size="sm"
            onClick={handleGenerateDraft}
            disabled={generatingDraft}
            className="h-9 px-3 text-xs"
          >
            <Sparkles className="w-3.5 h-3.5 mr-1" />
            {generatingDraft ? "…" : "New"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onSettingsClick}
            aria-label="Open settings"
            className="h-9 w-9 p-0"
          >
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
