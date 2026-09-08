import { describe, it, expect } from 'vitest';
import {
  takeWords,
  buildAskPrompt,
  extractRangeContext,
  CONTEXT_WORD_WINDOW,
} from '../../utils/aiContext';

describe('takeWords', () => {
  it('takes words from the end', () => {
    expect(takeWords('one two three four five', 2, 'end')).toBe('four five');
  });

  it('takes words from the start', () => {
    expect(takeWords('one two three four five', 2, 'start')).toBe('one two');
  });

  it('returns everything when asked for more words than there are', () => {
    expect(takeWords('one two', 10, 'end')).toBe('one two');
  });

  it('collapses newlines and runs of whitespace', () => {
    expect(takeWords('one\n\ntwo   three\tfour', 3, 'start')).toBe('one two three');
  });

  it('returns an empty string for blank input', () => {
    expect(takeWords('   \n ', 5, 'end')).toBe('');
    expect(takeWords('', 5, 'start')).toBe('');
  });

  it('returns an empty string when no words are requested', () => {
    expect(takeWords('one two three', 0, 'end')).toBe('');
  });
});

describe('buildAskPrompt', () => {
  const base = {
    selectedText: 'нравственный императив',
    bookTitle: 'Критика практического разума',
    chapterLabel: 'Глава 2',
    before: 'Кант вводит понятие',
    after: 'как основу морали',
  };

  it('includes the selected text', () => {
    expect(buildAskPrompt(base)).toContain('нравственный императив');
  });

  it('includes book title and chapter when known', () => {
    const prompt = buildAskPrompt(base);
    expect(prompt).toContain('Критика практического разума');
    expect(prompt).toContain('Глава 2');
  });

  it('includes the surrounding text', () => {
    const prompt = buildAskPrompt(base);
    expect(prompt).toContain('Кант вводит понятие');
    expect(prompt).toContain('как основу морали');
  });

  it('omits missing context without leaving empty labels', () => {
    const prompt = buildAskPrompt({ selectedText: 'слово' });
    expect(prompt).toContain('слово');
    expect(prompt).not.toMatch(/:\s*$/m);
    expect(prompt).not.toContain('undefined');
  });

  it('asks for a short answer so the popup stays small', () => {
    expect(buildAskPrompt(base).toLowerCase()).toContain('one or two sentences');
  });

  it('uses a 20 word context window', () => {
    expect(CONTEXT_WORD_WINDOW).toBe(20);
  });
});

describe('extractRangeContext', () => {
  const rangeOver = (html: string, selected: string) => {
    document.body.innerHTML = html;
    const node = document.querySelector('p')!.firstChild as Text;
    const start = node.data.indexOf(selected);
    const range = document.createRange();
    range.setStart(node, start);
    range.setEnd(node, start + selected.length);
    return range;
  };

  it('returns the words on each side of the selection', () => {
    const range = rangeOver('<p>alpha beta gamma delta epsilon</p>', 'gamma');
    expect(extractRangeContext(range, 2)).toEqual({ before: 'alpha beta', after: 'delta epsilon' });
  });

  it('limits each side to the requested word count', () => {
    const range = rangeOver('<p>one two three four KEY five six seven eight</p>', 'KEY');
    expect(extractRangeContext(range, 2)).toEqual({ before: 'three four', after: 'five six' });
  });

  it('copes with the selection at the very start or end', () => {
    expect(extractRangeContext(rangeOver('<p>KEY tail here</p>', 'KEY')).before).toBe('');
    expect(extractRangeContext(rangeOver('<p>head here KEY</p>', 'KEY')).after).toBe('');
  });

  it('reaches across sibling elements inside the same block', () => {
    document.body.innerHTML = '<div><p>lead in</p><p>alpha KEY omega</p><p>tail out</p></div>';
    const node = document.querySelectorAll('p')[1]!.firstChild as Text;
    const start = node.data.indexOf('KEY');
    const range = document.createRange();
    range.setStart(node, start);
    range.setEnd(node, start + 3);
    const { before, after } = extractRangeContext(range, 5);
    expect(before).toContain('alpha');
    expect(after).toContain('omega');
  });
});
