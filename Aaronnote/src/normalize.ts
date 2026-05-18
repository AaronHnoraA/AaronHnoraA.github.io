// Normalize plugin — the authoritative "text → marks" step.
//
// After every transaction, walk each textblock, run parseInline on its
// textContent, and reconcile em/strong marks to match. Delim ranges are
// exposed via plugin state so the decorations plugin can render them as
// syntax-hint / syntax-hidden.

import type { Node as PMNode } from "prosemirror-model";
import { Plugin, PluginKey, type EditorState, type Transaction } from "prosemirror-state";

import { collectInlineFeatures } from "./features/index.ts";
import { parseInline, type InlineSpan } from "./inline-parse.ts";
import { schema } from "./schema.ts";
import { changedRanges, changedTextblocks, mappedRange, overlapsAny } from "./transaction-ranges.ts";

export type DelimRange = {
  from: number;
  to: number;
  // The surrounding mark's full source range (open start .. close end).
  // Used by decoration/display to decide whether the cursor is "inside".
  spanFrom: number;
  spanTo: number;
  // When true, decorations renders this delim as `syntax-hint` regardless
  // of cursor position. Used for links whose visible content is empty —
  // hiding the delim would make the link disappear entirely.
  forceVisible?: boolean;
  // When true, the range is hidden when the cursor is outside the span
  // and rendered as plain text (no decoration) when the cursor is inside.
  // Used for soft whitespace ranges inside a code fence.
  softInside?: boolean;
  // When true, the range is hidden regardless of cursor — used for atomic
  // markers like task-list `[ ] ` whose source is not user-editable.
  forceHidden?: boolean;
  // Override the default decoration class.
  className?: string;
};

export type ExtraDecoration = {
  from: number;
  to: number;
  nodeName: string;
  attrs?: Record<string, string>;
};

export type WidgetDecoration = {
  pos: number;
  spanFrom: number;
  spanTo: number;
  when: "inside" | "outside" | "always";
  kind: string;
  attrs?: Record<string, string>;
  side?: number;
};

export type NormalizeState = {
  delims: DelimRange[];
  extras: ExtraDecoration[];
  widgets: WidgetDecoration[];
  // Cached for appendTransaction's mark-sync pass — avoids walking the
  // whole doc twice per transaction. Populated by state.apply / init.
  blocks: Array<{ blockPos: number; plan: BlockPlan }>;
};

type BlockPlan = { blockStart: number; spans: InlineSpan[] };
type PlannedBlock = { blockPos: number; plan: BlockPlan };
type PlanResult = {
  blocks: PlannedBlock[];
  delims: DelimRange[];
  extras: ExtraDecoration[];
  widgets: WidgetDecoration[];
};
type ManagedMarkType = NonNullable<typeof schema.marks[string]>;
const blockSpanCache = new WeakMap<PMNode, Map<string, InlineSpan[]>>();

function parentCacheKey(parent: PMNode | null | undefined): string {
  return parent?.type.name ?? "";
}

function parseInlineCached(node: PMNode, parent: PMNode | null | undefined, bypassCache: boolean): InlineSpan[] {
  const key = parentCacheKey(parent);
  if (!bypassCache) {
    const cachedByParent = blockSpanCache.get(node);
    const cached = cachedByParent?.get(key);
    if (cached) return cached;
  }
  const spans = parseInline(node.textContent, parent ?? null);
  let byParent = blockSpanCache.get(node);
  if (!byParent) {
    byParent = new Map();
    blockSpanCache.set(node, byParent);
  }
  byParent.set(key, spans);
  return spans;
}

