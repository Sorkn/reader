import { describe, it, expect, afterEach } from 'vitest';
import { shouldDockNotebookToBottom, resolveNotebookDock } from '@/app/reader/utils/mobileLayout';

const viewport = (width: number, height: number) => {
  Object.defineProperty(window, 'innerWidth', { value: width, configurable: true });
  Object.defineProperty(window, 'innerHeight', { value: height, configurable: true });
};

afterEach(() => viewport(1024, 768));

describe('shouldDockNotebookToBottom', () => {
  it('docks on a mobile app whatever the viewport', () => {
    viewport(1280, 800);
    expect(shouldDockNotebookToBottom(true)).toBe(true);
  });

  it('keeps the side column on a normal landscape desktop window', () => {
    viewport(1440, 900);
    expect(shouldDockNotebookToBottom(false)).toBe(false);
  });

  it('docks when the window is portrait', () => {
    // A tall display: a side column would leave a sliver of text.
    viewport(1080, 1920);
    expect(shouldDockNotebookToBottom(false)).toBe(true);
  });

  it('docks on a square window, where a side column is just as cramped', () => {
    viewport(1000, 1000);
    expect(shouldDockNotebookToBottom(false)).toBe(true);
  });

  it('docks on a narrow window even in landscape', () => {
    viewport(600, 500);
    expect(shouldDockNotebookToBottom(false)).toBe(true);
  });

  it('docks on a short window', () => {
    viewport(1200, 500);
    expect(shouldDockNotebookToBottom(false)).toBe(true);
  });

  it('treats an undefined mobile flag as not-mobile', () => {
    viewport(1440, 900);
    expect(shouldDockNotebookToBottom(undefined)).toBe(false);
  });
});

describe('resolveNotebookDock', () => {
  it('follows the window shape on auto', () => {
    viewport(1440, 900);
    expect(resolveNotebookDock('auto', false)).toBe('side');
    viewport(1080, 1920);
    expect(resolveNotebookDock('auto', false)).toBe('bottom');
  });

  it('honours an explicit choice against the window shape', () => {
    viewport(1080, 1920);
    expect(resolveNotebookDock('side', false)).toBe('side');
    viewport(1440, 900);
    expect(resolveNotebookDock('bottom', false)).toBe('bottom');
  });

  it('keeps a mobile app on the bottom sheet whatever the setting says', () => {
    // A side column is unusable on a phone, so the setting does not apply.
    viewport(1280, 800);
    expect(resolveNotebookDock('side', true)).toBe('bottom');
  });

  it('falls back to auto for an unset value', () => {
    viewport(1440, 900);
    expect(resolveNotebookDock(undefined, false)).toBe('side');
  });
});
