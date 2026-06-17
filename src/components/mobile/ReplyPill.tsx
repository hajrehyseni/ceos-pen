import { useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { MessageSquare } from "lucide-react";
import { ReplyAssistant } from "@/components/visual-studio/ReplyAssistant";

export function ReplyPill() {
  const [open, setOpen] = useState(false);
  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button
          aria-label="Open Reply Assistant"
          className="fixed right-4 z-30 h-12 px-4 rounded-full shadow-lg bg-primary text-primary-foreground flex items-center gap-2 text-sm font-semibold active:scale-95 transition"
          style={{ bottom: "calc(env(safe-area-inset-bottom) + 76px)" }}
        >
          <MessageSquare className="w-4 h-4" />
          Reply
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" className="bg-card border-border max-h-[90vh] overflow-y-auto">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <MessageSquare className="w-4 h-4 text-primary" /> Reply Assistant
          </SheetTitle>
        </SheetHeader>
        <div className="pt-4">
          <ReplyAssistant />
        </div>
      </SheetContent>
    </Sheet>
  );
}
