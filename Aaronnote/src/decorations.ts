// Cursor-aware syntax hints — Typora's signature visual: when the cursor sits
// inside a mark range, show the source delimiters (*, **, `, ~~, [, ]) as a
// gray hint; when it leaves, hide them.
//
// Every inline feature (em/strong/code/strike/link) follows method-B: the
// delim chars live in the textblock text and `normalize` derives the marks.
// This plugin just reads normalize's delim ranges and wraps each in an
// inline Decoration whose class tells the stylesheet (and test-pretty)
// whether to show it gray (cursor inside the surrounding span) or hide it
// (cursor outside).

import { Plugin, PluginKey, type EditorState } from "prosemirror-state";
import { Decoration, DecorationSet, type EditorView } from "prosemirror-view";

import { renderMathLazy } from "./math-render.ts";
import { getDelims, getExtras, getWidgets, type WidgetDecoration } from "./normalize.ts";

declare global {
  interface Window {
    AaronnoteResolveAssetUrl?: (src: string) => string;
  }
}

function resolveAssetUrl(src: string): string {
  return window.AaronnoteResolveAssetUrl?.(src) ?? src;
}

// Widget builders — keyed by `kind`. A widget renders as a DOM element
// at a specific position; decorations.ts decides whether to emit it based
// on the cursor's relation to the parent span.
const widgetBuilders: Record<string, (attrs: Record<string, string>) => HTMLElement> = {
  "math-render": (attrs) => {
    const display = attrs.display === "1";
    const tex = attrs.tex ?? "";
    const el = document.createElement("span");
    el.className = display ? "aaronnote-math-block" : "aaronnote-math-inline";
    el.setAttribute("data-tex", tex);
    el.setAttribute("contenteditable", "false");
    el.textContent = tex;
    renderMathLazy(tex, el, {
      displayMode: display,
      throwOnError: false,
      strict: false,
      trust: false,
      output: "html",
    }, () => {
      el.classList.add("aaronnote-math-error");
      el.textContent = display ? `$$ ${tex} $$` : `$${tex}$`;
    });
    return el;
  },
  "image-icon": (attrs) => {
    const el = document.createElement("span");
    el.className = attrs.broken ? "image-icon broken" : "image-icon";
    return el;
  },
  emoji: (attrs) => {
    // Glyph rendered at the span's start, before the (often-hidden)
    // `:name:` source chars. textContent is the unicode glyph; nothing
    // fancy — emoji rendering is a font/system concern, not ours.
    // `data-len` carries the source length (`:name:` chars) so the
    // emoji feature's click handler can set the cursor to the tail.
    const el = document.createElement("span");
    el.className = "emoji-glyph";
    el.textContent = attrs.glyph ?? "";
    if (attrs.len) el.setAttribute("data-len", attrs.len);
    return el;
  },
  "image-render": (attrs) => {
    const img = document.createElement("img");
    img.className = "image-render";
    if (attrs.src) img.setAttribute("src", resolveAssetUrl(attrs.src));
    if (attrs.alt) img.setAttribute("alt", attrs.alt);
    if (attrs.title) img.setAttribute("title", attrs.title);
    return img;
  },
  checkbox: (attrs) => {
    // Task-list checkbox. data-checked stamped so test-pretty can
    // surface state and so the click handler in the task feature can
    // toggle it via its own DOM event listener (we don't take
    // visible margin from the source — the gap between checkbox and
    // text comes from `.checkbox` margin-right CSS).
    const el = document.createElement("span");
    el.className = "checkbox";
    el.setAttribute("data-checked", attrs.checked === "1" ? "1" : "0");
    return el;
  },
  "file-input": (attrs) => {
    // Wrapping element: PM marks widgets contenteditable=false but a real
    // <input type="file"> still misbehaves inside contenteditable (focus
    // tug-of-war with the surrounding editable area, observed as input
    // hangs in Chromium). We render a non-editable <span> trigger that
    // lazily spawns a detached <input> on click.
    const el = document.createElement("span");
    el.className = "file-input";
    el.setAttribute("contenteditable", "false");
    el.textContent = "📎";
    el.addEventListener("mousedown", (e) => {
      // Prevent focus from leaving the editor.
      e.preventDefault();
    });
    el.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const input = document.createElement("input");
      input.type = "file";
      if (attrs.accept) input.accept = attrs.accept;
      input.style.display = "none";
      input.addEventListener("change", () => {
        // Bubble up via a synthetic CustomEvent on the trigger so the
        // image plugin (which delegates from the editor root) can pick
        // it up uniformly with the input's own `change`.
        el.dispatchEvent(
          new CustomEvent("file-input-pick", {
            bubbles: true,
            detail: { files: input.files },
          }),
        );
        document.body.removeChild(input);
      });
      document.body.appendChild(input);
      input.click();
    });
    return el;
  },
};

