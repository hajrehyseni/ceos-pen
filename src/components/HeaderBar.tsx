import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Settings, Sparkles, Plus } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { CeoPenWordmark } from "@/components/brand/CeoPenWordmark";
import { COPY } from "@/lib/copy";

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
      toast({ title: "New draft ready", description: `Post ID: ${data?.post_id || "created"}` });
      onDataRefresh();
    } catch (e: any) {
      toast({ title: COPY.errorGeneric, description: e.message, variant: "destructive" });
    }
    setGeneratingDraft(false);
  };

  return (
    <header
      className="sticky top-0 z-50 hairline-b bg-background/85 backdrop-blur-xl"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="max-w-screen-md mx-auto px-4 lg:px-6 h-[56px] flex items-center justify-between">
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="tap-press"
          aria-label="CEO Pen — scroll to top"
        >
          <CeoPenWordmark size={20} />
        </button>

        <div className="flex items-center gap-1.5">
          <Button
            size="sm"
            onClick={handleGenerateDraft}
            disabled={generatingDraft}
            className="h-9 px-3 text-xs rounded-full tap-press"
          >
            {generatingDraft ? <Sparkles className="w-3.5 h-3.5 mr-1 animate-pulse" /> : <Plus className="w-3.5 h-3.5 mr-1" />}
            {generatingDraft ? "Sharpening…" : "New"}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={onSettingsClick}
            aria-label="Open settings"
            className="h-9 w-9 p-0 rounded-full"
          >
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </header>
  );
}
