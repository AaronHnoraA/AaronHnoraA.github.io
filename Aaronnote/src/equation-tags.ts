import type { Node as PMNode } from "prosemirror-model";
import { Plugin, PluginKey, type EditorState, type Transaction } from "prosemirror-state";

import { changedRanges, mappedRange, overlapsAny, type DocRange } from "./transaction-ranges.ts";

export type EquationTagHit = {
  tag: string;
  from: number;
  to: number;
  blockPos: number;
};

const equationTagsKey = new PluginKey<EquationTagHit[]>("equation-tags");

function latexTagHitsInText(tex: string, base: number, blockPos: number): EquationTagHit[] {
  const hits: EquationTagHit[] = [];
  const pattern = /\\tag\s*\{\s*([^{}\n]+?)\s*\}/g;
  let match: RegExpExecArray | null;
  while ((match = pattern.exec(tex))) {
    const raw = match[1] ?? "";
    const tag = raw.trim();
    if (!tag) continue;
    const matched = match[0] ?? "";
    const groupStartInMatch = matched.indexOf(raw);
    if (groupStartInMatch < 0) continue;
    const leading = raw.length - raw.trimStart().length;
    const from = base + match.index + groupStartInMatch + leading;
    hits.push({ tag, from, to: from + tag.length, blockPos });
  }
  return hits;
}

function collectEquationTags(doc: PMNode): EquationTagHit[] {
  const hits: EquationTagHit[] = [];
  doc.descendants((node, pos) => {
    if (node.type.name !== "math_block") return true;
    hits.push(...latexTagHitsInText(node.textContent, pos + 1, pos));
    return false;
  });
  return hits;
}

function mathBlocksInRanges(doc: PMNode, ranges: readonly DocRange[]): Array<{ node: PMNode; pos: number }> {
  const byPos = new Map<number, { node: PMNode; pos: number }>();
  for (const range of ranges) {
    const from = Math.max(0, Math.min(range.from, doc.content.size));
    const to = Math.max(from, Math.min(range.to, doc.content.size));
    const scanTo = Math.min(doc.content.size, Math.max(to, from + 1));
    doc.nodesBetween(from, scanTo, (node, pos) => {
      if (node.type.name !== "math_block") return true;
      byPos.set(pos, { node, pos });
      return false;
    });
  }
  return [...byPos.values()].sort((a, b) => a.pos - b.pos);
}

function incrementalEquationTags(prev: EquationTagHit[], tr: Transaction, doc: PMNode): EquationTagHit[] {
  const ranges = changedRanges(tr);
  if (ranges.length === 0) return prev;
  const changedBlocks = mathBlocksInRanges(doc, ranges);
  const changedBlockRanges = changedBlocks.map(({ node, pos }) => ({ from: pos, to: pos + node.nodeSize }));
  const kept = prev
    .map((hit) => {
      const tagRange = mappedRange(tr.mapping, hit.from, hit.to);
      return {
        ...hit,
        from: tagRange.from,
        to: tagRange.to,
        blockPos: tr.mapping.map(hit.blockPos, 1),
      };
    })
    .filter((hit) => {
      const node = doc.nodeAt(hit.blockPos);
      return Boolean(node && node.type.name === "math_block") && !overlapsAny(hit.blockPos, hit.blockPos + (node?.nodeSize ?? 0), changedBlockRanges);
    });
  for (const { node, pos } of changedBlocks) {
    kept.push(...latexTagHitsInText(node.textContent, pos + 1, pos));
  }
  kept.sort((a, b) => a.from - b.from || a.to - b.to);
  return kept;
}

export function equationTagsPlugin(): Plugin<EquationTagHit[]> {
  return new Plugin<EquationTagHit[]>({
    key: equationTagsKey,
    state: {
      init: (_, state) => collectEquationTags(state.doc),
      apply: (tr, prev, _oldState, newState) =>
        tr.docChanged ? incrementalEquationTags(prev, tr, newState.doc) : prev,
    },
  });
}

export function getEquationTagHits(state: EditorState): EquationTagHit[] {
  return equationTagsKey.getState(state) ?? [];
}

export function equationTagsFromText(tex: string): string[] {
  return latexTagHitsInText(tex, 0, 0).map((hit) => hit.tag);
}
