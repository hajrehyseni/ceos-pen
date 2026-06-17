import { useMemo, useState } from "react";
import { AgentLog } from "@/types/database";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { TrendingUp, TrendingDown } from "lucide-react";

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

  const delta = prevWeek > 0 ? ((week - prevWeek) / prevWeek) * 100 : 0;
  const up = delta >= 0;

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <button className="w-full text-left active:scale-[0.98] transition-transform">
          <div className="card-surface px-3 py-2.5 grid grid-cols-3 gap-2 items-center">
            <Cell label="Today" value={fmt(today)} />
            <Cell label="Week" value={fmt(week)} accent />
            <Cell
              label="Month"
              value={fmt(month)}
              extra={
                prevWeek > 0 ? (
                  <span className={`inline-flex items-center gap-0.5 text-[10px] font-medium ${up ? "text-warning" : "text-success"}`}>
                    {up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {Math.abs(delta).toFixed(0)}%
                  </span>
                ) : null
              }
            />
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
            <Stat label="This week" value={fmt(week)} />
            <Stat label="This month" value={fmt(month)} />
          </div>
          <div className="pt-3 border-t border-border space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">This week by action</p>
            {Object.entries(byAction).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => (
              <div key={k} className="flex items-center justify-between text-sm">
                <span className="text-foreground">{k.replace(/_/g, " ")}</span>
                <span className="font-medium tabular-nums">{fmt(v)}</span>
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

function Cell({ label, value, extra, accent }: { label: string; value: string; extra?: React.ReactNode; accent?: boolean }) {
  return (
    <div className="flex flex-col items-center justify-center text-center">
      <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className={`text-base font-bold tabular-nums leading-tight ${accent ? "text-primary" : "text-foreground"}`}>{value}</span>
      {extra}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="card-surface px-3 py-3 text-center">
      <p className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-lg font-bold tabular-nums text-foreground">{value}</p>
    </div>
  );
}
