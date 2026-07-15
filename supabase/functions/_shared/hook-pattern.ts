// Classify the opening line of a LinkedIn post into a "hook pattern" label.
// Cheap regex-first classifier so we can build a leaderboard of which
// hook shapes actually perform.

export function classifyHookPattern(content: string): string {
  const first = (content ?? "").trim().split(/\n/)[0]?.trim() ?? "";
  const lower = first.toLowerCase();
  if (!first) return "unknown";

  if (/^\d+[.)]/.test(first) || /^\d+\s+(reasons|ways|things|lessons|mistakes)/i.test(first)) return "listicle";
  if (/\?$/.test(first)) return "question";
  if (/^(stop|never|don'?t|avoid)\b/i.test(first)) return "contrarian_command";
  if (/^(most|everyone|nobody|people|founders|ceos?)\b.+(wrong|miss|ignore|overrate|underrate)/i.test(first)) return "contrarian_claim";
  if (/^(i\s+(watched|saw|learned|realised|noticed|spent|built|shipped|lost|hired|fired))/i.test(first)) return "personal_story";
  if (/^(here'?s|this is|the (truth|reality|thing))/i.test(first)) return "declarative_reveal";
  if (/[£$€]\d|\d+\s*(k|m|bn|billion|million|percent|%)/i.test(first)) return "stat_led";
  if (/^(new|breaking|just|today|yesterday|this week)\b/i.test(first)) return "news_led";
  if (/["'"]/i.test(first) && first.length < 140) return "quote_led";
  if (/^(after|before|when|while|if)\b/i.test(lower)) return "conditional_setup";
  return "other";
}
