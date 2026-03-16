import { Extension } from "@tiptap/react";
import { PluginKey } from "@tiptap/pm/state";
import Suggestion, { type SuggestionProps } from "@tiptap/suggestion";
import { createRoot, type Root } from "react-dom/client";
import { createElement, createRef } from "react";
import {
  SlashCommandMenu,
  type SlashCommandMenuRef,
} from "./SlashCommandMenu";
import { filterCommands, type SlashCommand } from "./commands";

const slashCommandPluginKey = new PluginKey("slashCommand");

export const SlashCommandExtension = Extension.create({
  name: "slashCommand",

  addProseMirrorPlugins() {
    const editor = this.editor;

    return [
      Suggestion<SlashCommand>({
        editor,
        char: "/",
        pluginKey: slashCommandPluginKey,
        allowSpaces: false,
        startOfLine: false,

        items: ({ query }: { query: string }) => filterCommands(query),

        command: ({ editor: e, range, props: item }) => {
          item.action(e, range);
        },

        render: () => {
          let container: HTMLDivElement | null = null;
          let root: Root | null = null;
          const menuRef = createRef<SlashCommandMenuRef>();

          function renderMenu(props: SuggestionProps<SlashCommand>) {
            root?.render(
              createElement(SlashCommandMenu, {
                ref: menuRef,
                items: props.items,
                command: (item: SlashCommand) => props.command(item),
              }),
            );
          }

          return {
            onStart(props: SuggestionProps<SlashCommand>) {
              container = document.createElement("div");
              container.style.position = "absolute";
              container.style.zIndex = "50";
              document.body.appendChild(container);

              root = createRoot(container);
              renderMenu(props);
              updatePosition(container, props.clientRect);
            },

            onUpdate(props: SuggestionProps<SlashCommand>) {
              renderMenu(props);
              updatePosition(container, props.clientRect);
            },

            onKeyDown(props: { event: KeyboardEvent }) {
              if (props.event.key === "Escape") {
                cleanup();
                return true;
              }
              return menuRef.current?.onKeyDown(props.event) ?? false;
            },

            onExit() {
              cleanup();
            },
          };

          function cleanup() {
            root?.unmount();
            root = null;
            container?.remove();
            container = null;
          }
        },
      }),
    ];
  },
});

function updatePosition(
  container: HTMLDivElement | null,
  clientRect: (() => DOMRect | null) | null | undefined,
) {
  if (!container || !clientRect) return;

  const rect = typeof clientRect === "function" ? clientRect() : clientRect;
  if (!rect) return;

  container.style.left = `${rect.left}px`;
  container.style.top = `${rect.bottom + 4}px`;
}
