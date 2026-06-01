/**
 * Shared scanner for code-span/code-block ranges in the current viewport.
 *
 * Several inline-preview features (inline math, wikilinks, CJK styling,
 * ==highlight==, @@commands) are driven by regex scans over raw text and must
 * NOT fire inside fenced/indented/inline code, where Markdown is meant to stay
 * literal. The Lezer syntax tree already marks these regions, so we collect them
 * once per scan and let callers exclude them.
 *
 * Performance: the walk is bounded to the supplied ranges (the caller's visible
 * ranges), and returns immediately on each code node without descending into its
 * children — so it never scans the whole document.
 */
import { syntaxTree } from "@codemirror/language";
import type { EditorState } from "@codemirror/state";

const CODE_NODE_NAMES = new Set(["FencedCode", "CodeBlock", "IndentedCode", "InlineCode"]);

/** Collect code-span/code-block ranges within `ranges`, sorted by start offset. */
export function scanCodeRanges(
  state: EditorState,
  ranges: readonly { from: number; to: number }[],
): Array<{ from: number; to: number }> {
  const out: Array<{ from: number; to: number }> = [];
  for (const { from, to } of ranges) {
    syntaxTree(state).iterate({
      from,
      to,
      enter(node) {
        if (CODE_NODE_NAMES.has(node.name)) {
          out.push({ from: node.from, to: node.to });
          return false;
        }
        return true;
      },
    });
  }
  return out.sort((a, b) => a.from - b.from || a.to - b.to);
}
