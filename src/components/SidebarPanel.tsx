import { useState } from "react";
import { Post, PostMetrics, AgentLog } from "@/types/database";
import { ContentCalendar } from "./ContentCalendar";
import { QuickStats } from "./QuickStats";
import { RecentPerformance } from "./RecentPerformance";
import { AgentStatus } from "./AgentStatus";
import { TrendRadar } from "./TrendRadar";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { MessageSquare, ChevronDown, ChevronUp } from "lucide-react";
import { ReplyAssistant } from "./visual-studio/ReplyAssistant";

interface SidebarPanelProps {
  posts: Post[];
  metrics: PostMetrics[];
  agentLogs: AgentLog[];
}

export function SidebarPanel({ posts, metrics, agentLogs }: SidebarPanelProps) {
  const [replyOpen, setReplyOpen] = useState(false);
  return (
    <div className="space-y-4 sm:space-y-6">
      <AgentStatus agentLogs={agentLogs} />
      <TrendRadar />

      <Collapsible open={replyOpen} onOpenChange={setReplyOpen} className="card-surface p-4">
        <CollapsibleTrigger className="w-full flex items-center justify-between text-sm font-medium">
          <span className="flex items-center gap-2"><MessageSquare className="w-4 h-4" /> Reply Assistant</span>
          {replyOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3">
          <ReplyAssistant />
        </CollapsibleContent>
      </Collapsible>

      <ContentCalendar posts={posts} />
      <QuickStats posts={posts} metrics={metrics} agentLogs={agentLogs} />
      <RecentPerformance posts={posts} metrics={metrics} />
    </div>
  );
}
