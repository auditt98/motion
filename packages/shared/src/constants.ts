export const USER_COLORS = [
  "#f87171", // red
  "#fb923c", // orange
  "#fbbf24", // amber
  "#a3e635", // lime
  "#34d399", // emerald
  "#22d3ee", // cyan
  "#60a5fa", // blue
  "#a78bfa", // violet
  "#f472b6", // pink
  "#e879f9", // fuchsia
] as const;

export const AGENT_COLOR = "#8b5cf6"; // purple-500

export const AGENT_CURSOR_ICON = "sparkles";

export const DEFAULT_MODEL = "claude-sonnet-4-6";

export const BLOCK_TYPES = [
  "paragraph",
  "heading",
  "bulletList",
  "orderedList",
  "taskList",
  "toggle",
  "quote",
  "callout",
  "divider",
  "codeBlock",
  "image",
  "video",
  "fileAttachment",
  "embed",
  "table",
  "syncedBlock",
  "columnLayout",
] as const;
