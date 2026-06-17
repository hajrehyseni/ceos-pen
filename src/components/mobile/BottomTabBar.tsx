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
  { key: "published", label: "Published", icon: CheckCircle2 },
  { key: "analytics", label: "Analytics", icon: BarChart3 },
];

export function BottomTabBar({ active, onChange, draftCount }: Props) {
  return (
    <nav
      className="fixed bottom-0 inset-x-0 z-40 border-t border-border bg-background/95 backdrop-blur-xl"
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
              className={`relative flex flex-col items-center justify-center gap-0.5 min-h-[56px] py-1.5 text-[10px] font-medium transition-colors ${
                isActive ? "text-primary" : "text-muted-foreground active:text-foreground"
              }`}
              aria-label={label}
            >
              <div className="relative">
                <Icon className={`w-5 h-5 ${isActive ? "stroke-[2.5]" : ""}`} />
                {showBadge && (
                  <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-primary text-[9px] font-bold text-primary-foreground flex items-center justify-center">
                    {draftCount! > 9 ? "9+" : draftCount}
                  </span>
                )}
              </div>
              <span>{label}</span>
              {isActive && (
                <span className="absolute top-0 left-1/2 -translate-x-1/2 w-8 h-0.5 rounded-b-full bg-primary" />
              )}
            </button>
          );
        })}
      </div>
    </nav>
  );
}
