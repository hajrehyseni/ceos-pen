import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { BarChart3, Images, MessageSquare, PanelTop, PieChart, Wand2 } from "lucide-react";
import { CarouselPreview } from "./CarouselPreview";
import { InfographicPreview } from "./InfographicPreview";
import { ImagePostPreview } from "./ImagePostPreview";
import { ChartPreview } from "./ChartPreview";
import { PollPreview } from "./PollPreview";
import { ReplyAssistant } from "./ReplyAssistant";

// Delivery order: Carousel → Poll → Reply → Image → Infographic → Chart
const TABS = [
  { value: "carousel", label: "Carousel", Icon: Images },
  { value: "poll", label: "Poll", Icon: PieChart },
  { value: "reply", label: "Reply", Icon: MessageSquare },
  { value: "image", label: "Image", Icon: PanelTop },
  { value: "infographic", label: "Infographic", Icon: Wand2 },
  { value: "chart", label: "Chart", Icon: BarChart3 },
];

export function VisualStudio({ postId, draftContent }: { postId: string; draftContent: string }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("carousel");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="w-full min-h-11 border-primary/40 bg-primary/10 hover:bg-primary/15">
          <Wand2 className="w-4 h-4 mr-1.5" /> Open Visual Studio
        </Button>
      </DialogTrigger>
      <DialogContent className="w-[calc(100vw-1rem)] max-w-md sm:max-w-lg max-h-[92vh] overflow-y-auto overflow-x-hidden p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Wand2 className="w-4 h-4" /> Visual Studio
          </DialogTitle>
        </DialogHeader>
        <div className="rounded-md border border-border bg-secondary/40 p-3 pr-8 text-xs text-muted-foreground break-words">
          Visual previews are ready to swipe, copy and export. Create each format to polish it with the visual agent.
        </div>
        <Tabs value={tab} onValueChange={setTab} className="mt-2">
          <TabsList className="w-full flex overflow-x-auto justify-start gap-1 h-auto p-1 bg-secondary/60">
            {TABS.map(({ Icon, ...t }) => (
              <TabsTrigger key={t.value} value={t.value} className="text-[11px] px-2.5 py-1.5 whitespace-nowrap">
                <Icon className="w-3 h-3 mr-1" /> {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value="carousel" className="pt-3"><CarouselPreview postId={postId} draftContent={draftContent} /></TabsContent>
          <TabsContent value="poll" className="pt-3"><PollPreview postId={postId} draftContent={draftContent} /></TabsContent>
          <TabsContent value="reply" className="pt-3"><ReplyAssistant /></TabsContent>
          <TabsContent value="image" className="pt-3"><ImagePostPreview postId={postId} draftContent={draftContent} /></TabsContent>
          <TabsContent value="infographic" className="pt-3"><InfographicPreview postId={postId} draftContent={draftContent} /></TabsContent>
          <TabsContent value="chart" className="pt-3">
            <ChartPreview postId={postId} onSwitchToImagePost={() => setTab("image")} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
