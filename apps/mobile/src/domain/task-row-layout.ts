/** Shared geometry only. It carries no task, membership, or payment state. */
export const taskRowMetrics = Object.freeze({
  rowPadding: 16,
  rowGap: 14,
  rowBorderWidth: 1,
  minHeight: 78,
  checkboxSize: 19,
  checkboxBorderWidth: 1.5,
  checkboxRadius: 3,
  checkboxTop: 2,
  metaFontSize: 11,
  metaLineHeight: 18,
  metaGap: 5,
  titleFontSize: 15,
  titleLineHeight: 22,
  titleGap: 4,
  assigneeFontSize: 12,
  assigneeLineHeight: 21,
  avatarSize: 24,
});

/** Public catalogue copy, never selected from a family's applicable/hidden tasks. */
export const publicPreviewTitles: readonly { readonly ja: string; readonly en: string }[] = Object.freeze([
  Object.freeze({ ja: '死亡診断書の受け取りを確認する', en: 'Check how to receive the medical certificate' }),
  Object.freeze({ ja: '死亡届の提出状況を確認する', en: 'Check the status of death registration' }),
  Object.freeze({ ja: '銀行の相続手続きを確認する', en: 'Check the bank inheritance process' }),
  Object.freeze({ ja: '契約中のサービスを確認する', en: 'Review ongoing service contracts' }),
]);

const glyphWidth = (character: string, fontSize: number) => {
  if (/\s/u.test(character)) return fontSize * 0.33;
  // Approximation for a decorative SVG only; ordinary task text uses native layout.
  return fontSize * (/^[\x20-\x7e]$/u.test(character) ? 0.6 : 1);
};

/**
 * Keep Latin words together when they fit; Japanese and oversized words can wrap
 * at Unicode code-point boundaries. Whitespace is normalized, never other text.
 * A very narrow/invalid width allows at least one full-width glyph per line.
 */
export function wrapPreviewTitle(text: string, width: number, fontSize: number = taskRowMetrics.titleFontSize): string[] {
  const size = Number.isFinite(fontSize) && fontSize > 0 ? fontSize : taskRowMetrics.titleFontSize;
  const available = Number.isFinite(width) && width > 0 ? Math.max(width, size) : size;
  const tokens = text.trim().match(/\s+|[A-Za-z0-9]+(?:['’.-][A-Za-z0-9]+)*|[^\s]/gu) ?? [];
  const lines: string[] = [];
  let line = '';
  let used = 0;
  let space = false;
  const flush = () => {
    if (line) lines.push(line);
    line = '';
    used = 0;
  };
  for (const token of tokens) {
    if (/^\s+$/u.test(token)) { space = !!line; continue; }
    const characters = Array.from(token);
    const tokenWidth = characters.reduce((sum, character) => sum + glyphWidth(character, size), 0);
    if (tokenWidth <= available) {
      const gap = space && line ? glyphWidth(' ', size) : 0;
      if (line && used + gap + tokenWidth > available) flush();
      if (line && space) { line += ' '; used += glyphWidth(' ', size); }
      line += token;
      used += tokenWidth;
    } else {
      flush();
      for (const character of characters) {
        const next = glyphWidth(character, size);
        if (line && used + next > available) flush();
        line += character;
        used += next;
      }
    }
    space = false;
  }
  flush();
  return lines;
}

/** Natural row height: meta, title, assignee and their gaps, not just minHeight. */
export function rowHeightFromLines(lineCount: number): number {
  const lines = Number.isFinite(lineCount) ? Math.max(1, Math.min(Number.MAX_SAFE_INTEGER, Math.ceil(lineCount))) : 1;
  const m = taskRowMetrics;
  return m.rowPadding * 2 + m.metaLineHeight + m.metaGap + m.titleLineHeight * lines
    + m.titleGap + m.assigneeLineHeight + m.rowBorderWidth;
}
