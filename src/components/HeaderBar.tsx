import { getTodayPillar, PILLARS } from "@/lib/constants";

interface HeaderBarProps {
  weeklyCount: number;
}

export function HeaderBar({ weeklyCount }: HeaderBarProps) {
  const today = new Date();
  const pillarKey = getTodayPillar();
  const pillar = PILLARS[pillarKey];
  const dateStr = today.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/80 backdrop-blur-xl">
      <div className="max-w-screen-2xl mx-auto px-6 h-16 flex items-center justify-between">
        <h1 className="text-lg font-bold text-foreground tracking-tight">
          LinkedIn Ghostwriter — <span className="text-primary">LRA</span>
        </h1>

        <div className="hidden md:flex items-center gap-3 text-sm">
          <span className="text-muted-foreground">{dateStr}</span>
          <span className="text-muted-foreground">·</span>
          <span className={`text-${pillar.color} font-medium`}>{pillar.label}</span>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">This week:</span>
          <span className={`font-bold ${weeklyCount >= 5 ? "text-success" : "text-primary"}`}>
            {weeklyCount}
          </span>
          <span className="text-muted-foreground">/ 5</span>
        </div>
      </div>
    </header>
  );
}
