import { Plugin, PluginKey, type EditorState } from "prosemirror-state";
import type { EditorView } from "prosemirror-view";

export type ViewportRange = { from: number; to: number };

export const VIEWPORT_RANGE_META = "aaronnote-viewport-range";

const viewportKey = new PluginKey<ViewportRange | null>("aaronnote-viewport-range");
const VIEWPORT_MARGIN_PX = 900;
const MIN_RANGE_CHANGE = 256;

function sameViewportRange(a: ViewportRange | null, b: ViewportRange | null): boolean {
  return a?.from === b?.from && a?.to === b?.to;
}

function rangeChangedEnough(a: ViewportRange | null, b: ViewportRange): boolean {
  if (!a) return true;
  return Math.abs(a.from - b.from) > MIN_RANGE_CHANGE || Math.abs(a.to - b.to) > MIN_RANGE_CHANGE;
}

function viewportRangeFromView(view: EditorView): ViewportRange | null {
  if (typeof window === "undefined") return null;
  const rect = view.dom.getBoundingClientRect();
  if (rect.width <= 0 || rect.height <= 0) return null;
  const left = Math.max(rect.left + 8, 8);
  const top = Math.max(0, rect.top - VIEWPORT_MARGIN_PX);
  const bottom = Math.min(window.innerHeight, rect.bottom + VIEWPORT_MARGIN_PX);
  try {
    const start = view.posAtCoords({ left, top });
    const end = view.posAtCoords({ left, top: bottom });
    if (!start && !end) return null;
    const from = Math.max(0, Math.min(start?.pos ?? 0, view.state.doc.content.size));
    const to = Math.max(from, Math.min(end?.pos ?? view.state.doc.content.size, view.state.doc.content.size));
    return { from, to };
  } catch {
    return null;
  }
}

export function getViewportRange(state: EditorState): ViewportRange | null {
  return viewportKey.getState(state) ?? null;
}

export function viewportRangePlugin(): Plugin<ViewportRange | null> {
  return new Plugin<ViewportRange | null>({
    key: viewportKey,
    state: {
      init: () => null,
      apply(tr, previous) {
        const next = tr.getMeta(VIEWPORT_RANGE_META) as ViewportRange | null | undefined;
        if (next === undefined) return previous;
        return sameViewportRange(previous, next) ? previous : next;
      },
    },
    view(view) {
      let frame = 0;
      const update = (): void => {
        frame = 0;
        const next = viewportRangeFromView(view);
        if (!next || !rangeChangedEnough(viewportKey.getState(view.state) ?? null, next)) return;
        view.dispatch(view.state.tr.setMeta(VIEWPORT_RANGE_META, next));
      };
      const requestUpdate = (): void => {
        if (frame) return;
        frame = window.requestAnimationFrame(update);
      };
      requestUpdate();
      window.addEventListener("scroll", requestUpdate, true);
      window.addEventListener("resize", requestUpdate);
      return {
        update: requestUpdate,
        destroy() {
          if (frame) window.cancelAnimationFrame(frame);
          window.removeEventListener("scroll", requestUpdate, true);
          window.removeEventListener("resize", requestUpdate);
        },
      };
    },
  });
}
