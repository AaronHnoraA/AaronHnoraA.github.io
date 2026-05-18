import type { Node as PMNode } from "prosemirror-model";
import type { Mapping } from "prosemirror-transform";
import type { Transaction } from "prosemirror-state";

export type DocRange = { from: number; to: number };
export type TextblockHit = { node: PMNode; pos: number; parent: PMNode | null };

export function mappedRange(mapping: Mapping, from: number, to: number): DocRange {
  const mappedFrom = mapping.map(from, 1);
  const mappedTo = mapping.map(to, -1);
  return mappedFrom <= mappedTo
    ? { from: mappedFrom, to: mappedTo }
    : { from: mappedTo, to: mappedFrom };
}

export function changedRanges(tr: Transaction): DocRange[] {
  const ranges: DocRange[] = [];
  tr.mapping.maps.forEach((map, index) => {
    map.forEach((_oldStart, _oldEnd, newStart, newEnd) => {
      const laterMaps = tr.mapping.slice(index + 1);
      ranges.push(mappedRange(laterMaps, newStart, newEnd));
    });
  });
  return ranges;
}

export function changedRangesFromTransactions(transactions: readonly Transaction[]): DocRange[] {
  const ranges: DocRange[] = [];
  transactions.forEach((tr, trIndex) => {
    tr.mapping.maps.forEach((map, mapIndex) => {
      map.forEach((_oldStart, _oldEnd, newStart, newEnd) => {
        let range = mappedRange(tr.mapping.slice(mapIndex + 1), newStart, newEnd);
        for (let i = trIndex + 1; i < transactions.length; i++) {
          range = mappedRange(transactions[i]!.mapping, range.from, range.to);
        }
        ranges.push(range);
      });
    });
  });
  return ranges;
}

export function textblockAround(doc: PMNode, pos: number): TextblockHit | null {
  const clamped = Math.max(0, Math.min(pos, doc.content.size));
  const $pos = doc.resolve(clamped);
  for (let depth = $pos.depth; depth > 0; depth--) {
    const node = $pos.node(depth);
    if (!node.isTextblock) continue;
    return {
      node,
      pos: $pos.before(depth),
      parent: depth > 0 ? $pos.node(depth - 1) : null,
    };
  }
  return null;
}

export function changedTextblocks(doc: PMNode, ranges: readonly DocRange[]): TextblockHit[] {
  const byPos = new Map<number, TextblockHit>();
  const remember = (hit: TextblockHit | null): void => {
    if (hit) byPos.set(hit.pos, hit);
  };
  for (const range of ranges) {
    const from = Math.max(0, Math.min(range.from, doc.content.size));
    const to = Math.max(from, Math.min(range.to, doc.content.size));
    remember(textblockAround(doc, from));
    remember(textblockAround(doc, to));
    const scanTo = Math.min(doc.content.size, Math.max(to, from + 1));
    doc.nodesBetween(from, scanTo, (node, pos, parent) => {
      if (!node.isTextblock) return true;
      byPos.set(pos, { node, pos, parent });
      return false;
    });
  }
  return [...byPos.values()].sort((a, b) => a.pos - b.pos);
}

export function overlapsAny(from: number, to: number, ranges: readonly DocRange[]): boolean {
  if (from === to) return ranges.some((range) => from >= range.from && from <= range.to);
  return ranges.some((range) => to > range.from && from < range.to);
}
