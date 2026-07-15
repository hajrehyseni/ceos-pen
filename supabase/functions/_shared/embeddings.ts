// Small embedding helper backed by Lovable AI Gateway.
// Used for angle-dedup — cheap, fast, no separate provider.

const GATEWAY = "https://ai.gateway.lovable.dev/v1/embeddings";
const MODEL = "openai/text-embedding-3-small"; // 1536 dims, cheap & fast

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) throw new Error("Missing LOVABLE_API_KEY");
  if (texts.length === 0) return [];
  const r = await fetch(GATEWAY, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Lovable-API-Key": key,
    },
    body: JSON.stringify({ model: MODEL, input: texts }),
  });
  if (!r.ok) throw new Error(`Embeddings API [${r.status}]: ${await r.text()}`);
  const data = await r.json();
  return (data.data ?? []).map((d: any) => d.embedding as number[]);
}

export async function embedOne(text: string): Promise<number[] | null> {
  try {
    const [v] = await embedTexts([text]);
    return v ?? null;
  } catch (_e) {
    return null;
  }
}

export function cosine(a: number[], b: number[]): number {
  if (!a || !b || a.length !== b.length) return 0;
  let dot = 0, na = 0, nb = 0;
  for (let i = 0; i < a.length; i++) { dot += a[i] * b[i]; na += a[i] * a[i]; nb += b[i] * b[i]; }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}

export function maxSimilarity(target: number[], corpus: number[][]): number {
  let max = 0;
  for (const v of corpus) {
    const c = cosine(target, v);
    if (c > max) max = c;
  }
  return max;
}