// Walk the doc, return per-textblock parse plan + absolute-pos delim list.
function appendBlockPlan(
  out: PlanResult,
  node: PMNode,
  pos: number,
  parent: PMNode | null | undefined,
  options: { bypassCache?: boolean } = {},
): void {
  const spans = parseInlineCached(node, parent, options.bypassCache === true);
  const blockStart = pos + 1;
  out.blocks.push({ blockPos: pos, plan: { blockStart, spans } });
  for (const s of spans) {
    const spanFrom = blockStart + s.openFrom;
    const spanTo = blockStart + s.closeTo;
    if (s.delimRanges) {
      for (const dr of s.delimRanges) {
        out.delims.push({
          from: blockStart + dr.from,
          to: blockStart + dr.to,
          spanFrom,
          spanTo,
          forceVisible: dr.forceVisible,
          softInside: dr.softInside,
          forceHidden: dr.forceHidden,
          className: dr.className,
        });
      }
    } else {
      out.delims.push({ from: blockStart + s.openFrom, to: blockStart + s.openTo, spanFrom, spanTo });
      out.delims.push({ from: blockStart + s.closeFrom, to: blockStart + s.closeTo, spanFrom, spanTo });
    }
    if (s.extraDecorations) {
      for (const ex of s.extraDecorations) {
        out.extras.push({
          from: blockStart + ex.from,
          to: blockStart + ex.to,
          nodeName: ex.nodeName,
          attrs: ex.attrs,
        });
      }
    }
    if (s.widgetDecorations) {
      for (const w of s.widgetDecorations) {
        out.widgets.push({
          pos: blockStart + w.pos,
          spanFrom,
          spanTo,
          when: w.when,
          kind: w.kind,
          attrs: w.attrs,
          side: w.side,
        });
      }
    }
  }
}

function computePlan(doc: PMNode, options: { bypassCache?: boolean } = {}): PlanResult {
  const out: PlanResult = {
    blocks: [],
    delims: [],
    extras: [],
    widgets: [],
  };
  doc.descendants((node, pos, parent) => {
    if (!node.isTextblock) return true;
    appendBlockPlan(out, node, pos, parent, options);
    return false; // don't descend into inline children
  });
  return sortPlanResult(out);
}

function sortPlanResult(out: PlanResult): PlanResult {
  out.blocks.sort((a, b) => a.blockPos - b.blockPos);
  out.delims.sort((a, b) => a.from - b.from || a.to - b.to);
  out.extras.sort((a, b) => a.from - b.from || a.to - b.to);
  out.widgets.sort((a, b) => a.pos - b.pos);
  return out;
}

function incrementalPlan(prev: NormalizeState, tr: Transaction, newDoc: PMNode): PlanResult {
  const ranges = changedRanges(tr);
  if (ranges.length === 0) return prev;
  const changed = changedTextblocks(newDoc, ranges);
  if (changed.length === 0) return computePlan(newDoc);

  const changedBlockRanges = changed.map(({ node, pos }) => ({ from: pos, to: pos + node.nodeSize }));
  const mappedBlocks = prev.blocks
    .map(({ blockPos, plan }) => ({
      blockPos: tr.mapping.map(blockPos, 1),
      plan: { blockStart: tr.mapping.map(plan.blockStart, 1), spans: plan.spans },
    }))
    .filter(({ blockPos }) => {
      const node = newDoc.nodeAt(blockPos);
      return Boolean(node?.isTextblock) && !overlapsAny(blockPos, blockPos + (node?.nodeSize ?? 0), changedBlockRanges);
    });

  const out: PlanResult = {
    blocks: mappedBlocks,
    delims: prev.delims
      .map((d) => {
        const range = mappedRange(tr.mapping, d.from, d.to);
        const span = mappedRange(tr.mapping, d.spanFrom, d.spanTo);
        return { ...d, from: range.from, to: range.to, spanFrom: span.from, spanTo: span.to };
      })
      .filter((d) => !overlapsAny(d.from, d.to, changedBlockRanges)),
    extras: prev.extras
      .map((ex) => ({ ...ex, ...mappedRange(tr.mapping, ex.from, ex.to) }))
      .filter((ex) => !overlapsAny(ex.from, ex.to, changedBlockRanges)),
    widgets: prev.widgets
      .map((w) => {
        const span = mappedRange(tr.mapping, w.spanFrom, w.spanTo);
        return { ...w, pos: tr.mapping.map(w.pos, w.side ?? -1), spanFrom: span.from, spanTo: span.to };
      })
      .filter((w) => !overlapsAny(w.pos, w.pos, changedBlockRanges)),
  };

  for (const block of changed) appendBlockPlan(out, block.node, block.pos, block.parent, { bypassCache: true });
  return sortPlanResult(out);
}

const normalizeKey = new PluginKey<NormalizeState>("normalize-inline");

