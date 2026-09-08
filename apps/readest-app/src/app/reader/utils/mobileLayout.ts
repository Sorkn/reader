import type { NotebookPosition } from '@/store/notebookStore';

/**
 * True for a mobile app on a tablet or foldable held portrait: wide enough to
 * clear the `sm:` (640px) breakpoint, so CSS sees a desktop-width viewport,
 * while the reader still needs its mobile header and footer bars.
 *
 * Phones (innerWidth < 640) are excluded on purpose — they are already below
 * the breakpoint, and their styling plus the panel slide-down animation must
 * stay exactly as before (#3742 / #3746).
 *
 * Every bar must answer this the same way. While only the footer computed it,
 * the header kept showing its own copies of the footer's TOC and font controls
 * on tablet portrait (#5634, #5652).
 *
 * Reads the viewport at call time and does not subscribe to resize, matching
 * every call site: orientation changes already re-render these components
 * through the inset updates in `useSafeAreaInsets`.
 */
export const isForcedMobileLayout = (isMobileApp?: boolean) =>
  !!isMobileApp && window.innerWidth >= 640 && window.innerWidth <= window.innerHeight;

/**
 * True when the notebook should dock to the bottom of the screen as a sheet
 * rather than open as a side column.
 *
 * A side column costs horizontal room, which is exactly what is scarce on a
 * portrait display: the reading measure collapses to a sliver while plenty of
 * vertical space sits unused. So portrait (and square) windows dock to the
 * bottom, as do small windows and mobile apps, which already did.
 *
 * Reads the viewport at call time and does not subscribe to resize, matching
 * `isForcedMobileLayout` and the components that call it.
 */
export const shouldDockNotebookToBottom = (isMobileApp?: boolean) =>
  !!isMobileApp ||
  window.innerWidth < 640 ||
  window.innerHeight < 640 ||
  window.innerWidth <= window.innerHeight;

/**
 * Which edge the notebook opens against, given the user's setting.
 *
 * A mobile app always gets the bottom sheet: a side column is unusable at that
 * width, so the setting does not apply there. Otherwise an explicit choice
 * wins, and 'auto' falls back to the window shape.
 */
export const resolveNotebookDock = (
  position: NotebookPosition | undefined,
  isMobileApp?: boolean,
): 'side' | 'bottom' => {
  if (isMobileApp) return 'bottom';
  if (position === 'side') return 'side';
  if (position === 'bottom') return 'bottom';
  return shouldDockNotebookToBottom(isMobileApp) ? 'bottom' : 'side';
};
