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
      <div className="max-w-screen-2xl mx-auto px-6 h-16 flex items-center justify-between">
        <h1 className="text-lg font-bold text-foreground tracking-tight">
          LinkedIn Ghostwriter — <span className="text-primary">LRA</span>
        </h1>

        <div className="hidden md:flex items-center gap-3 text-sm">
          <span className="text-muted-foreground">{dateStr}</span>
          <span className="text-muted-foreground">·</span>
          <span className={`text-${pillar.color} font-medium`}>{pillar.label}</span>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={handleCollectNews}
            disabled={collectingNews}
            className="hidden sm:flex"
          >
            <Newspaper className="w-4 h-4 mr-1" />
            {collectingNews ? "Collecting…" : "Collect News"}
          </Button>
          <Button
            size="sm"
            onClick={handleGenerateDraft}
            disabled={generatingDraft}
          >
            <Sparkles className="w-4 h-4 mr-1" />
            {generatingDraft ? "Generating…" : "Generate Draft"}
          </Button>
          <div className="flex items-center gap-2 text-sm ml-2">
            <span className="text-muted-foreground">This week:</span>
            <span className={`font-bold ${weeklyCount >= 5 ? "text-success" : "text-primary"}`}>
              {weeklyCount}
            </span>
            <span className="text-muted-foreground">/ 5</span>
          </div>
          <Button size="sm" variant="ghost" onClick={onSettingsClick}>
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
