import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Wand2 } from "lucide-react";
import { CarouselPreview } from "./CarouselPreview";
import { InfographicPreview } from "./InfographicPreview";
import { ImagePostPreview } from "./ImagePostPreview";
import { ChartPreview } from "./ChartPreview";
import { PollPreview } from "./PollPreview";
import { ReplyAssistant } from "./ReplyAssistant";

// Delivery order: Carousel → Poll → Reply → Image → Infographic → Chart
const TABS = [
  { value: "carousel", label: "Carousel" },
  { value: "poll", label: "Poll" },
  { value: "reply", label: "Reply" },
  { value: "image", label: "Image" },
  { value: "infographic", label: "Infographic" },
  { value: "chart", label: "Chart" },
];

export function VisualStudio({ postId }: { postId: string }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("carousel");

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline" className="w-full min-h-11">
          <Wand2 className="w-4 h-4 mr-1.5" /> Create Visual
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-md sm:max-w-lg max-h-[92vh] overflow-y-auto p-4 sm:p-6">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Wand2 className="w-4 h-4" /> Visual Studio
          </DialogTitle>
        </DialogHeader>
        <Tabs value={tab} onValueChange={setTab} className="mt-2">
          <TabsList className="w-full flex overflow-x-auto justify-start gap-1 h-auto p-1 bg-secondary/60">
            {TABS.map((t) => (
              <TabsTrigger key={t.value} value={t.value} className="text-[11px] px-2.5 py-1.5 whitespace-nowrap">
                {t.label}
              </TabsTrigger>
            ))}
          </TabsList>
          <TabsContent value="carousel" className="pt-3"><CarouselPreview postId={postId} /></TabsContent>
          <TabsContent value="poll" className="pt-3"><PollPreview postId={postId} /></TabsContent>
          <TabsContent value="reply" className="pt-3"><ReplyAssistant /></TabsContent>
          <TabsContent value="image" className="pt-3"><ImagePostPreview postId={postId} /></TabsContent>
          <TabsContent value="infographic" className="pt-3"><InfographicPreview postId={postId} /></TabsContent>
          <TabsContent value="chart" className="pt-3">
            <ChartPreview postId={postId} onSwitchToImagePost={() => setTab("image")} />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
