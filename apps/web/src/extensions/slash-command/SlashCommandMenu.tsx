import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
  useCallback,
} from "react";
import type { SlashCommand } from "./commands";

export interface SlashCommandMenuRef {
  onKeyDown: (event: KeyboardEvent) => boolean;
}

interface SlashCommandMenuProps {
  items: SlashCommand[];
  command: (item: SlashCommand) => void;
}

export const SlashCommandMenu = forwardRef<
  SlashCommandMenuRef,
  SlashCommandMenuProps
>(({ items, command }, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  useEffect(() => {
    setSelectedIndex(0);
  }, [items]);

  const selectItem = useCallback(
    (index: number) => {
      const item = items[index];
      if (item) command(item);
    },
    [items, command],
  );

  useImperativeHandle(ref, () => ({
    onKeyDown: (event: KeyboardEvent) => {
      if (event.key === "ArrowUp") {
        setSelectedIndex((i) => (i + items.length - 1) % items.length);
        return true;
      }
      if (event.key === "ArrowDown") {
        setSelectedIndex((i) => (i + 1) % items.length);
        return true;
      }
      if (event.key === "Enter") {
        selectItem(selectedIndex);
        return true;
      }
      return false;
    },
  }));

  if (items.length === 0) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg shadow-lg p-3 text-sm text-gray-500">
        No results
      </div>
    );
  }

  // Group items
  const groups: Record<string, { items: SlashCommand[]; startIndex: number }> =
    {};
  let idx = 0;
  for (const item of items) {
    if (!groups[item.group]) {
      groups[item.group] = { items: [], startIndex: idx };
    }
    groups[item.group].items.push(item);
    idx++;
  }

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-lg py-1 max-h-80 overflow-y-auto w-56">
      {Object.entries(groups).map(([groupName, group]) => (
        <div key={groupName}>
          <div className="px-3 py-1.5 text-xs font-medium text-gray-400 uppercase tracking-wide">
            {groupName}
          </div>
          {group.items.map((item, i) => {
            const flatIndex = group.startIndex + i;
            return (
              <button
                key={item.title}
                className={`w-full text-left px-3 py-1.5 flex items-center gap-3 text-sm transition-colors ${
                  flatIndex === selectedIndex
                    ? "bg-gray-100 text-gray-900"
                    : "text-gray-700 hover:bg-gray-50"
                }`}
                onClick={() => selectItem(flatIndex)}
                onMouseEnter={() => setSelectedIndex(flatIndex)}
              >
                <span className="w-6 text-center text-base shrink-0">
                  {item.icon}
                </span>
                <div className="min-w-0">
                  <div className="font-medium truncate">{item.title}</div>
                  <div className="text-xs text-gray-400 truncate">
                    {item.description}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      ))}
    </div>
  );
});

SlashCommandMenu.displayName = "SlashCommandMenu";
