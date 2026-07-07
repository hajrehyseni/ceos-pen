import { toPng } from "html-to-image";

export async function nodeToPngBlob(node: HTMLElement, pixelRatio = 2): Promise<Blob> {
  const dataUrl = await toPng(node, {
    pixelRatio,
    cacheBust: true,
    backgroundColor: getComputedStyle(node).backgroundColor || "#0f172a",
  });
  const res = await fetch(dataUrl);
  return await res.blob();
}

function isIOS(): boolean {
  if (typeof navigator === "undefined") return false;
  const ua = navigator.userAgent || "";
  if (/iPad|iPhone|iPod/.test(ua)) return true;
  // iPadOS 13+ reports as Mac. Distinguish real iPad from desktop Mac by
  // requiring multi-touch AND the absence of a mouse-like pointer.
  const isMac = /Macintosh/.test(ua);
  const multiTouch = (navigator.maxTouchPoints || 0) > 1;
  return isMac && multiTouch;
}

async function tryNativeShare(blob: Blob, filename: string): Promise<boolean> {
  const nav = navigator as Navigator & {
    canShare?: (data: ShareData) => boolean;
    share?: (data: ShareData) => Promise<void>;
  };
  if (!nav.share || !nav.canShare) return false;
  try {
    const file = new File([blob], filename, { type: blob.type || "application/octet-stream" });
    if (!nav.canShare({ files: [file] })) return false;
    await nav.share({ files: [file], title: filename });
    return true;
  } catch (err: any) {
    // User cancelled share sheet — treat as handled.
    if (err?.name === "AbortError") return true;
    console.warn("[download] share failed, falling back:", err);
    return false;
  }
}

function inIframe(): boolean {
  try {
    return window.self !== window.top;
  } catch {
    return true;
  }
}

/**
 * Download a Blob as a file. Works across desktop browsers, sandboxed iframes
 * (Lovable preview), and iOS Safari.
 */
export async function downloadBlob(blob: Blob, filename: string): Promise<void> {
  // iOS: prefer share sheet (native "Save to Files" / Photos).
  if (isIOS()) {
    const shared = await tryNativeShare(blob, filename);
    if (shared) return;
  }

  const url = URL.createObjectURL(blob);
  let anchorClicked = false;

  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    a.target = "_blank";
    document.body.appendChild(a);
    a.click();
    a.remove();
    anchorClicked = true;
  } catch (err) {
    console.error("[download] anchor click failed:", err);
  }

  // Sandboxed iframes (like the Lovable preview) can silently block <a download>.
  // Open the blob in a new tab as a guaranteed fallback so the browser at least
  // surfaces the file to the user.
  if (inIframe() || !anchorClicked) {
    try {
      const win = window.open(url, "_blank", "noopener");
      if (!win) {
        // Pop-up blocked → last resort, navigate current tab.
        window.location.href = url;
      }
    } catch (err) {
      console.error("[download] window.open failed:", err);
      window.location.href = url;
    }
  }

  setTimeout(() => URL.revokeObjectURL(url), 30_000);
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
