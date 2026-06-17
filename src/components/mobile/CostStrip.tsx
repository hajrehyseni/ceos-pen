import { useMemo, useState } from "react";
import { AgentLog } from "@/types/database";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";

interface Props {
  agentLogs: AgentLog[];
}

function fmt(n: number) {
  if (n >= 100) return `$${n.toFixed(0)}`;
  if (n >= 10) return `$${n.toFixed(1)}`;
  return `$${n.toFixed(2)}`;
}

export function CostStrip({ agentLogs }: Props) {
  const [open, setOpen] = useState(false);

  const { today, week, month, prevWeek, byAction } = useMemo(() => {
    const now = new Date();
    const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
    const startOfWeek = new Date(now); startOfWeek.setDate(now.getDate() - ((now.getDay() + 6) % 7)); startOfWeek.setHours(0, 0, 0, 0);
    const startOfPrevWeek = new Date(startOfWeek); startOfPrevWeek.setDate(startOfWeek.getDate() - 7);
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    let today = 0, week = 0, month = 0, prevWeek = 0;
    const byAction: Record<string, number> = {};
    for (const l of agentLogs) {
      const cost = Number(l.api_cost_usd || 0);
      const t = new Date(l.created_at);
      if (t >= startOfDay) today += cost;
      if (t >= startOfWeek) {
        week += cost;
        byAction[l.action] = (byAction[l.action] || 0) + cost;
      } else if (t >= startOfPrevWeek) prevWeek += cost;
      if (t >= startOfMonth) month += cost;
    }
    return { today, week, month, prevWeek, byAction };
  }, [agentLogs]);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button className="w-full text-left tap-press" aria-label="View spend breakdown">
          <div
            className="h-[60px] rounded-full grid grid-cols-3 items-center px-1"
            style={{
              background: "hsl(var(--surface-1))",
              border: "1px solid hsl(var(--hairline) / 0.06)",
            }}
          >
            <Cell label="Today" value={fmt(today)} />
            <Cell label="Week" value={fmt(week)} accent divided />
            <Cell label="Month" value={fmt(month)} divided />
          </div>
        </button>
      </SheetTrigger>
      <SheetContent side="bottom" className="bg-card border-border">
        <SheetHeader>
          <SheetTitle>Spend breakdown</SheetTitle>
        </SheetHeader>
        <div className="pt-4 space-y-3">
          <div className="grid grid-cols-3 gap-3">
            <Stat label="Today" value={fmt(today)} />
            <Stat label="This week" value={fmt(week)} sub={prevWeek > 0 ? `vs ${fmt(prevWeek)} last` : undefined} />
            <Stat label="This month" value={fmt(month)} />
          </div>
          <div className="pt-3 hairline-t space-y-2">
            <p className="label-eyebrow">This week by action</p>
            {Object.entries(byAction).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between text-sm">
                <span className="text-foreground">{k.replace(/_/g, " ")}</span>
                <span className="font-medium num">{fmt(v)}</span>
              </div>
            ))}
            {Object.keys(byAction).length === 0 && (
              <p className="text-xs text-muted-foreground">No spend recorded this week yet.</p>
            )}
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
}

function Cell({ label, value, accent, divided }: { label: string; value: string; accent?: boolean; divided?: boolean }) {
  return (
    <div
      className={`flex flex-col items-center justify-center text-center py-2 ${divided ? "border-l border-[hsl(var(--hairline)/0.08)]" : ""}`}
    >
      <span className="label-eyebrow">{label}</span>
      <span className={`text-[17px] font-semibold num leading-tight mt-0.5 ${accent ? "text-primary" : "text-foreground"}`}>{value}</span>
    </div>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="card-surface px-3 py-3 text-center">
      <p className="label-eyebrow">{label}</p>
      <p className="text-lg font-semibold num text-foreground mt-1">{value}</p>
      {sub && <p className="text-[10px] text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}