export function normalizeInlinePlugin(): Plugin<NormalizeState> {
  const managedTypes = collectInlineFeatures()
    .flatMap((f) => f.markNames)
    .map((n) => schema.marks[n])
    .filter((t): t is ManagedMarkType => !!t);
  const managedTypeSet = new Set(managedTypes);

  return new Plugin<NormalizeState>({
    key: normalizeKey,

    state: {
      init: (_, state) => computePlan(state.doc),
      apply: (tr, prev, _oldState, newState) =>
        // Skip the doc walk when nothing in the doc changed — selection-
        // only transactions are very common (every keystroke that moves
        // the cursor) and the cached plan stays valid for them.
        tr.getMeta("image-load-status-changed") || tr.getMeta("normalize-inline-recompute")
          ? computePlan(newState.doc, { bypassCache: true })
          : tr.docChanged
            ? incrementalPlan(prev, tr, newState.doc)
            : prev,
    },

    appendTransaction(_transactions, _oldState, newState) {
      // Reuse the plan computed in state.apply rather than walking the
      // doc a second time. (Caching cut a 50-blocks doc's per-tx
      // overhead roughly in half.)
      const planState = normalizeKey.getState(newState);
      if (!planState) return null;
      const { blocks } = planState;
      const tr = newState.tr;
      let changed = false;

      for (const { blockPos, plan } of blocks) {
        const blockNode = newState.doc.nodeAt(blockPos);
        if (!blockNode || !blockNode.isTextblock) continue;
        const { blockStart, spans } = plan;
        const blockEnd = blockStart + blockNode.content.size;
        const size = blockNode.content.size;

        // Fast skip: if this block has no spans for ANY managed type AND
        // no existing managed marks on its text, there's nothing to
        // reconcile — the most common case for plain prose paragraphs.
        if (spans.length === 0) {
          let hasManaged = false;
          blockNode.content.forEach((child) => {
            for (const mk of child.marks)
              if (managedTypeSet.has(mk.type)) { hasManaged = true; return; }
          });
          if (!hasManaged) continue;
        }

        for (const markType of managedTypes) {
          const name = markType.name;

          // Per-name fast skip: if no span of this type AND no existing
          // mark of this type on the block, nothing to do.
          let spansOfType = false;
          for (const s of spans) if (s.type === name) { spansOfType = true; break; }
          let hasMarkOfType = false;
          if (!spansOfType) {
            blockNode.content.forEach((child) => {
              if (hasMarkOfType) return;
              if (child.marks.some((mk) => mk.type === markType)) hasMarkOfType = true;
            });
            if (!hasMarkOfType) continue;
          }

          // For attr-bearing marks (link, image) coverage equality isn't
          // enough — attrs (href / src / title) can change while coverage
          // stays the same. Build a per-position mark map and compare with
          // mark.eq() so we don't keep re-emitting identical removeMark+
          // addMark steps every transaction (PM would re-fire
          // appendTransaction on those steps and we'd loop).
          const targetMarks = new Array<import("prosemirror-model").Mark | null>(
            size,
          ).fill(null);
          for (const s of spans) {
            if (s.type !== name) continue;
            const m = markType.create(s.attrs);
            for (let i = s.from; i < s.to; i++) targetMarks[i] = m;
          }
          const currentMarks = new Array<import("prosemirror-model").Mark | null>(
            size,
          ).fill(null);
          {
            let cOff = 0;
            blockNode.content.forEach((child) => {
              const m = child.marks.find((mk) => mk.type === markType) ?? null;
              for (let i = 0; i < child.nodeSize; i++) currentMarks[cOff + i] = m;
              cOff += child.nodeSize;
            });
          }
          let same = true;
          for (let i = 0; i < size; i++) {
            const a = targetMarks[i];
            const b = currentMarks[i];
            if (a === b) continue;
            if (!a || !b || !a.eq(b)) {
              same = false;
              break;
            }
          }
          if (same) continue;

          tr.removeMark(blockStart, blockEnd, markType);
          for (const s of spans) {
            if (s.type === name)
              tr.addMark(blockStart + s.from, blockStart + s.to, markType.create(s.attrs));
          }
          changed = true;
        }
      }

      return changed ? tr : null;
    },
  });
}

export function getDelims(state: EditorState): DelimRange[] {
  return normalizeKey.getState(state)?.delims ?? [];
}

export function getExtras(state: EditorState): ExtraDecoration[] {
  return normalizeKey.getState(state)?.extras ?? [];
}

export function getWidgets(state: EditorState): WidgetDecoration[] {
  return normalizeKey.getState(state)?.widgets ?? [];
}
