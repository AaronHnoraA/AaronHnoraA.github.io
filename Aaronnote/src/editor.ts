import type { Node as PMNode } from "prosemirror-model";
import { EditorState, Plugin } from "prosemirror-state";
import { keymap } from "prosemirror-keymap";
import { baseKeymap } from "prosemirror-commands";
import { history, undo, redo } from "prosemirror-history";

import { cursorRenderPlugin } from "./cursor-render.ts";
import { syntaxHintsPlugin } from "./decorations.ts";
import { collectKeymaps, collectPlugins } from "./features/index.ts";
import { markdownInputRules, spaceBreaksStoredMarks } from "./input-rules.ts";
import { normalizeInlinePlugin } from "./normalize.ts";
import { schema } from "./schema.ts";

declare global {
  interface Window {
    AaronnoteResolveAssetUrl?: (src: string) => string;
  }
}

function hrefProtocol(href: string): string | null {
  const match = href.match(/^([A-Za-z][\w+.-]*):/);
  return match?.[1]?.toLowerCase() ?? null;
}

function externalProtocolHref(href: string): boolean {
  const protocol = hrefProtocol(href);
  return protocol != null && !["http", "https", "mailto"].includes(protocol);
}

function internalNoteHref(href: string): boolean {
  const raw = href.trim();
  if (!raw || raw.startsWith("#")) return false;
  if (hrefProtocol(raw)) return false;
  const path = raw.split(/[?#]/, 1)[0] ?? "";
  return /\.(?:md|markdown)$/i.test(path);
}

function followsOnPlainClick(href: string): boolean {
  const protocol = hrefProtocol(href);
  if (/^roam:\/\//i.test(href)) return true;
  if (protocol && !["http", "https", "mailto"].includes(protocol)) return true;
  return internalNoteHref(href);
}

function openExternalHref(href: string, options: { newWindow?: boolean } = {}): void {
  const appHref = /^roam:\/\//i.test(href) || internalNoteHref(href) || externalProtocolHref(href);
  const resolvedHref = appHref ? href : window.AaronnoteResolveAssetUrl?.(href) ?? href;
  const event = new CustomEvent("aaronnote:open-url", {
    bubbles: true,
    cancelable: true,
    detail: { href: resolvedHref, newWindow: options.newWindow === true },
  });
  if (document.dispatchEvent(event) && externalProtocolHref(resolvedHref)) {
    window.location.href = resolvedHref;
    return;
  }
  if (!event.defaultPrevented) {
    window.open(resolvedHref, "_blank", "noopener,noreferrer");
  }
}

// Open external web links on Cmd/Ctrl+click. Note links and app/protocol
// links are commands in the note surface, so a plain click should follow
// them instead of requiring source-mode style editing.
function openLinkOnModClickPlugin(): Plugin {
  return new Plugin({
    props: {
      handleClick(_view, _pos, event) {
        const a = (event.target as Element | null)?.closest("a");
        if (!a) return false;
        const href = a.getAttribute("href");
        if (!href) return false;
        const isMac = /Mac|iPhone|iPad/.test(navigator.platform);
        const mod = isMac ? event.metaKey : event.ctrlKey;
        if (!followsOnPlainClick(href) && !mod) return false;
        event.preventDefault();
        openExternalHref(href, { newWindow: event.altKey || event.metaKey });
        return true;
      },
    },
  });
}

export function defaultPlugins(options: { cursorWidget?: boolean } = {}): Plugin[] {
  // cursorRenderPlugin paints a visible caret even when the view is not
  // focused — only useful for the replay harness (fakeView has no focus).
  // A real browser editor already draws its own caret, so a live editor
  // should pass `{ cursorWidget: false }`.
  const { cursorWidget = true } = options;
  const featureKeymap = collectKeymaps(schema);
  const plugins: Plugin[] = [
    history(),
    keymap({ "Mod-z": undo, "Mod-y": redo, "Mod-Shift-z": redo }),
    markdownInputRules(),
    spaceBreaksStoredMarks(),
    normalizeInlinePlugin(),
    // Feature-contributed plugins sit after normalize (so block-draft
    // watchers see the post-normalize doc) and before syntaxHints (so any
    // extra decorations merge into PM's decoration pipeline naturally).
    ...collectPlugins(schema),
    syntaxHintsPlugin(),
    openLinkOnModClickPlugin(),
  ];
  if (cursorWidget) plugins.push(cursorRenderPlugin());
  // Feature keymap wins over baseKeymap — features that override Enter /
  // Backspace for block exits rely on this ordering.
  if (Object.keys(featureKeymap).length > 0) plugins.push(keymap(featureKeymap));
  plugins.push(keymap(baseKeymap));
  return plugins;
}

export function createState(doc: PMNode): EditorState {
  return EditorState.create({ schema, doc, plugins: defaultPlugins() });
}
