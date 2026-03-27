import { useState, useCallback } from "react";
import { Button, Tooltip } from "@weave-design-system/react";
import type { PageVersion } from "@motion/shared";

function formatRelativeTime(dateStr: string): string {
  const now = Date.now();
  const date = new Date(dateStr).getTime();
  const diff = now - date;

  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function triggerLabel(type: string): string {
  switch (type) {
    case "auto":
      return "Auto";
    case "session_end":
      return "Session";
    case "pre_restore":
      return "Pre-restore";
    case "manual":
      return "Published";
    default:
      return type;
  }
}

interface VersionHistoryProps {
  versions: PageVersion[];
  selectedVersionId: string | null;
  onSelectVersion: (version: PageVersion) => void;
  onRestoreVersion: (version: PageVersion) => void;
  onLabelVersion: (versionId: string, label: string | null) => void;
  onSaveVersion: () => void;
  onClose: () => void;
}

export function VersionHistory({
  versions,
  selectedVersionId,
  onSelectVersion,
  onRestoreVersion,
  onLabelVersion,
  onSaveVersion,
  onClose,
}: VersionHistoryProps) {
  const [editingLabelId, setEditingLabelId] = useState<string | null>(null);
  const [labelValue, setLabelValue] = useState("");

  const handleLabelSubmit = useCallback(
    (versionId: string) => {
      onLabelVersion(versionId, labelValue || null);
      setEditingLabelId(null);
      setLabelValue("");
    },
    [onLabelVersion, labelValue],
  );

  return (
    <div className="version-sidebar">
      <div className="version-sidebar-header">
        <span className="text-sm font-semibold text-theme-primary">Revisions</span>
        <div className="flex items-center gap-1">
          <Tooltip content="Save a named snapshot">
            <Button variant="outline" size="sm" onClick={onSaveVersion}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M7 1v8M3.5 5.5L7 2l3.5 3.5M2 11h10" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Publish
            </Button>
          </Tooltip>
          <Tooltip content="Close">
            <Button variant="ghost" size="sm" onClick={onClose}>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M3 3l8 8M11 3l-8 8" stroke="currentColor" strokeWidth="1.2" />
              </svg>
            </Button>
          </Tooltip>
        </div>
      </div>

      <div className="version-list">
        {versions.length === 0 ? (
          <div className="version-empty">
            No revisions yet. Click <strong>Publish</strong> above to save one.
          </div>
        ) : (
          versions.map((version) => {
            const isSelected = selectedVersionId === version.id;
            return (
              <div
                key={version.id}
                className={`version-item ${isSelected ? "active" : ""}`}
                onClick={() => onSelectVersion(version)}
              >
                <div className="version-item-row">
                  <span className="version-item-time">
                    {formatRelativeTime(version.created_at)}
                  </span>
                  {(version.trigger_type === "manual" || version.trigger_type === "pre_restore") && (
                    <span className="version-item-trigger">
                      {triggerLabel(version.trigger_type)}
                    </span>
                  )}
                </div>

                {editingLabelId === version.id ? (
                  <input
                    className="version-item-label-input"
                    type="text"
                    value={labelValue}
                    onChange={(e) => setLabelValue(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") handleLabelSubmit(version.id);
                      if (e.key === "Escape") setEditingLabelId(null);
                    }}
                    onBlur={() => handleLabelSubmit(version.id)}
                    onClick={(e) => e.stopPropagation()}
                    placeholder="Add a label..."
                    autoFocus
                  />
                ) : version.label ? (
                  <div
                    className="version-item-label"
                    onClick={(e) => {
                      e.stopPropagation();
                      setEditingLabelId(version.id);
                      setLabelValue(version.label || "");
                    }}
                  >
                    {version.label}
                  </div>
                ) : null}

                <div className="version-item-row">
                  <span className="version-item-author">
                    {version.actor_type === "agent" && "✦ "}
                    {version.created_by_name || (version.trigger_type === "auto" || version.trigger_type === "session_end" ? "Auto-saved" : "")}
                  </span>
                  <div className="version-item-actions">
                    {!version.label && (
                      <button
                        className="version-item-action"
                        onClick={(e) => {
                          e.stopPropagation();
                          setEditingLabelId(version.id);
                          setLabelValue("");
                        }}
                        type="button"
                      >
                        <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 2.5v7M2.5 6h7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/></svg>
                        Label
                      </button>
                    )}
                    <button
                      className="version-item-restore"
                      onClick={(e) => {
                        e.stopPropagation();
                        onRestoreVersion(version);
                      }}
                      type="button"
                    >
                      Restore
                    </button>
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
