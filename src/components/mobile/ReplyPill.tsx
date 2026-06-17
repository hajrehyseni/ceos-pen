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
          className="fixed right-4 z-30 h-11 px-3.5 rounded-full flex items-center gap-2 text-[13px] font-semibold tap-press"
          style={{
            bottom: "calc(env(safe-area-inset-bottom) + 76px)",
            background: "hsl(var(--surface-2))",
            border: "1px solid hsl(var(--hairline) / 0.1)",
            color: "hsl(var(--foreground))",
            boxShadow: "0 8px 24px -8px hsl(240 60% 2% / 0.6)",
          }}
        >
          <MessageSquare className="w-4 h-4 text-primary" />
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
