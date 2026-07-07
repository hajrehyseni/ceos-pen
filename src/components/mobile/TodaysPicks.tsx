import { useState } from "react";
import { Post } from "@/types/database";
import { HeroDraftCard } from "./HeroDraftCard";
import { AlternateDraftCard } from "./AlternateDraftCard";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { DraftCard } from "@/components/DraftCard";
import { Button } from "@/components/ui/button";
import { Plus, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { COPY } from "@/lib/copy";

interface Props {
  drafts: Post[];
  onUpdate: () => void;
}

export function TodaysPicks({ drafts, onUpdate }: Props) {
  const { toast } = useToast();
  const [featuredId, setFeaturedId] = useState<string | undefined>(undefined);
  const [openId, setOpenId] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  const featured =
    (featuredId && drafts.find((d) => d.id === featuredId)) || drafts[0];
  const alternates = drafts.filter((d) => d.id !== featured?.id).slice(0, 2);
  const openPost = openId ? drafts.find((d) => d.id === openId) : null;

  const handleTopUp = async () => {
    setGenerating(true);
    try {
      const { error } = await supabase.functions.invoke("generate-draft");
      if (error) throw error;
      toast({ title: "New draft generated" });
      onUpdate();
    } catch (e: any) {
      toast({ title: COPY.errorGeneric, description: e.message, variant: "destructive" });
    }
    setGenerating(false);
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between px-1">
        <h2 className="label-eyebrow">Today's picks</h2>
        {drafts.length > 0 && (
          <span className="text-[10px] text-muted-foreground num">
            {Math.min(drafts.length, 3)} of {drafts.length}
          </span>
        )}
      </div>

      <HeroDraftCard drafts={drafts} onUpdate={onUpdate} featuredId={featured?.id} hideEyebrow />

      {alternates.length > 0 && (
        <div className="space-y-2 pt-1">
          <p className="label-eyebrow px-1">Alternates</p>
          {alternates.map((p) => (
            <AlternateDraftCard
              key={p.id}
              post={p}
              onPromote={() => setFeaturedId(p.id)}
              onOpen={() => setOpenId(p.id)}
            />
          ))}
        </div>
      )}

      {drafts.length < 3 && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleTopUp}
          disabled={generating}
          className="w-full h-10 rounded-xl text-[12px] font-medium tap-press"
        >
          {generating ? (
            <><Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> Generating…</>
          ) : (
            <><Plus className="w-3.5 h-3.5 mr-1.5" /> Generate another option</>
          )}
        </Button>
      )}

      <Dialog open={!!openPost} onOpenChange={(o) => !o && setOpenId(null)}>
        <DialogContent className="max-w-[calc(100vw-1rem)] sm:max-w-2xl max-h-[90vh] overflow-y-auto p-0 bg-transparent border-0 shadow-none">
          {openPost && <DraftCard post={openPost} onUpdate={onUpdate} />}
        </DialogContent>
      </Dialog>
    </section>
  );
}
