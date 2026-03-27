import { useEffect, type RefObject } from "react";

interface UseSwipeGestureOptions {
  ref: RefObject<HTMLElement | null>;
  direction: "left" | "right" | "down" | "up";
  onSwipe: () => void;
  threshold?: number;
  enabled?: boolean;
}

export function useSwipeGesture({
  ref,
  direction,
  onSwipe,
  threshold = 50,
  enabled = true,
}: UseSwipeGestureOptions) {
  useEffect(() => {
    const el = ref.current;
    if (!el || !enabled) return;

    let startX = 0;
    let startY = 0;

    function onTouchStart(e: TouchEvent) {
      const touch = e.touches[0];
      startX = touch.clientX;
      startY = touch.clientY;
    }

    function onTouchEnd(e: TouchEvent) {
      const touch = e.changedTouches[0];
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;

      const isHorizontal = Math.abs(dx) > Math.abs(dy);

      switch (direction) {
        case "left":
          if (isHorizontal && dx < -threshold) onSwipe();
          break;
        case "right":
          if (isHorizontal && dx > threshold) onSwipe();
          break;
        case "down":
          if (!isHorizontal && dy > threshold) onSwipe();
          break;
        case "up":
          if (!isHorizontal && dy < -threshold) onSwipe();
          break;
      }
    }

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchend", onTouchEnd);
    };
  }, [ref, direction, onSwipe, threshold, enabled]);
}
