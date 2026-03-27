import { useState, useRef, useEffect } from "react";
import { Button } from "@weave-design-system/react";

export interface OverflowMenuItem {
  icon: React.ReactNode;
  label: string;
  active?: boolean;
  count?: number;
  onClick: () => void;
}

interface OverflowMenuProps {
  items: OverflowMenuItem[];
}

export function OverflowMenu({ items }: OverflowMenuProps) {
  const [open, setOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  return (
    <div ref={menuRef} className="relative">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setOpen((v) => !v)}
        aria-label="More actions"
        style={{ minWidth: "28px", padding: "4px 8px" }}
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
          <circle cx="3" cy="8" r="1.5" />
          <circle cx="8" cy="8" r="1.5" />
          <circle cx="13" cy="8" r="1.5" />
        </svg>
      </Button>
      {open && (
        <div
          className="absolute right-0 top-full mt-1 w-48 rounded-lg shadow-lg py-1"
          style={{
            zIndex: 50,
            background: "var(--color-surface)",
            border: "1px solid var(--color-border)",
          }}
        >
          {items.map((item) => (
            <button
              key={item.label}
              onClick={() => {
                item.onClick();
                setOpen(false);
              }}
              className="w-full text-left px-3 py-2 text-sm flex items-center gap-2.5 transition-colors"
              style={{
                color: item.active
                  ? "var(--color-rust)"
                  : "var(--color-textPrimary)",
                background: item.active
                  ? "var(--color-rustLight)"
                  : "transparent",
              }}
              onMouseEnter={(e) => {
                if (!item.active)
                  (e.currentTarget as HTMLElement).style.background =
                    "var(--color-bg)";
              }}
              onMouseLeave={(e) => {
                if (!item.active)
                  (e.currentTarget as HTMLElement).style.background =
                    "transparent";
              }}
            >
              <span className="shrink-0">{item.icon}</span>
              <span className="flex-1">{item.label}</span>
              {item.count != null && item.count > 0 && (
                <span
                  className="flex items-center justify-center text-xs font-semibold rounded-full"
                  style={{
                    minWidth: "18px",
                    height: "18px",
                    padding: "0 5px",
                    background: "var(--color-rust)",
                    color: "var(--color-white, #fff)",
                    fontSize: "10px",
                  }}
                >
                  {item.count}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
