import { useMemo } from "react";
import { AgentLog } from "@/types/database";

interface AgentStatusProps {
  agentLogs: AgentLog[];
}

function getNextScheduledRun(): { label: string; time: Date } {
  const now = new Date();
  const utcDay = now.getUTCDay(); // 0=Sun
  const utcHour = now.getUTCHours();
  const utcMinute = now.getUTCMinutes();

  // Schedule: collect-news 7:00, generate-draft 7:30 UTC, Mon-Fri
  const runs = [
    { label: "Collect News", hour: 7, minute: 0 },
    { label: "Generate Draft", hour: 7, minute: 30 },
  ];

  // Check today and next 7 days
  for (let offset = 0; offset < 8; offset++) {
    const candidate = new Date(now);
    candidate.setUTCDate(candidate.getUTCDate() + offset);
    const day = candidate.getUTCDay();

    if (day === 0 || day === 6) continue; // skip weekends

    for (const run of runs) {
      candidate.setUTCHours(run.hour, run.minute, 0, 0);
      if (candidate > now) {
        return { label: run.label, time: candidate };
      }
    }
  }

  // Fallback
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
  const lastRun = useMemo(() => {
    if (agentLogs.length === 0) return null;
    const sorted = [...agentLogs].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );
    return sorted[0];
  }, [agentLogs]);

  const next = useMemo(() => getNextScheduledRun(), []);

  const nextTimeStr = next.time.toLocaleTimeString("en-GB", {
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
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

        {/* Next run */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Next run</span>
          <span className="text-foreground font-medium">{next.label}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Scheduled</span>
          <span className="text-foreground font-medium">{nextTimeStr}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Countdown</span>
          <span className="text-primary font-medium">{formatRelative(next.time)}</span>
        </div>

        {/* Last run */}
        {lastRun && (
          <div className="flex items-center justify-between text-sm pt-2 border-t border-border">
            <span className="text-muted-foreground">Last action</span>
            <span className="text-foreground font-medium text-xs">
              {lastRun.action?.replace(/_/g, " ")}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
