import { toPng } from "html-to-image";
import { supabase } from "@/integrations/supabase/client";

export async function nodeToPngBlob(node: HTMLElement, pixelRatio = 2): Promise<Blob> {
  const dataUrl = await toPng(node, {
    pixelRatio,
    cacheBust: true,
    backgroundColor: getComputedStyle(node).backgroundColor || "#0f172a",
  });
  const res = await fetch(dataUrl);
  return await res.blob();
}

const EXPORT_BUCKET = "visual-exports";

function safeFilename(filename: string): string {
  const cleaned = filename.trim().replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/-+/g, "-");
  return cleaned || "download";
}

function uniquePath(filename: string): string {
  const id = typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
  return `exports/${id}-${safeFilename(filename)}`;
}

async function uploadForRealDownload(blob: Blob, filename: string): Promise<string> {
  const path = uniquePath(filename);
  const { error: uploadError } = await supabase.storage
    .from(EXPORT_BUCKET)
    .upload(path, blob, {
      contentType: blob.type || "application/octet-stream",
      upsert: false,
    });
  if (uploadError) throw uploadError;

  const { data, error: urlError } = await supabase.storage
    .from(EXPORT_BUCKET)
    .createSignedUrl(path, 60 * 10, { download: safeFilename(filename) });
  if (urlError || !data?.signedUrl) throw urlError ?? new Error("Could not create download link");

  return data.signedUrl;
}

function triggerBrowserDownload(url: string, filename: string): void {
  const a = document.createElement("a");
  a.href = url;
  a.download = safeFilename(filename);
  a.rel = "noopener";
  a.style.display = "none";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function triggerBlobFallback(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  triggerBrowserDownload(url, filename);
  setTimeout(() => URL.revokeObjectURL(url), 30_000);
}

/**
 * Download a Blob as a normal browser download.
 *
 * Safari is unreliable with blob: URLs, especially for PDFs inside iframes — it
 * often opens a blank tab. To avoid that, uploads the generated file to private
 * storage first, then opens a short-lived signed URL with real download headers.
 */
export async function downloadBlob(blob: Blob, filename: string): Promise<void> {
  try {
    const signedUrl = await uploadForRealDownload(blob, filename);
    triggerBrowserDownload(signedUrl, filename);
  } catch (err) {
    console.warn("[download] storage-backed download failed, falling back to local blob:", err);
    triggerBlobFallback(blob, filename);
  }
}



export async function exportNodeAsPng(node: HTMLElement, filename: string) {
  const blob = await nodeToPngBlob(node);
  await downloadBlob(blob, filename);
}

export async function copyText(text: string) {
  await navigator.clipboard.writeText(text);
}

/** Trigger a plain-text file download (used for "save draft as .txt"). */
export async function downloadText(text: string, filename: string) {
  const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
  await downloadBlob(blob, filename);
}
