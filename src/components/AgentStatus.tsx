import { useMemo } from "react";
import { AgentLog } from "@/types/database";

interface AgentStatusProps {
  agentLogs: AgentLog[];
}

function getNextScheduledRun(): { label: string; time: Date } {
  const now = new Date();

  // Schedule: collect-news 7:00, generate-draft 7:30 UTC, Mon-Fri
  const runs = [
    { label: "Collect News", hour: 7, minute: 0 },
    { label: "Generate Draft", hour: 7, minute: 30 },
  ];

  for (let offset = 0; offset < 8; offset++) {
    const candidate = new Date(now);
    candidate.setUTCDate(candidate.getUTCDate() + offset);
    const day = candidate.getUTCDay();

    if (day === 0 || day === 6) continue;

    for (const run of runs) {
      candidate.setUTCHours(run.hour, run.minute, 0, 0);
      if (candidate > now) {
        return { label: run.label, time: candidate };
      }
    }
  }

  return { label: "Collect News", time: new Date(now.getTime() + 86400000) };
}

function formatRelative(target: Date): string {
  const now = new Date();
  const diffMs = target.getTime() - now.getTime();
  const diffHours = Math.floor(diffMs / 3600000);
  const diffMinutes = Math.floor((diffMs % 3600000) / 60000);

  if (diffHours > 24) {
    const days = Math.floor(diffHours / 24);
    return `in ${days}d ${diffHours % 24}h`;
  }
  if (diffHours > 0) {
    return `in ${diffHours}h ${diffMinutes}m`;
  }
  return `in ${diffMinutes}m`;
}

export function AgentStatus({ agentLogs }: AgentStatusProps) {
  const lastNewsCollection = useMemo(() => {
    const newsLogs = agentLogs.filter((l) => l.action === "news_collected");
    return newsLogs.length > 0
      ? newsLogs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
      : null;
  }, [agentLogs]);

  const lastDraftGenerated = useMemo(() => {
    const draftLogs = agentLogs.filter((l) => l.action === "draft_generated");
    return draftLogs.length > 0
      ? draftLogs.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0]
      : null;
  }, [agentLogs]);

  const todayCost = useMemo(() => {
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);
    return agentLogs
      .filter((l) => new Date(l.created_at) >= todayStart)
      .reduce((sum, l) => sum + (Number(l.api_cost_usd) || 0), 0);
  }, [agentLogs]);

  const next = useMemo(() => getNextScheduledRun(), []);

  const nextTimeStr = next.time.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  });

  const formatTime = (dateStr: string) =>
    new Date(dateStr).toLocaleString("en-GB", {
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });

  return (
    <div className="card-surface p-5 space-y-3">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
        Agent Status
      </h3>

      <div className="space-y-3">
        {/* Status indicator */}
        <div className="flex items-center gap-2">
          <span className="relative flex h-2.5 w-2.5">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-75"></span>
            <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-success"></span>
          </span>
          <span className="text-sm text-foreground font-medium">Active</span>
        </div>

        {/* Last news collection */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Last news</span>
          <span className="text-foreground font-medium text-xs">
            {lastNewsCollection ? formatTime(lastNewsCollection.created_at) : "—"}
          </span>
        </div>

        {/* Last draft generated */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Last draft</span>
          <span className="text-foreground font-medium text-xs">
            {lastDraftGenerated ? formatTime(lastDraftGenerated.created_at) : "—"}
          </span>
        </div>

        {/* Next run */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Next run</span>
          <span className="text-foreground font-medium text-xs">
            {next.label} · {nextTimeStr}
          </span>
        </div>

        {/* Countdown */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Countdown</span>
          <span className="text-primary font-medium">{formatRelative(next.time)}</span>
        </div>

        {/* Today's API cost */}
        <div className="flex items-center justify-between text-sm pt-2 border-t border-border">
          <span className="text-muted-foreground">API cost today</span>
          <span className="text-foreground font-medium">${todayCost.toFixed(4)}</span>
        </div>
      </div>
    </div>
  );
}
