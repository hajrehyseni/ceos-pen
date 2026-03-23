export function sanitizeForLinkedIn(text: string): string {
  let s = text.normalize("NFKD");

  // Normalize common punctuation/business symbols before whitelist pass
  s = s
    .replace(/[\u2022\u2023\u2043\u2219\u25E6]/g, "-")
    .replace(/\u20AC/g, "EUR ")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u2014\u2015]/g, "--")
    .replace(/[\u2010\u2011\u2012\u2013]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u00A0/g, " ")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[\u0300-\u036f]/g, "");

  // Whitelist: keep tab, newline, and printable ASCII only
  s = s.replace(/[^\x09\x0A\x20-\x7E]/g, " ");

  // Tidy spacing without collapsing paragraph intent
  s = s
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return s;
}