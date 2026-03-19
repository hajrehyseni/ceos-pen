export const PILLARS = {
  ai_agents: { label: "AI Agents", color: "pillar-ai" },
  defence_training: { label: "Defence Training", color: "pillar-defence" },
  academic_research: { label: "Academic Research", color: "pillar-academic" },
  ceo_journey: { label: "CEO Journey", color: "pillar-ceo" },
  curated_commentary: { label: "Curated Commentary", color: "pillar-commentary" },
} as const;

export type PillarKey = keyof typeof PILLARS;

export const DAY_PILLARS: PillarKey[] = [
  "ai_agents",         // Monday
  "defence_training",  // Tuesday
  "academic_research", // Wednesday
  "ceo_journey",       // Thursday
  "curated_commentary", // Friday
];

export function getTodayPillar(): PillarKey {
  const day = new Date().getDay(); // 0=Sun, 1=Mon...
  if (day >= 1 && day <= 5) return DAY_PILLARS[day - 1];
  return DAY_PILLARS[0]; // default to Monday pillar on weekends
}

export function getPillarForDate(date: Date): PillarKey {
  const day = date.getDay();
  if (day >= 1 && day <= 5) return DAY_PILLARS[day - 1];
  return DAY_PILLARS[0];
}
