import { useState } from "react";
import { getTodayPillar, PILLARS } from "@/lib/constants";
import { Button } from "@/components/ui/button";
import { Settings, Sparkles, Newspaper } from "lucide-react";
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
  const [collectingNews, setCollectingNews] = useState(false);

  const today = new Date();
  const pillarKey = getTodayPillar();
  const pillar = PILLARS[pillarKey];
  const dateStr = today.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
  const shortDateStr = today.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
  });

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

  const handleCollectNews = async () => {
    setCollectingNews(true);
    try {
      const { data, error } = await supabase.functions.invoke("collect-news");
      if (error) throw error;
      toast({ title: "News collected", description: `${data?.count || 0} items found` });
      onDataRefresh();
    } catch (e: any) {
      toast({ title: "Collection failed", description: e.message, variant: "destructive" });
    }
    setCollectingNews(false);
  };

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="max-w-screen-2xl mx-auto px-3 sm:px-6 py-2 sm:h-16 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        {/* Row 1: brand + week count + settings */}
        <div className="flex items-center justify-between gap-2 sm:gap-3">
          <h1 className="text-base sm:text-lg font-bold text-foreground tracking-tight">
            LinkedIn Ghostwriter — <span className="text-primary">LRA</span>
          </h1>
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex items-center gap-1 text-xs sm:text-sm">
              <span className="text-muted-foreground hidden sm:inline">This week:</span>
              <span className={`font-bold ${weeklyCount >= 5 ? "text-success" : "text-primary"}`}>
                {weeklyCount}
              </span>
              <span className="text-muted-foreground">/5</span>
            </div>
            <Button
              size="sm"
              variant="ghost"
              onClick={onSettingsClick}
              aria-label="Open settings"
              className="min-h-11 min-w-11"
            >
              <Settings className="w-4 h-4" />
            </Button>
          </div>
        </div>

        {/* Row 2: date + pillar (mobile shows below; desktop centred) */}
        <div className="hidden md:flex items-center gap-3 text-sm">
          <span className="text-muted-foreground">{dateStr}</span>
          <span className="text-muted-foreground">·</span>
          <span className={`text-${pillar.color} font-medium`}>{pillar.label}</span>
        </div>
        <div className="flex md:hidden items-center gap-2 text-xs">
          <span className="text-muted-foreground">{shortDateStr}</span>
          <span className="text-muted-foreground">·</span>
          <span className={`text-${pillar.color} font-medium`}>{pillar.label}</span>
        </div>

        {/* Row 3: actions */}
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleCollectNews}
            disabled={collectingNews}
            className="flex-1 sm:flex-none min-h-11"
          >
            <Newspaper className="w-4 h-4 mr-1" />
            {collectingNews ? "Collecting…" : "News"}
          </Button>
          <Button
            size="sm"
            onClick={handleGenerateDraft}
            disabled={generatingDraft}
            className="flex-1 sm:flex-none min-h-11"
          >
            <Sparkles className="w-4 h-4 mr-1" />
            {generatingDraft ? "Generating…" : "Generate Draft"}
          </Button>
        </div>
      </div>
    </header>
  );
}
