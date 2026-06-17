import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Carousel, CarouselContent, CarouselItem, CarouselApi } from "@/components/ui/carousel";
import { Sparkles, Download, Copy, FileText, Loader2, ImageIcon, ChevronLeft, ChevronRight, RefreshCw } from "lucide-react";
import * as Icons from "lucide-react";
import { useVisualAsset } from "./useVisualAsset";
import { nodeToPngBlob, downloadBlob, copyText } from "./exportNode";
import { useToast } from "@/hooks/use-toast";
import { QualityBadge } from "./QualityBadge";
import { makeCarouselFallback } from "./visualDefaults";

interface Slide {
  n: number;
  headline: string;
  body: string;
  visual_direction: string;
  icon_hint: string;
}

function getIcon(name: string) {
  const Comp = (Icons as any)[name];
  return Comp ?? Icons.Sparkles;
}

export function CarouselPreview({ postId, draftContent }: { postId: string; draftContent: string }) {
  const { toast } = useToast();
  const { asset, generating, generate, error } = useVisualAsset(postId, "carousel");
  const [api, setApi] = useState<CarouselApi | null>(null);
  const [current, setCurrent] = useState(0);
  const slideRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [exporting, setExporting] = useState<null | "png" | "pdf">(null);

  const payload = asset?.payload ?? makeCarouselFallback(draftContent);
  const slides: Slide[] = payload?.slides ?? [];

  useEffect(() => {
    if (!api) return;
    setCurrent(api.selectedScrollSnap());
    const onSelect = () => setCurrent(api.selectedScrollSnap());
    api.on("select", onSelect);
    return () => {
      api.off("select", onSelect);
    };
  }, [api]);

  async function exportPng() {
    if (!slides.length) return;
    setExporting("png");
    try {
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      for (let i = 0; i < slides.length; i++) {
        const node = slideRefs.current[i];
        if (!node) continue;
        const blob = await nodeToPngBlob(node, 2);
        zip.file(`slide-${String(i + 1).padStart(2, "0")}.png`, blob);
      }
      const out = await zip.generateAsync({ type: "blob" });
      downloadBlob(out, "carousel-slides.zip");
      toast({ title: "Slides exported", description: `${slides.length} PNGs zipped.` });
    } catch (e: any) {
      toast({ title: "PNG export failed", description: e.message, variant: "destructive" });
    }
    setExporting(null);
  }

  async function exportPdf() {
    if (!slides.length) return;
    setExporting("pdf");
    try {
      const { jsPDF } = await import("jspdf");
      // Portrait slides at 1080x1350 (LinkedIn carousel ratio 4:5).
      const pdf = new jsPDF({ unit: "px", format: [1080, 1350], orientation: "portrait" });
      for (let i = 0; i < slides.length; i++) {
        const node = slideRefs.current[i];
        if (!node) continue;
        const blob = await nodeToPngBlob(node, 2);
        const dataUrl = await new Promise<string>((res) => {
          const r = new FileReader();
          r.onload = () => res(r.result as string);
          r.readAsDataURL(blob);
        });
        if (i > 0) pdf.addPage([1080, 1350], "portrait");
        pdf.addImage(dataUrl, "PNG", 0, 0, 1080, 1350);
      }
      pdf.save("carousel.pdf");
      toast({ title: "PDF exported" });
    } catch (e: any) {
      toast({ title: "PDF export failed", description: e.message, variant: "destructive" });
    }
    setExporting(null);
  }

  async function copyAll() {
    if (!payload) return;
    const txt =
      `${payload.title || ""}\n\n` +
      slides.map((s) => `Slide ${s.n}: ${s.headline}\n${s.body}`).join("\n\n") +
      (payload.caption ? `\n\nCaption:\n${payload.caption}` : "");
    await copyText(txt);
    toast({ title: "Carousel text copied" });
  }

  if (generating && !asset) {
    return (
      <div className="rounded-md border border-border p-6 text-center space-y-2">
        <Loader2 className="w-6 h-6 mx-auto animate-spin text-primary" />
        <p className="text-xs text-muted-foreground">Drafting 6 to 8 slides…</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {payload?.title && <h4 className="text-sm font-semibold">{payload.title}</h4>}
      {!asset && (
        <div className="rounded-md border border-primary/30 bg-primary/10 p-3 text-xs text-muted-foreground flex items-start justify-between gap-3">
          <span>Instant draft preview. Create carousel to polish it with the visual agent and save it.</span>
          <Button size="sm" onClick={() => generate()} disabled={generating} className="shrink-0">
            <Sparkles className="w-3.5 h-3.5 mr-1" /> Create
          </Button>
        </div>
      )}

      <div className="w-[260px] sm:w-[340px] mx-auto overflow-hidden">
        <Carousel setApi={setApi} opts={{ align: "center" }}>
          <CarouselContent>
            {slides.map((s, i) => {
              const Icon = getIcon(s.icon_hint);
              return (
                <CarouselItem key={i}>
                  <div
                    ref={(el) => (slideRefs.current[i] = el)}
                    className="aspect-[4/5] w-full rounded-xl p-5 sm:p-6 flex flex-col justify-between text-white overflow-hidden"
                    style={{
                      background:
                        i === slides.length - 1
                          ? "linear-gradient(160deg,#1e1b4b 0%,#312e81 60%,#4338ca 100%)"
                          : i === 0
                            ? "linear-gradient(160deg,#0f172a 0%,#1e293b 70%,#334155 100%)"
                            : "linear-gradient(160deg,#0b1220 0%,#1a2238 100%)",
                    }}
                  >
                    <div className="flex items-center justify-between text-[10px] uppercase tracking-widest opacity-70">
                      <span>CEO Pen · Hajrë</span>
                      <span>{s.n} / {slides.length}</span>
                    </div>
                    <div className="space-y-3">
                      <Icon className="w-7 h-7 opacity-80" />
                      <h5 className="text-lg sm:text-xl font-semibold leading-tight break-words">{s.headline}</h5>
                      <p className="text-xs sm:text-sm leading-relaxed opacity-90 break-words">{s.body}</p>
                    </div>
                    <div className="text-[10px] opacity-50 italic line-clamp-3 break-words">{s.visual_direction}</div>
                  </div>
                </CarouselItem>
              );
            })}
          </CarouselContent>
        </Carousel>
        <div className="flex items-center justify-between mt-2 text-xs text-muted-foreground">
          <button className="p-1 hover:text-foreground" onClick={() => api?.scrollPrev()}>
            <ChevronLeft className="w-4 h-4" />
          </button>
          <span>Slide {current + 1} / {slides.length}</span>
          <button className="p-1 hover:text-foreground" onClick={() => api?.scrollNext()}>
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <div className="grid grid-cols-6 gap-1.5 mt-3">
          {slides.map((s, i) => (
            <button
              key={s.n}
              type="button"
              onClick={() => api?.scrollTo(i)}
              className={`aspect-[4/5] rounded border text-[10px] ${current === i ? "border-primary bg-primary/20" : "border-border bg-secondary/50"}`}
            >
              {i + 1}
            </button>
          ))}
        </div>
      </div>

      {payload?.caption && (
        <div className="rounded-md bg-secondary/60 border border-border p-3 text-xs whitespace-pre-line">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground mb-1">Caption</div>
          {payload.caption}
        </div>
      )}

      <QualityBadge quality={payload?.quality} />

      <div className="flex flex-wrap gap-2 pt-1">
        <Button size="sm" variant="outline" onClick={exportPdf} disabled={exporting !== null}>
          {exporting === "pdf" ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <Download className="w-3.5 h-3.5 mr-1" />}
          PDF
        </Button>
        <Button size="sm" variant="outline" onClick={exportPng} disabled={exporting !== null}>
          {exporting === "png" ? <Loader2 className="w-3.5 h-3.5 mr-1 animate-spin" /> : <ImageIcon className="w-3.5 h-3.5 mr-1" />}
          PNG slides
        </Button>
        <Button size="sm" variant="outline" onClick={copyAll}>
          <Copy className="w-3.5 h-3.5 mr-1" /> Copy text
        </Button>
        <Button size="sm" variant="ghost" onClick={() => generate()} disabled={generating}>
          <RefreshCw className={`w-3.5 h-3.5 mr-1 ${generating ? "animate-spin" : ""}`} /> Regenerate
        </Button>
      </div>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
