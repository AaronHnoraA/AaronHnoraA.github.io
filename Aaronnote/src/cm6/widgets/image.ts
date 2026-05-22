/**
 * Phase 6 — Image widget for the CM6 kernel.
 *
 * Lezer node: Image (same children as Link but with leading `!`)
 *
 * Behavior:
 *   cursor OUTSIDE Image node → Decoration.replace with <img> widget
 *   cursor INSIDE  Image node → source stays editable; live-preview
 *                               already folds [ ] and (url) to syntax-hint
 *
 * The src is extracted with a regex from the raw node text so we don't
 * depend on a specific Lezer child node layout (which varies between
 * @lezer/markdown versions).
 */

import {
  Decoration,
  EditorView,
  ViewPlugin,
  WidgetType,
  type DecorationSet,
  type ViewUpdate,
} from "@codemirror/view";
import { syntaxTree } from "@codemirror/language";
import type { Range } from "@codemirror/state";
import { getBlockMathRanges, rangeInsideAny } from "../math-ranges.ts";
import { applyImageLayout, imageLayoutFromAttrs, readImageTrailingAttrs, type ImageLayoutAttrs } from "../../image-attrs.ts";

declare global {
  interface Window {
    AaronnoteResolveAssetUrl?: (src: string) => string;
  }
}

function setSourceRange(el: HTMLElement, from: number, to: number): void {
  el.dataset.cmSourceFrom = String(from);
  el.dataset.cmSourceTo = String(to);
  el.dataset.cmSourceAnchor = String(Math.min(to, from + 1));
  el.dataset.cmOpenSource = "true";
}

function resolveImageSrc(src: string): string {
  const raw = String(src || "").trim();
  if (!raw) return raw;
  return window.AaronnoteResolveAssetUrl?.(raw) ?? raw;
}

// ---------------------------------------------------------------------------
// Widget
// ---------------------------------------------------------------------------

class ImageWidget extends WidgetType {
  src: string;
  alt: string;
  from: number;
  to: number;
  layout: ImageLayoutAttrs;

  constructor(src: string, alt: string, from: number, to: number, layout: ImageLayoutAttrs) {
    super();
    this.src = src;
    this.alt = alt;
    this.from = from;
    this.to = to;
    this.layout = layout;
  }

  eq(other: ImageWidget): boolean {
    return this.src === other.src &&
      this.alt === other.alt &&
      this.from === other.from &&
      this.to === other.to &&
      this.layout.align === other.layout.align &&
      this.layout.wrap === other.layout.wrap &&
      this.layout.width === other.layout.width &&
      this.layout.height === other.layout.height;
  }

  toDOM(): HTMLElement {
    const wrap = document.createElement("figure");
    wrap.className = "cm-image-widget";
    setSourceRange(wrap, this.from, this.to);
    applyImageLayout(wrap, this.layout);

    if (this.src) {
      const img = document.createElement("img");
      img.src = resolveImageSrc(this.src);
      img.alt = this.alt;
      img.className = "cm-image-render";
      img.loading = "lazy";
      img.decoding = "async";
      img.onerror = () => {
        wrap.classList.add("cm-image-broken");
        wrap.title = `Image not found: ${this.src}`;
      };
      wrap.append(img);
    } else {
      wrap.classList.add("cm-image-broken");
      wrap.textContent = this.alt || "image";
    }
    if (this.alt.trim()) {
      const caption = document.createElement("figcaption");
      caption.className = "cm-image-caption";
      caption.textContent = this.alt.trim();
      wrap.append(caption);
    }
    return wrap;
  }

  ignoreEvent(): boolean { return false; }
}

// ---------------------------------------------------------------------------
// Decoration builder
// ---------------------------------------------------------------------------

// Extracts alt and src from the raw Image markdown text (![alt](src "title"))
const IMAGE_RE = /^!\[([^\]]*)\]\(([^)]*)\)/;

function buildImageDecorations(view: EditorView): DecorationSet {
  const decos: Range<Decoration>[] = [];
  const sel = view.state.selection.main;
  const doc = view.state.doc;
  const blockMathRanges = getBlockMathRanges(view.state);

  for (const { from: vFrom, to: vTo } of view.visibleRanges) {
    syntaxTree(view.state).iterate({
      from: vFrom,
      to: vTo,
      enter(node) {
        if (rangeInsideAny(node.from, node.to, blockMathRanges)) return false;
        if (node.name !== "Image") return;
        const line = doc.lineAt(node.to);
        const trailing = readImageTrailingAttrs(doc.sliceString(node.to, line.to), 0);
        const fullTo = trailing ? node.to + trailing.to : node.to;
        const cursorInside = sel.from <= fullTo && sel.to >= node.from;
        if (cursorInside) return false; // editable source

        const raw = doc.sliceString(node.from, node.to);
        const m = raw.match(IMAGE_RE);
        const alt = m?.[1] ?? "";
        // src may include optional title; strip the title part and trim
        const srcFull = m?.[2] ?? "";
        const src = srcFull.replace(/\s+"[^"]*"\s*$/, "").replace(/\s+'[^']*'\s*$/, "").trim();
        const layout = imageLayoutFromAttrs(trailing?.attrs ?? {});

        decos.push(
          Decoration.replace({
            widget: new ImageWidget(src, alt, node.from, fullTo, layout),
          }).range(node.from, fullTo),
        );
        return false;
      },
    });
  }

  decos.sort((a, b) => a.from - b.from || a.to - b.to);
  return Decoration.set(decos, true);
}

// ---------------------------------------------------------------------------
// ViewPlugin export
// ---------------------------------------------------------------------------

class ImagePlugin {
  decorations: DecorationSet;

  constructor(view: EditorView) {
    this.decorations = buildImageDecorations(view);
  }

  update(update: ViewUpdate): void {
    if (update.view.compositionStarted && update.selectionSet && !update.docChanged && !update.viewportChanged) return;
    if (update.docChanged || update.viewportChanged || update.selectionSet) {
      this.decorations = buildImageDecorations(update.view);
    }
  }
}

export const imageExtension = ViewPlugin.fromClass(ImagePlugin, {
  decorations: (v) => v.decorations,
});
