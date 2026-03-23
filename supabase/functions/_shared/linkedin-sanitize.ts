export interface LinkedInSanitizationDiagnostics {
  originalLength: number;
  sanitizedLength: number;
  nonAsciiRemovedCount: number;
  firstRemovedHexCodes: string[];
}

export interface LinkedInSanitizationResult {
  sanitizedText: string;
  diagnostics: LinkedInSanitizationDiagnostics;
}

function toHexCode(char: string): string {
  const codePoint = char.codePointAt(0);
  if (codePoint === undefined) return "";
  return `U+${codePoint.toString(16).toUpperCase().padStart(4, "0")}`;
}

export function sanitizeForLinkedIn(text: string): LinkedInSanitizationResult {
  let s = text.normalize("NFKD");

  s = s
    .replace(/[\u2022\u2023\u2043\u2219\u25E6]/g, "-")
    .replace(/\u20AC/g, "EUR ")
    .replace(/\u00A3/g, "GBP ")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u2014\u2015]/g, "--")
    .replace(/[\u2010\u2011\u2012\u2013]/g, "-")
    .replace(/\u2026/g, "...")
    .replace(/\u00A0/g, " ")
    .replace(/[\u200B\u200C\u200D\u2060\uFEFF]/g, "")
    .replace(/\u00A9/g, "(c)")
    .replace(/\u00AE/g, "(R)")
    .replace(/\u2122/g, "TM")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[\u0300-\u036f]/g, "");

  const removedChars = Array.from(s.matchAll(/[^\x09\x0A\x20-\x7E]/gu), (m) => m[0]);

  s = s.replace(/[^\x09\x0A\x20-\x7E]/gu, "");

  s = s
    .replace(/[ \t]{2,}/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  return {
    sanitizedText: s,
    diagnostics: {
      originalLength: text.length,
      sanitizedLength: s.length,
      nonAsciiRemovedCount: removedChars.length,
      firstRemovedHexCodes: removedChars.slice(0, 10).map(toHexCode),
    },
  };
}