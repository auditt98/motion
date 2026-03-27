import { useEffect, useRef } from "react";
import { useSwipeGesture } from "@/hooks/useSwipeGesture";

interface DrawerOverlayProps {
  open: boolean;
  onClose: () => void;
  children: React.ReactNode;
}

export function DrawerOverlay({ open, onClose, children }: DrawerOverlayProps) {
  const drawerRef = useRef<HTMLDivElement>(null);

  // Swipe left to close
  useSwipeGesture({ ref: drawerRef, direction: "left", onSwipe: onClose, enabled: open });

  // Close on Escape key
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, onClose]);

  // Prevent body scroll when open
  useEffect(() => {
    if (open) {
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = "";
      };
    }
  }, [open]);

  return (
    <div
      className="fixed inset-0"
      style={{ zIndex: 40, pointerEvents: open ? "auto" : "none" }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 transition-opacity duration-250"
        style={{
          background: "rgba(0, 0, 0, 0.3)",
          opacity: open ? 1 : 0,
        }}
        onClick={onClose}
      />
      {/* Drawer */}
      <div
        ref={drawerRef}
        className="absolute top-0 left-0 h-full transition-transform duration-250 ease-out"
        style={{
          width: "280px",
          maxWidth: "85vw",
          transform: open ? "translateX(0)" : "translateX(-100%)",
        }}
      >
        {children}
      </div>
    </div>
  );
}
