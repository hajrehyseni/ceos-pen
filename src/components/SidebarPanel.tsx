import { Post, PostMetrics, AgentLog } from "@/types/database";
import { ContentCalendar } from "./ContentCalendar";
import { QuickStats } from "./QuickStats";
import { RecentPerformance } from "./RecentPerformance";
import { AgentStatus } from "./AgentStatus";
import { TrendRadar } from "./TrendRadar";

interface SidebarPanelProps {
  posts: Post[];
  metrics: PostMetrics[];
  agentLogs: AgentLog[];
}

export function SidebarPanel({ posts, metrics, agentLogs }: SidebarPanelProps) {
  return (
    <div className="space-y-4 sm:space-y-6">
      <AgentStatus agentLogs={agentLogs} />
      <TrendRadar />
      <ContentCalendar posts={posts} />
      <QuickStats posts={posts} metrics={metrics} agentLogs={agentLogs} />
      <RecentPerformance posts={posts} metrics={metrics} />
    </div>
  );
}
