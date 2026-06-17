// Final pre-save sanitiser for LinkedIn drafts.
// Strips em-dashes, markdown formatting, leading hashtags, blockquotes and headings.
// Keeps URLs intact.

export interface ContentSanitizeDiagnostics {
  removedEmDashes: number;
  removedMarkdownBold: number;
  removedHashtags: number;
  removedHeadings: number;
  removedBlockquotes: number;
}

export interface ContentSanitizeResult {
  text: string;
  diagnostics: ContentSanitizeDiagnostics;
}

export function sanitizeDraftContent(input: string): ContentSanitizeResult {
  let s = input;

  const removedEmDashes = (s.match(/[—–―]/g) || []).length;
  const removedMarkdownBold =
    (s.match(/\*\*[^*\n]+\*\*/g) || []).length +
    (s.match(/__[^_\n]+__/g) || []).length;
  const removedHashtags = (s.match(/(^|\s)#\w+/g) || []).length;
  const removedHeadings = (s.match(/^#{1,6}\s+/gm) || []).length;
  const removedBlockquotes = (s.match(/^>\s+/gm) || []).length;

  // Markdown bold/italic markers — keep the inner text
  s = s.replace(/\*\*([^*\n]+)\*\*/g, "$1");
  s = s.replace(/__([^_\n]+)__/g, "$1");
  // Single-asterisk italics (only when clearly wrapping a word, not list markers)
  s = s.replace(/(^|[\s(])\*([^\s*][^*\n]*?[^\s*]|\S)\*(?=[\s).,;:!?]|$)/g, "$1$2");

  // ATX headings -> plain line
  s = s.replace(/^#{1,6}\s+/gm, "");
  // Blockquote markers
  s = s.replace(/^>\s?/gm, "");

  // Hashtags -> just the word (preserve URLs like build.londonra.com#section by only matching when # is at start/space)
  s = s.replace(/(^|\s)#(\w+)/g, "$1$2");

  // Em-dashes / en-dashes -> ", " (with surrounding spacing collapsed)
  s = s.replace(/\s*[—–―]\s*/g, ", ");

  // Tidy: collapse 3+ blank lines, trim
  s = s.replace(/\n{3,}/g, "\n\n").trim();

  return {
    text: s,
    diagnostics: {
      removedEmDashes,
      removedMarkdownBold,
      removedHashtags,
      removedHeadings,
      removedBlockquotes,
    },
  };
}
