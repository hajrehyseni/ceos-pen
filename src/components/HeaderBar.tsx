import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Settings, Sparkles } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { CeoPenGlyph } from "@/components/brand/CeoPenGlyph";

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
    <header
      className="sticky top-0 z-50 hairline-b bg-background/75 backdrop-blur-xl"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      <div className="max-w-screen-sm mx-auto px-4 h-[56px] flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <CeoPenGlyph size={30} />
          <span className="font-signature text-[22px] leading-none text-foreground translate-y-[2px]">
            CEO <span className="text-primary">Pen</span>
          </span>
        </div>

        <div className="flex items-center gap-1">
          <Button
            size="sm"
            onClick={handleGenerateDraft}
            disabled={generatingDraft}
            className="h-9 px-3 text-xs rounded-full tap-press"
          >
            <Sparkles className="w-3.5 h-3.5 mr-1" />
            {generatingDraft ? "…" : "New"}
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
