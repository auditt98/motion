import type { ReactNode } from "react";
import { Button } from "@weave-design-system/react";

type Tone = "neutral" | "rust" | "gold" | "teal" | "forest";

interface StateViewProps {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: { label: string; onClick: () => void };
  tone?: Tone;
}

/**
 * Warm-editorial empty / error / no-access state: a tinted icon medallion, a
 * Fraunces display title, a secondary description, and an optional action.
 * Matches the Pencil "States" panels. Fills its parent and centers.
 */
export function StateView({ icon, title, description, action, tone = "neutral" }: StateViewProps) {
  const color = tone === "neutral" ? "var(--color-textSecondary)" : `var(--color-${tone})`;
  return (
    <div className="flex-1 flex items-center justify-center" style={{ background: "var(--color-bg)", padding: 24 }}>
      <div className="flex flex-col items-center text-center" style={{ gap: 14, maxWidth: 380 }}>
        <span
          className="flex items-center justify-center"
          style={{ width: 56, height: 56, borderRadius: 999, background: `color-mix(in srgb, ${color} 14%, var(--color-surface))`, color }}
        >
          {icon}
        </span>
        <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 500, fontSize: 22, lineHeight: 1.2, color: "var(--color-textPrimary)" }}>
          {title}
        </h1>
        {description && (
          <p className="text-sm" style={{ color: "var(--color-textSecondary)", lineHeight: 1.5 }}>
            {description}
          </p>
        )}
        {action && (
          <div style={{ marginTop: 2 }}>
            <Button variant="ghost" size="sm" onClick={action.onClick}>{action.label}</Button>
          </div>
        )}
      </div>
    </div>
  );
}
