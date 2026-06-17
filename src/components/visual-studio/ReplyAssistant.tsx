import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Sparkles, Copy, Loader2, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { copyText } from "./exportNode";
import { useToast } from "@/hooks/use-toast";

const LABELS: Record<string, { title: string; hint: string }> = {
  short: { title: "Short & friendly", hint: "Under 25 words" },
  thoughtful: { title: "Thoughtful", hint: "Adds an angle the post missed" },
  witty: { title: "Witty (British)", hint: "Light humour, still useful" },
  disagree: { title: "Friendly disagreement", hint: "Polite, one clear reason" },
  lead: { title: "Lead-opening", hint: "Could spark an LRA conversation" },
  dm: { title: "Optional DM follow-up", hint: "Send after they reply" },
};

export function ReplyAssistant() {
  const { toast } = useToast();
  const [source, setSource] = useState("");
  const [loading, setLoading] = useState(false);
  const [variants, setVariants] = useState<Record<string, string> | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    if (!source.trim()) return;
    setLoading(true);
    setError(null);
    setVariants(null);
    try {
      const { data, error } = await supabase.functions.invoke("reply-assistant", {
        body: { source_text: source.trim() },
      });
      if (error) throw error;
      if (data?.status === "error") throw new Error(data.error);
      setVariants(data.draft.variants);
    } catch (e: any) {
      setError(e.message ?? String(e));
    }
    setLoading(false);
  }

  async function cp(label: string, v: string) {
    await copyText(v);
    toast({ title: `${label} copied` });
  }

  return (
    <div className="space-y-3">
      <div className="space-y-2">
        <label className="text-xs text-muted-foreground">Paste the LinkedIn post or comment to reply to</label>
        <Textarea
          value={source}
          onChange={(e) => setSource(e.target.value)}
          placeholder="Paste the post or comment text here…"
          className="min-h-[120px] text-sm bg-secondary border-border"
        />
        <Button size="sm" onClick={generate} disabled={loading || !source.trim()}>
          {loading ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Sparkles className="w-3.5 h-3.5 mr-1" />}
          Generate replies
        </Button>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>

      {!variants && !loading && (
        <div className="rounded-md border border-dashed border-border p-4 text-center text-xs text-muted-foreground flex items-center justify-center gap-2">
          <MessageSquare className="w-4 h-4" /> Six reply variants will appear here.
        </div>
      )}

      {variants && (
        <div className="space-y-2">
          {Object.entries(LABELS).map(([key, { title, hint }]) => {
            const v = variants[key];
            if (!v) return null;
            return (
              <div key={key} className="rounded-md bg-secondary/60 border border-border p-3 text-xs space-y-1.5">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="text-[11px] font-medium text-foreground">{title}</span>
                    <span className="text-[10px] text-muted-foreground ml-1">· {hint}</span>
                  </div>
                  <button onClick={() => cp(title, v)} className="text-muted-foreground hover:text-foreground">
                    <Copy className="w-3 h-3" />
                  </button>
                </div>
                <div className="whitespace-pre-line">{v}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
