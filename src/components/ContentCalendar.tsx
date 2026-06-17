import { Post } from "@/types/database";
import { DAY_PILLARS, PILLARS, PillarKey } from "@/lib/constants";
import { Check, Circle, Minus } from "lucide-react";

interface ContentCalendarProps {
  posts: Post[];
}

export function ContentCalendar({ posts }: ContentCalendarProps) {
  const today = new Date();
  const monday = new Date(today);
  monday.setDate(today.getDate() - ((today.getDay() + 6) % 7));

  const weekDays = Array.from({ length: 5 }, (_, i) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + i);
    return d;
  });

  return (
    <div className="card-surface p-5 space-y-3">
      <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">This Week</h3>
      <div className="space-y-1">
        {weekDays.map((day, i) => {
          const pillarKey = DAY_PILLARS[i];
          const pillar = PILLARS[pillarKey];
          const isToday = day.toDateString() === today.toDateString();
          const dayStr = day.toISOString().split("T")[0];

          const dayPosts = posts.filter((p) => p.created_at.startsWith(dayStr));
          const hasApproved = dayPosts.some((p) => p.status === "approved" || p.status === "published");
          const hasDraft = dayPosts.some((p) => p.status === "draft");

          return (
            <div
              key={i}
              className={`flex items-center justify-between px-3 py-2 rounded-lg text-sm transition-colors ${
                isToday ? "bg-primary/10 border border-primary/20" : ""
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground w-8">
                  {day.toLocaleDateString("en-GB", { weekday: "short" })}
                </span>
                <span className={`text-xs ${isToday ? "text-foreground font-medium" : "text-muted-foreground"}`}>
                  {pillar.label}
                </span>
              </div>
              <div>
                {hasApproved ? (
                  <Check className="w-4 h-4 text-success" />
                ) : hasDraft ? (
                  <Circle className="w-4 h-4 text-warning fill-warning" />
                ) : (
                  <Minus className="w-4 h-4 text-muted-foreground/30" />
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
