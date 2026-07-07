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
  // iPhone/iPod, iPad (including iPadOS reporting as Mac with touch)
  return /iPad|iPhone|iPod/.test(ua) || (/Macintosh/.test(ua) && "ontouchend" in document);
}

/**
 * Download a Blob as a file. Works across desktop browsers and iOS Safari.
 *
 * iOS Safari refuses the classic `<a download>` trick for programmatic downloads,
 * so we prefer the Web Share API (which opens the native share sheet → Save to Files /
 * Save Image), and fall back to opening the blob in a new tab so Safari's viewer
 * shows its built-in download button.
 */
export async function downloadBlob(blob: Blob, filename: string) {
  const mime = blob.type || "application/octet-stream";
  const file = new File([blob], filename, { type: mime });
  const nav = navigator as Navigator & {
    canShare?: (data: ShareData) => boolean;
    share?: (data: ShareData) => Promise<void>;
  };

  // 1. iOS/modern mobile: use the native share sheet (best UX; user can Save to Files).
  if (isIOS() && nav.canShare && nav.share && nav.canShare({ files: [file] })) {
    try {
      await nav.share({ files: [file], title: filename });
      return;
    } catch (err: any) {
      // User cancelled — treat as done, don't fall through.
      if (err?.name === "AbortError") return;
      // Any other failure: fall through to the URL path.
    }
  }

  const url = URL.createObjectURL(blob);

  // 2. iOS Safari fallback: open the blob in a new tab; Safari's viewer offers download.
  if (isIOS()) {
    const win = window.open(url, "_blank");
    if (!win) {
      // Pop-up blocked — navigate current tab so the user still gets the file.
      window.location.href = url;
    }
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
    return;
  }

  // 3. Desktop / Android: classic anchor click.
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
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
