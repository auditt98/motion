import type { PageType } from "@motion/shared";

interface PageIconProps {
  icon: string | null;
  pageType?: PageType;
  size?: "sm" | "md" | "lg";
  className?: string;
}

const sizes = {
  sm: { text: "text-sm", svg: 14 },
  md: { text: "text-base", svg: 16 },
  lg: { text: "text-2xl", svg: 24 },
};

export function PageIcon({ icon, pageType, size = "md", className = "" }: PageIconProps) {
  const { text, svg } = sizes[size];

  if (icon) {
    return <span className={`${text} shrink-0 ${className}`}>{icon}</span>;
  }

  if (pageType === "database") {
    return (
      <svg
        width={svg}
        height={svg}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`shrink-0 ${className}`}
        style={{ color: "var(--color-textSecondary)" }}
      >
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    );
  }

  return (
    <svg
      width={svg}
      height={svg}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 ${className}`}
      style={{ color: "var(--color-textSecondary)" }}
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" />
      <line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" />
      <line x1="10" y1="9" x2="8" y2="9" />
    </svg>
  );
}
