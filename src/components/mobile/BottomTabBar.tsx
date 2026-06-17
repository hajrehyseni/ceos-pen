import { Home, FileText, CheckCircle2, BarChart3 } from "lucide-react";

export type MobileTab = "today" | "drafts" | "published" | "analytics";

interface Props {
  active: MobileTab;
  onChange: (tab: MobileTab) => void;
  draftCount?: number;
}

const items: { key: MobileTab; label: string; icon: typeof Home }[] = [
  { key: "today", label: "Today", icon: Home },
  { key: "drafts", label: "Drafts", icon: FileText },
  { key: "published", label: "Sent", icon: CheckCircle2 },
  { key: "analytics", label: "Stats", icon: BarChart3 },
];

export function BottomTabBar({ active, onChange, draftCount }: Props) {
  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 hairline-t bg-background/85 backdrop-blur-xl"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="max-w-screen-sm mx-auto grid grid-cols-4">
        {items.map(({ key, label, icon: Icon }) => {
          const isActive = active === key;
          const showBadge = key === "drafts" && (draftCount ?? 0) > 0;
          return (
            <button
              key={key}
              onClick={() => onChange(key)}
              className={`relative flex flex-col items-center justify-center gap-1 min-h-[60px] py-1.5 text-[10px] font-medium transition-colors ${
                isActive ? "text-primary" : "text-muted-foreground active:text-foreground"
              }`}
              aria-label={label}
            >
              {/* glow under active icon */}
              {isActive && (
                <span
                  className="absolute top-2 h-8 w-8 rounded-full -z-0"
                  style={{
                    background: "radial-gradient(circle, hsl(var(--primary) / 0.35) 0%, hsl(var(--primary) / 0) 70%)",
                  }}
                />
              )}
              <div className="relative">
                <Icon className={`w-[22px] h-[22px] ${isActive ? "stroke-[2.4]" : ""}`} />
                {showBadge && (
                  <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-primary text-[9px] font-bold text-primary-foreground flex items-center justify-center ring-2 ring-background">
                    {draftCount! > 9 ? "9+" : draftCount}
                  </span>
                )}
              </div>
              <span className="leading-none">{label}</span>
            </button>
          );
        })}
      </div>
    </nav>
  );
}
