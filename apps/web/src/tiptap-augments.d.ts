/**
 * Ensure TipTap extension type augmentations (Commands, ChainedCommands)
 * are loaded even though the extensions are imported via @motion/editor-extensions.
 */
/// <reference types="@tiptap/extension-task-list" />
/// <reference types="@tiptap/extension-task-item" />
/// <reference types="@tiptap/extension-image" />
/// <reference types="@tiptap/extension-table" />
/// <reference types="@tiptap/extension-table-row" />
/// <reference types="@tiptap/extension-table-cell" />
/// <reference types="@tiptap/extension-table-header" />
/// <reference types="@tiptap/extension-highlight" />
/// <reference types="@tiptap/extension-text-style" />
/// <reference types="@tiptap/extension-color" />
/// <reference types="@tiptap/extension-underline" />
/// <reference types="@tiptap/extension-link" />
/// <reference types="@tiptap/extension-code-block-lowlight" />
/// <reference types="@tiptap/extension-typography" />
/// <reference types="@tiptap/starter-kit" />

declare module "markdown-it-task-lists" {
  import type MarkdownIt from "markdown-it";
  interface TaskListsOptions {
    enabled?: boolean;
    label?: boolean;
    labelAfter?: boolean;
  }
  const taskLists: MarkdownIt.PluginWithOptions<TaskListsOptions>;
  export default taskLists;
}
