import type { SyncStatus } from "@/hooks/useSyncStatus";

export function SyncStatusIndicator({ status }: { status: SyncStatus }) {
  if (status === "saving") {
    return (
      <div className="flex items-center gap-1.5 text-theme-secondary text-xs">
        <div className="w-3 h-3 border-[1.5px] border-theme rounded-full animate-spin" style={{ borderTopColor: "var(--color-text-secondary)" }} />
        <span>Saving...</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 text-green-600 text-xs sync-status-saved">
      <svg
        width="12"
        height="12"
        viewBox="0 0 12 12"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <path
          d="M2.5 6L5 8.5L9.5 3.5"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <span>Saved</span>
    </div>
  );
}
