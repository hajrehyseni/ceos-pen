import { useCallback, useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";

export type VisualKind = "carousel" | "infographic" | "image_post" | "chart" | "poll";

export interface VisualAsset {
  id: string;
  post_id: string | null;
  kind: VisualKind | "reply";
  payload: any;
  status: "generating" | "ready" | "failed";
  error: string | null;
  created_at: string;
}

const FN_MAP: Record<VisualKind, string> = {
  carousel: "gen-carousel",
  infographic: "gen-infographic",
  image_post: "gen-image-post",
  chart: "gen-chart",
  poll: "gen-poll",
};

export function useVisualAsset(postId: string, kind: VisualKind) {
  const [asset, setAsset] = useState<VisualAsset | null>(null);
  const [loading, setLoading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLatest = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("visual_assets")
      .select("*")
      .eq("post_id", postId)
      .eq("kind", kind)
      .order("created_at", { ascending: false })
      .limit(1);
    if (!error && data && data[0]) setAsset(data[0] as VisualAsset);
    setLoading(false);
  }, [postId, kind]);

  useEffect(() => {
    fetchLatest();
  }, [fetchLatest]);

  const generate = useCallback(
    async (body: Record<string, any> = {}) => {
      setGenerating(true);
      setError(null);
      try {
        const { data, error } = await supabase.functions.invoke(FN_MAP[kind], {
          body: { post_id: postId, ...body },
        });
        if (error) throw error;
        if (data?.status === "error") throw new Error(data.error);
        if (data?.asset) setAsset(data.asset as VisualAsset);
        else await fetchLatest();
      } catch (e: any) {
        setError(e.message ?? String(e));
      }
      setGenerating(false);
    },
    [postId, kind, fetchLatest],
  );

  return { asset, loading, generating, error, generate, refetch: fetchLatest };
}
