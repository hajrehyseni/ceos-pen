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

export function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function exportNodeAsPng(node: HTMLElement, filename: string) {
  const blob = await nodeToPngBlob(node);
  downloadBlob(blob, filename);
}

export async function copyText(text: string) {
  await navigator.clipboard.writeText(text);
}
