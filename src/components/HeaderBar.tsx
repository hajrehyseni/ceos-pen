import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Settings, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface HeaderBarProps {
  weeklyCount: number;
  onSettingsClick: () => void;
  onDataRefresh: () => void;
}

export function HeaderBar({ onSettingsClick, onDataRefresh }: HeaderBarProps) {
  const { toast } = useToast();
  const [generatingDraft, setGeneratingDraft] = useState(false);

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
      <div className="max-w-screen-sm mx-auto px-4 h-[52px] flex items-center justify-between">
        <h1 className="text-base font-bold text-foreground tracking-tight whitespace-nowrap">
          CEO <span className="text-primary">Pen</span>
        </h1>

        <div className="flex items-center gap-1">
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
