import { useState } from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, ChevronUp, Wand2 } from "lucide-react";
import { CarouselPreview } from "./CarouselPreview";
import { InfographicPreview } from "./InfographicPreview";
import { ImagePostPreview } from "./ImagePostPreview";
import { ChartPreview } from "./ChartPreview";
import { PollPreview } from "./PollPreview";
import { ReplyAssistant } from "./ReplyAssistant";

export function VisualStudio({ postId }: { postId: string }) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState("carousel");

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="pt-2 border-t border-border">
      <CollapsibleTrigger className="w-full flex items-center justify-between text-[11px] font-medium text-muted-foreground hover:text-foreground transition py-1">
        <span className="flex items-center gap-1.5">
          <Wand2 className="w-3 h-3" /> Visual Studio
          <span className="text-[10px] opacity-60">· carousel, infographic, image, chart, poll, replies</span>
        </span>
        {open ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
      </CollapsibleTrigger>
      <CollapsibleContent className="pt-3">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList className="w-full flex overflow-x-auto justify-start gap-1 h-auto p-1 bg-secondary/60">
            <TabsTrigger value="carousel" className="text-[11px] px-2.5 py-1.5">Carousel</TabsTrigger>
            <TabsTrigger value="infographic" className="text-[11px] px-2.5 py-1.5">Infographic</TabsTrigger>
            <TabsTrigger value="image" className="text-[11px] px-2.5 py-1.5">Image</TabsTrigger>
            <TabsTrigger value="chart" className="text-[11px] px-2.5 py-1.5">Chart</TabsTrigger>
            <TabsTrigger value="poll" className="text-[11px] px-2.5 py-1.5">Poll</TabsTrigger>
            <TabsTrigger value="reply" className="text-[11px] px-2.5 py-1.5">Reply</TabsTrigger>
          </TabsList>
          <TabsContent value="carousel" className="pt-3"><CarouselPreview postId={postId} /></TabsContent>
          <TabsContent value="infographic" className="pt-3"><InfographicPreview postId={postId} /></TabsContent>
          <TabsContent value="image" className="pt-3"><ImagePostPreview postId={postId} /></TabsContent>
          <TabsContent value="chart" className="pt-3"><ChartPreview postId={postId} onSwitchToImagePost={() => setTab("image")} /></TabsContent>
          <TabsContent value="poll" className="pt-3"><PollPreview postId={postId} /></TabsContent>
          <TabsContent value="reply" className="pt-3"><ReplyAssistant /></TabsContent>
        </Tabs>
      </CollapsibleContent>
    </Collapsible>
  );
}
