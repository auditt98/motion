import { useNavigate } from "react-router";
import { StateView } from "@/components/shared/StateView";

export function AccessDeniedPage() {
  const navigate = useNavigate();

  return (
    <StateView
      tone="rust"
      icon={
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 0 1 10 0v4" />
        </svg>
      }
      title="You don't have access to this page"
      description="Ask the page owner or a workspace admin to grant you access."
      action={{ label: "Go to dashboard", onClick: () => navigate("/") }}
    />
  );
}
