// Context assembly for the "Ask AI" selection tool.
//
// The reader hands the model what it cannot see: which book and chapter the
// passage comes from, and the words immediately around it. Without the
// surrounding words a pronoun or a bare term is unanswerable; without the book
// and chapter the model guesses at the wrong domain.

/** Words taken on each side of the selection. */
export const CONTEXT_WORD_WINDOW = 20;

export interface AIAskContext {
  selectedText: string;
  bookTitle?: string;
  chapterLabel?: string;
  /** Text immediately before the selection. */
  before?: string;
  /** Text immediately after the selection. */
  after?: string;
}

const collapse = (text: string): string => text.trim().replace(/\s+/g, ' ');

/**
 * Take `count` words from either end of `text`, with whitespace collapsed.
 * Used to trim the raw text around a selection down to the context window.
 */
export const takeWords = (text: string, count: number, side: 'start' | 'end'): string => {
  if (count <= 0) return '';
  const words = collapse(text).split(' ').filter(Boolean);
  if (words.length === 0) return '';
  return (side === 'end' ? words.slice(-count) : words.slice(0, count)).join(' ');
};

/**
 * Read the words surrounding a selection out of the rendered document.
 *
 * Walks up to the nearest block-level ancestor and takes everything on each
 * side of the range, so the window crosses element boundaries (a selection
 * inside an <em> still sees the rest of its paragraph). Falls back to the
 * range's own container when no block ancestor is reachable.
 */
export const extractRangeContext = (
  range: Range,
  words: number = CONTEXT_WORD_WINDOW,
): { before: string; after: string } => {
  const container = range.commonAncestorContainer;
  const element =
    container.nodeType === Node.ELEMENT_NODE ? (container as Element) : container.parentElement;
  const root = element?.closest('p, li, blockquote, section, article, div, body') ?? element;
  if (!root) return { before: '', after: '' };

  const sideText = (side: 'before' | 'after'): string => {
    try {
      const sideRange = range.cloneRange();
      sideRange.selectNodeContents(root);
      if (side === 'before') {
        sideRange.setEnd(range.startContainer, range.startOffset);
      } else {
        sideRange.setStart(range.endContainer, range.endOffset);
      }
      return sideRange.toString();
    } catch {
      // setStart/setEnd throw when the range and root end up in different
      // trees — a stale selection after a re-render. No context is better
      // than a crash in the popup.
      return '';
    }
  };

  return {
    before: takeWords(sideText('before'), words, 'end'),
    after: takeWords(sideText('after'), words, 'start'),
  };
};

/**
 * Build the prompt for the short answer shown in the selection popup.
 *
 * Every context line carries its value inline and is dropped entirely when the
 * value is missing, so the model never receives a dangling `Chapter:` label it
 * might try to fill in.
 */
export const buildAskPrompt = (ctx: AIAskContext): string => {
  const lines: string[] = [
    'You are helping someone who is reading. Explain the selected passage in ' +
      'one or two sentences — plain, concrete, no preamble. Answer in the same ' +
      'language as the selected passage.',
    '',
  ];

  if (ctx.bookTitle) lines.push(`Book: ${collapse(ctx.bookTitle)}`);
  if (ctx.chapterLabel) lines.push(`Chapter: ${collapse(ctx.chapterLabel)}`);
  if (ctx.before) lines.push(`Text before: ${collapse(ctx.before)}`);
  if (ctx.after) lines.push(`Text after: ${collapse(ctx.after)}`);

  lines.push('', `Selected passage: ${collapse(ctx.selectedText)}`);

  return lines.join('\n');
};
