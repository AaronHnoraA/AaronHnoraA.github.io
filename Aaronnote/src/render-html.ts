import type { Node as PMNode } from "prosemirror-model";
import { EditorState, TextSelection } from "prosemirror-state";
import { EditorView } from "prosemirror-view";

import { defaultPlugins } from "./editor.ts";
import { cleanEditorHTML } from "./export-html.ts";
import { parse } from "./parser.ts";
import { schema } from "./schema.ts";

export type RenderMarkdownHTMLOptions = {
  assetResolver?: (src: string) => string;
};

declare global {
  interface Window {
    AaronnoteResolveAssetUrl?: (src: string) => string;
  }
}

function exportSelectionPos(doc: PMNode): number {
  let paragraphPos: number | null = null;
  doc.descendants((node, pos) => {
    if (paragraphPos != null) return false;
    if (node.type.name === "paragraph" && node.textContent.trim().length === 0) {
      paragraphPos = pos + 1;
      return false;
    }
    if (node.type.name === "paragraph") paragraphPos = pos + 1;
    return paragraphPos == null;
  });
  return Math.max(0, Math.min(paragraphPos ?? doc.content.size, doc.content.size));
}

export function renderMarkdownHTML(
  markdown: string,
  options: RenderMarkdownHTMLOptions = {},
): string {
  const doc = markdown ? parse(markdown) : schema.nodes.doc.createAndFill()!;
  const mount = document.createElement("div");
  mount.style.position = "fixed";
  mount.style.left = "-10000px";
  mount.style.top = "0";
  mount.style.width = "960px";
  mount.style.visibility = "hidden";
  mount.style.pointerEvents = "none";
  document.body.appendChild(mount);

  const previousAssetResolver = window.AaronnoteResolveAssetUrl;
  if (options.assetResolver) window.AaronnoteResolveAssetUrl = options.assetResolver;

  let view: EditorView | null = null;
  try {
    const base = EditorState.create({
      schema,
      doc,
      plugins: [...defaultPlugins({ cursorWidget: false })],
    });
    const pos = exportSelectionPos(base.doc);
    const state = base.apply(
      base.tr.setSelection(TextSelection.near(base.doc.resolve(pos), 1)),
    );
    view = new EditorView(mount, { state });
    return cleanEditorHTML(view.dom);
  } finally {
    view?.destroy();
    mount.remove();
    window.AaronnoteResolveAssetUrl = previousAssetResolver;
  }
}
