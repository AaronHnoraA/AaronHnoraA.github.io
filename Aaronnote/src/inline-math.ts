// Conservative inline math detection shared by CM6 widgets and floating preview.
// Single dollar signs often appear in prose and prices, so these rules prefer
// false negatives over wrapping ordinary text in a math box.

export const INLINE_MATH_RE = /(?<![A-Za-z0-9_$])\$(?![\s$0-9])([^$\n]*?\S)\$(?![A-Za-z0-9_$])/g;

const INLINE_TEXT_WORD_RE = /(?:^|[^\\A-Za-z])([A-Za-z]{3,})(?=$|[^A-Za-z])/g;
const INLINE_CJK_RE = /[\u3400-\u9fff]/;

export function isEscapedSource(src: string, pos: number): boolean {
  let count = 0;
  for (let i = pos - 1; i >= 0 && src[i] === "\\"; i--) count++;
  return count % 2 === 1;
}

export function isInlineDollar(src: string, pos: number): boolean {
  return (
    src[pos] === "$" &&
    src[pos - 1] !== "$" &&
    src[pos + 1] !== "$" &&
    !isEscapedSource(src, pos)
  );
}

export function isInlineMathOpen(src: string, pos: number): boolean {
  return (
    isInlineDollar(src, pos) &&
    !/[A-Za-z0-9_]/.test(src[pos - 1] ?? "") &&
    !/[\s0-9]/.test(src[pos + 1] ?? "")
  );
}

export function isInlineMathClose(src: string, pos: number): boolean {
  return (
    isInlineDollar(src, pos) &&
    !/\s/.test(src[pos - 1] ?? "") &&
    !/[A-Za-z0-9_]/.test(src[pos + 1] ?? "")
  );
}

export function isLikelyInlineMath(tex: string): boolean {
  const trimmed = tex.trim();
  if (!trimmed || trimmed.length !== tex.length || trimmed.length > 120) return false;
  if (/[#$]/.test(trimmed)) return false;
  if (INLINE_CJK_RE.test(trimmed) && !trimmed.includes("\\")) return false;

  let longWords = 0;
  INLINE_TEXT_WORD_RE.lastIndex = 0;
  let match: RegExpExecArray | null;
  while ((match = INLINE_TEXT_WORD_RE.exec(trimmed)) !== null) {
    const word = match[1]!;
    const wordStart = match.index + match[0].length - word.length;
    if (wordStart > 0 && trimmed[wordStart - 1] === "\\") continue;
    longWords++;
    if (longWords >= 2) return false;
  }
  return true;
}
