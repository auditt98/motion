import { useEffect } from "react";
import { Button } from "@weave-design-system/react";

interface BottomSheetProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  height?: "half" | "full";
}

export function BottomSheet({
  open,
  onClose,
  title,
  children,
  height = "full",
}: BottomSheetProps) {
  // Close on Escape
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

  const maxHeight = height === "half" ? "60vh" : "90vh";

  return (
    <div
      className="fixed inset-0"
      style={{
        zIndex: 50,
        pointerEvents: open ? "auto" : "none",
      }}
    >
      {/* Backdrop */}
      <div
        className="absolute inset-0 transition-opacity duration-250"
        style={{
          background: "rgba(0, 0, 0, 0.2)",
          opacity: open ? 1 : 0,
        }}
        onClick={onClose}
      />
      {/* Sheet */}
      <div
        className="absolute bottom-0 left-0 right-0 rounded-t-xl flex flex-col transition-transform duration-250 ease-out"
        style={{
          maxHeight,
          transform: open ? "translateY(0)" : "translateY(100%)",
          background: "var(--color-bg)",
          borderTop: "1px solid var(--color-border)",
        }}
      >
        {/* Drag handle */}
        <div className="flex justify-center py-2 shrink-0">
          <div
            className="w-10 h-1 rounded-full"
            style={{ background: "var(--color-border)" }}
          />
        </div>
        {/* Header */}
        <div
          className="flex items-center justify-between px-4 pb-2 shrink-0"
        >
          <h3
            className="font-semibold text-sm"
            style={{ color: "var(--color-textPrimary)" }}
          >
            {title}
          </h3>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M4 4l8 8M12 4l-8 8" />
            </svg>
          </Button>
        </div>
        {/* Content */}
        <div className="flex-1 overflow-y-auto px-4 pb-4">
          {children}
        </div>
      </div>
    </div>
  );
}