function buildWidget(w: WidgetDecoration): HTMLElement {
  const builder = widgetBuilders[w.kind];
  const el = builder
    ? builder(w.attrs ?? {})
    : (() => {
        const span = document.createElement("span");
        span.className = w.kind;
        return span;
      })();
  // Make sure PM/browser don't treat the widget DOM as editable content
  // (otherwise typing near a widget can land in the widget's textContent
  // instead of the doc, which we observed as a hang while typing inside
  // an image span).
  el.setAttribute("contenteditable", "false");
  el.setAttribute("data-pos", String(w.pos));
  return el;
}

function buildWidgetLazy(w: WidgetDecoration): (view: EditorView, getPos: () => number | undefined) => HTMLElement {
  return (_view, getPos) => {
    const el = buildWidget(w);
    const pos = getPos();
    if (typeof pos === "number") el.setAttribute("data-pos", String(pos));
    return el;
  };
}

function buildDecorationSet(state: EditorState): DecorationSet {
  const decos: Decoration[] = [];
  const cursor = state.selection.empty ? state.selection.from : null;
  for (const d of getDelims(state)) {
    const cursorInside =
      cursor !== null && cursor >= d.spanFrom && cursor <= d.spanTo;
    const cursorInsideMath =
      cursor !== null && cursor > d.spanFrom && cursor < d.spanTo;
    if (d.forceHidden) {
      decos.push(
        Decoration.inline(d.from, d.to, {
          class: d.className ?? "syntax-hidden",
        }),
      );
      continue;
    }
    if (d.softInside) {
      // Soft range: hidden when cursor outside, plain (no decoration)
      // when cursor inside so the chars render as ordinary text.
      const inside = d.className === "math-source-hidden" ? cursorInsideMath : cursorInside;
      if (!inside) {
        decos.push(Decoration.inline(d.from, d.to, { class: d.className ?? "syntax-hidden" }));
      }
      continue;
    }
    const visible = d.forceVisible || cursorInside;
    const cls = visible ? "syntax-hint" : "syntax-hidden";
    decos.push(Decoration.inline(d.from, d.to, { class: cls }));
  }
  for (const ex of getExtras(state)) {
    decos.push(
      Decoration.inline(ex.from, ex.to, { nodeName: ex.nodeName, ...(ex.attrs ?? {}) }),
    );
  }
  for (const w of getWidgets(state)) {
    const cursorInsideSpan =
      cursor !== null && cursor >= w.spanFrom && cursor <= w.spanTo;
    const cursorInsideMathSpan =
      cursor !== null && cursor > w.spanFrom && cursor < w.spanTo;
    const inside = w.kind === "math-render" && w.attrs?.display === "1"
      ? cursorInsideMathSpan
      : cursorInsideSpan;
    if (w.when === "inside" && !inside) continue;
    if (w.when === "outside" && inside) continue;
    decos.push(
      Decoration.widget(w.pos, buildWidgetLazy(w), {
        side: w.side ?? -1,
        key: `${w.kind}@${w.pos}:${JSON.stringify(w.attrs ?? {})}`,
        ignoreSelection: true,
        // PM should not forward DOM events bubbled out of the widget
        // back as editor input — otherwise input/keydown fired around
        // the widget mount can land in handleTextInput and re-trigger
        // our own auto-pair / normalize work, which we observed looping
        // when an image span first appears mid-typing.
        stopEvent: (e: Event) => e.type !== "click",
      }),
    );
  }
  return decos.length > 0 ? DecorationSet.create(state.doc, decos) : DecorationSet.empty;
}

const syntaxHintsKey = new PluginKey<DecorationSet>("syntaxHints");

export function syntaxHintsPlugin(): Plugin<DecorationSet> {
  return new Plugin<DecorationSet>({
    key: syntaxHintsKey,
    state: {
      init: (_, state) => buildDecorationSet(state),
      apply: (_tr, _old, _oldState, newState) => buildDecorationSet(newState),
    },
    props: {
      decorations(state) {
        return syntaxHintsKey.getState(state);
      },
    },
  });
}
