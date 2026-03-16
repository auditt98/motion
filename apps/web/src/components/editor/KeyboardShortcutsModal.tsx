import { Modal } from "@weave-design-system/react";

interface KeyboardShortcutsModalProps {
  open: boolean;
  onClose: () => void;
}

const isMac =
  typeof navigator !== "undefined" && /Mac|iPod|iPhone|iPad/.test(navigator.platform);

const mod = isMac ? "⌘" : "Ctrl+";
const shift = isMac ? "⇧" : "Shift+";
const alt = isMac ? "⌥" : "Alt+";

const sections = [
  {
    title: "Text Formatting",
    shortcuts: [
      { keys: `${mod}B`, action: "Bold" },
      { keys: `${mod}I`, action: "Italic" },
      { keys: `${mod}U`, action: "Underline" },
      { keys: `${mod}${shift}X`, action: "Strikethrough" },
      { keys: `${mod}E`, action: "Inline code" },
      { keys: `${mod}K`, action: "Add link" },
    ],
  },
  {
    title: "Blocks",
    shortcuts: [
      { keys: "/", action: "Slash command menu" },
      { keys: `${mod}${shift}1`, action: "Heading 1" },
      { keys: `${mod}${shift}2`, action: "Heading 2" },
      { keys: `${mod}${shift}3`, action: "Heading 3" },
      { keys: `${mod}${shift}8`, action: "Bullet list" },
      { keys: `${mod}${shift}9`, action: "Ordered list" },
      { keys: `${mod}${shift}7`, action: "Task list" },
      { keys: `${mod}${shift}B`, action: "Blockquote" },
      { keys: `${mod}${alt}C`, action: "Code block" },
    ],
  },
  {
    title: "Navigation",
    shortcuts: [
      { keys: `${mod}K`, action: "Quick search" },
      { keys: `${mod}/`, action: "This shortcuts panel" },
    ],
  },
];

const kbdStyle: React.CSSProperties = {
  display: "inline-block",
  padding: "2px 6px",
  fontSize: "12px",
  fontFamily: "'JetBrains Mono', monospace",
  lineHeight: "1.4",
  borderRadius: "4px",
  border: "1px solid var(--color-border)",
  background: "var(--color-surface)",
  color: "var(--color-textPrimary)",
  minWidth: "24px",
  textAlign: "center",
};

export function KeyboardShortcutsModal({ open, onClose }: KeyboardShortcutsModalProps) {
  return (
    <Modal open={open} onClose={onClose}>
      <Modal.Header onClose={onClose}>
        <h2 className="text-base font-semibold" style={{ color: "var(--color-textPrimary)" }}>
          Keyboard Shortcuts
        </h2>
      </Modal.Header>
      <Modal.Body>
        <div className="space-y-5">
          {sections.map((section) => (
            <div key={section.title}>
              <h3
                className="text-xs font-semibold uppercase tracking-wider mb-2"
                style={{ color: "var(--color-textSecondary)" }}
              >
                {section.title}
              </h3>
              <div className="space-y-1">
                {section.shortcuts.map((shortcut) => (
                  <div
                    key={shortcut.action}
                    className="flex items-center justify-between py-1.5 px-2 rounded"
                    style={{ color: "var(--color-textPrimary)" }}
                  >
                    <span className="text-sm">{shortcut.action}</span>
                    <kbd style={kbdStyle}>{shortcut.keys}</kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </Modal.Body>
    </Modal>
  );
}
