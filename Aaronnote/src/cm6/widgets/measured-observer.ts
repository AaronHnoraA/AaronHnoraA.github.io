import type { EditorView } from "@codemirror/view";

// ---------------------------------------------------------------------------
// Per-content height cache: stable key → last measured pixel height
// This lets CM6 use a close estimate for estimatedHeight when a widget is
// recreated off-screen during scroll, avoiding height-map thrash.
// ---------------------------------------------------------------------------

const MAX_CACHE_SIZE = 500;
export const measuredHeightCache = new Map<string, number>();

function cacheSet(key: string, height: number): void {
  if (measuredHeightCache.has(key)) {
    measuredHeightCache.delete(key); // refresh LRU order
  } else if (measuredHeightCache.size >= MAX_CACHE_SIZE) {
    const oldest = measuredHeightCache.keys().next().value;
    if (oldest !== undefined) measuredHeightCache.delete(oldest);
  }
  measuredHeightCache.set(key, height);
}

export function shortHash(s: string): string {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return (h >>> 0).toString(36);
}

// ---------------------------------------------------------------------------
// Shared ResizeObserver — detects height changes CM6's own MutationObserver
// misses (lazy images, async SVGs, KaTeX font reflow, comment collapse, etc.)
// and fires a debounced view.requestMeasure() to update the height map.
//
// Performance: completely idle when no widgets are mounted; fires at most once
// per animation frame even if many widgets resize simultaneously; no polling.
// ---------------------------------------------------------------------------

const elementToView = new WeakMap<Element, EditorView>();
const lastHeights = new WeakMap<Element, number>();
const pendingViews = new Set<EditorView>();
let rafScheduled = false;
let sharedRO: ResizeObserver | null = null;

function getSharedRO(): ResizeObserver | null {
  if (sharedRO) return sharedRO;
  if (typeof ResizeObserver === "undefined") return null; // jsdom / test env
  sharedRO = new ResizeObserver((entries) => {
    for (const entry of entries) {
      const el = entry.target as HTMLElement;
      const newH = Math.round(el.offsetHeight);
      const oldH = lastHeights.get(el);
      if (oldH !== undefined && newH === oldH) continue; // no real change
      lastHeights.set(el, newH);
      const key = (el as HTMLElement).dataset.cmMeasureKey;
      if (key && newH > 0) cacheSet(key, newH);
      const view = elementToView.get(el);
      if (view?.dom.isConnected) pendingViews.add(view);
    }
    // Coalesce all pending views into one rAF call — at most 1 requestMeasure/frame
    if (pendingViews.size > 0 && !rafScheduled) {
      rafScheduled = true;
      requestAnimationFrame(() => {
        rafScheduled = false;
        for (const view of pendingViews) {
          if (view.dom.isConnected) view.requestMeasure();
        }
        pendingViews.clear();
      });
    }
  });
  return sharedRO;
}

export function observeWidget(el: HTMLElement, view: EditorView): void {
  const ro = getSharedRO();
  if (!ro) return;
  elementToView.set(el, view);
  ro.observe(el);
  // Capture baseline immediately so the first RO callback has a reference
  const h = Math.round(el.offsetHeight);
  if (h > 0) {
    lastHeights.set(el, h);
    const key = el.dataset.cmMeasureKey;
    if (key) cacheSet(key, h);
  }
}

export function unobserveWidget(el: HTMLElement): void {
  sharedRO?.unobserve(el);
  elementToView.delete(el);
  lastHeights.delete(el);
}
