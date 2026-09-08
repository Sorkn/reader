import { DragKey, useDrag } from '@/hooks/useDrag';

interface PanelResizeOptions {
  /**
   * Which edge the panel is anchored to. 'start'/'end' are horizontal (and
   * RTL-aware); 'bottom' resizes height instead, for the docked notebook.
   */
  side: 'start' | 'end' | 'bottom';
  minWidth: number;
  maxWidth: number;
  getWidth: () => string;
  onResize: (width: string) => void;
}

export const usePanelResize = ({
  side,
  minWidth,
  maxWidth,
  getWidth,
  onResize,
}: PanelResizeOptions) => {
  const toPercent = (fraction: number) => `${Math.round(fraction * 10000) / 100}%`;

  const isPhysicallyLeft = () => {
    const isRtl = getComputedStyle(document.documentElement).direction === 'rtl';
    return side === 'start' ? !isRtl : isRtl;
  };

  const isVertical = side === 'bottom';

  const handleDragMove = (data: { clientX: number; clientY: number }) => {
    // A bottom-docked panel grows as the pointer moves up, so the fraction is
    // measured from the bottom edge of the window.
    const fraction = isVertical
      ? 1 - data.clientY / window.innerHeight
      : isPhysicallyLeft()
        ? data.clientX / window.innerWidth
        : 1 - data.clientX / window.innerWidth;
    const newWidth = Math.max(minWidth, Math.min(maxWidth, fraction));
    onResize(toPercent(newWidth));
  };

  const handleDragKeyDown = (data: { key: DragKey; step: number }) => {
    const currentWidth = parseFloat(getWidth()) / 100;
    let newWidth = currentWidth;

    const left = isPhysicallyLeft();
    const growKey: DragKey = isVertical ? 'ArrowUp' : left ? 'ArrowRight' : 'ArrowLeft';
    const shrinkKey: DragKey = isVertical ? 'ArrowDown' : left ? 'ArrowLeft' : 'ArrowRight';

    if (data.key === growKey) {
      newWidth = Math.min(maxWidth, currentWidth + data.step);
    } else if (data.key === shrinkKey) {
      newWidth = Math.max(minWidth, currentWidth - data.step);
    }
    onResize(toPercent(newWidth));
  };

  const { handleDragStart: handleResizeStart, handleDragKeyDown: handleResizeKeyDown } = useDrag(
    handleDragMove,
    handleDragKeyDown,
  );

  return { handleResizeStart, handleResizeKeyDown };
};
