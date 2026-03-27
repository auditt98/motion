import { useNavigate } from "react-router";
import { Button } from "@weave-design-system/react";

export function AccessDeniedPage() {
  const navigate = useNavigate();

  return (
    <div
      className="flex-1 flex items-center justify-center"
      style={{ background: "var(--color-bg)" }}
    >
      <div className="text-center space-y-4">
        <svg
          width="48"
          height="48"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          className="mx-auto"
          style={{ color: "var(--color-text-secondary)" }}
        >
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
        <h1
          className="text-lg font-medium"
          style={{ color: "var(--color-text-primary)" }}
        >
          You don't have access to this page
        </h1>
        <p
          className="text-sm"
          style={{ color: "var(--color-text-secondary)" }}
        >
          Ask the page owner or a workspace admin to grant you access.
        </p>
        <Button variant="ghost" size="sm" onClick={() => navigate("/")}>
          Go to dashboard
        </Button>
      </div>
    </div>
  );
}
