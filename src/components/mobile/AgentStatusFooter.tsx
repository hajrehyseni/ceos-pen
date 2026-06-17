import { useMemo, useState } from "react";
import { AgentLog } from "@/types/database";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Activity, ChevronUp } from "lucide-react";

interface Props {
  agentLogs: AgentLog[];
}

function getNextRun(): { label: string; time: Date } {
  const now = new Date();
  const candidates: { label: string; time: Date }[] = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(now);
    d.setUTCDate(now.getUTCDate() + i);
    const day = d.getUTCDay();
    if (day === 0 || day === 6) continue;
    const slots: [number, number, string][] = [
      [7, 0, "News scan"],
      [7, 30, "Draft generation"],
      [19, 0, "Evening sweep"],
    ];
    for (const [h, m, label] of slots) {
      const t = new Date(d);
      t.setUTCHours(h, m, 0, 0);
      if (t > now) candidates.push({ label, time: t });
    }
  }
  candidates.sort((a, b) => a.time.getTime() - b.time.getTime());
  return candidates[0] || { label: "Next run", time: now };
}

function shortAgo(d: Date): string {
  const ms = Date.now() - d.getTime();
  const m = Math.floor(Math.abs(ms) / 60000);
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h`;
  return `${Math.floor(h / 24)}d`;
}

function shortTime(d: Date): string {
  return d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false });
}

export function AgentStatusFooter({ agentLogs }: Props) {
  const [open, setOpen] = useState(false);

  const { lastRun, next, recent } = useMemo(() => {
    const sorted = [...agentLogs].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
    const lastRun = sorted[0] ? new Date(sorted[0].created_at) : null;
    return { lastRun, next: getNextRun(), recent: sorted.slice(0, 8) };
  }, [agentLogs]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button className="w-full text-left">
          <div className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg border border-border bg-secondary/30 active:bg-secondary/50 transition">
            <div className="flex items-center gap-2 min-w-0">
              <span className="relative flex h-2 w-2 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-success opacity-60" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-success" />
              </span>
              <span className="text-[11px] text-muted-foreground truncate">
                {lastRun ? `Last ${shortAgo(lastRun)}` : "No runs"} · Next {shortTime(next.time)}
              </span>
            </div>
            <ChevronUp className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
          </div>
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" className="bg-card border-border">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2"><Activity className="w-4 h-4 text-success" /> Agent activity</SheetTitle>
        </SheetHeader>
        <div className="pt-4 space-y-3">
          <div className="grid grid-cols-2 gap-2">
            <div className="card-surface p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Last run</p>
              <p className="text-sm font-medium text-foreground">{lastRun ? lastRun.toLocaleString("en-GB", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }) : "—"}</p>
            </div>
            <div className="card-surface p-3">
              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">Next: {next.label}</p>
              <p className="text-sm font-medium text-foreground">{next.time.toLocaleString("en-GB", { weekday: "short", hour: "2-digit", minute: "2-digit" })}</p>
            </div>
          </div>
          <div>
            <p className="text-[10px] uppercase tracking-wider text-muted-foreground mb-2">Recent activity</p>
            <ul className="space-y-1.5">
              {recent.map((l) => (
                <li key={l.id} className="flex items-center justify-between text-xs px-3 py-2 rounded-md bg-secondary/40">
                  <span className="text-foreground">{l.action.replace(/_/g, " ")}</span>
                  <span className="text-muted-foreground tabular-nums">{shortAgo(new Date(l.created_at))} ago</span>
                </li>
              ))}
              {recent.length === 0 && <li className="text-xs text-muted-foreground">No activity yet.</li>}
            </ul>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}
