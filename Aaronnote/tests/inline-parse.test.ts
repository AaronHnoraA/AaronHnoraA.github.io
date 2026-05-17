import { describe, expect, test } from "@voidzero-dev/vite-plus-test";

import { parseInline } from "../src/inline-parse.ts";

describe("parseInline", () => {
  test("plain text — no spans", () => {
    expect(parseInline("hello")).toEqual([]);
  });

  test("lone asterisk — no pair", () => {
    expect(parseInline("*")).toEqual([]);
  });

  test("unclosed em — no pair", () => {
    expect(parseInline("*1")).toEqual([]);
  });

  test("*1* — em", () => {
    expect(parseInline("*1*")).toEqual([
      { type: "em", from: 1, to: 2, openFrom: 0, openTo: 1, closeFrom: 2, closeTo: 3 },
    ]);
  });

  test("**1** — strong", () => {
    expect(parseInline("**1**")).toEqual([
      { type: "strong", from: 2, to: 3, openFrom: 0, openTo: 2, closeFrom: 3, closeTo: 5 },
    ]);
  });

  test("**1* — Typora outermost em with stray inner asterisk", () => {
    // outer `*`s pair as em, inner `*` stays as content → em("*1")
    expect(parseInline("**1*")).toEqual([
      { type: "em", from: 1, to: 3, openFrom: 0, openTo: 1, closeFrom: 3, closeTo: 4 },
    ]);
  });

  test("*1** — em with trailing stray asterisk", () => {
    // open run len 1, close run len 2 → em pair; close consumes rightmost 1
    expect(parseInline("*1**")).toEqual([
      { type: "em", from: 1, to: 3, openFrom: 0, openTo: 1, closeFrom: 3, closeTo: 4 },
    ]);
  });

  test("* 1 * — whitespace-adjacent, no pair", () => {
    expect(parseInline("* 1 *")).toEqual([]);
  });

  test("*a*b* — L→R stack pairing closes at first close run", () => {
    // Stack-based pairing (CommonMark style): first `*` opens, second
    // `*` closes → em("a"); trailing `*` has no open left on stack.
    // (Old "outermost" rule bridged to the last `*`, which also caused
    // the `_em_ __strong__` bridging bug — see emphasis.ts.)
    expect(parseInline("*a*b*")).toEqual([
      { type: "em", from: 1, to: 2, openFrom: 0, openTo: 1, closeFrom: 2, closeTo: 3 },
    ]);
  });

  test("hello *world* — em in the middle", () => {
    expect(parseInline("hello *world*")).toEqual([
      { type: "em", from: 7, to: 12, openFrom: 6, openTo: 7, closeFrom: 12, closeTo: 13 },
    ]);
  });

  test("** — just delim chars, no pair", () => {
    expect(parseInline("**")).toEqual([]);
  });

  test("`1` — code", () => {
    expect(parseInline("`1`")).toEqual([
      { type: "code", from: 1, to: 2, openFrom: 0, openTo: 1, closeFrom: 2, closeTo: 3 },
    ]);
  });

  test("`*x*` — code wins over em; inner stars stay as content", () => {
    expect(parseInline("`*x*`")).toEqual([
      { type: "code", from: 1, to: 4, openFrom: 0, openTo: 1, closeFrom: 4, closeTo: 5 },
    ]);
  });

  test("~~1~~ — strike", () => {
    expect(parseInline("~~1~~")).toEqual([
      { type: "strike", from: 2, to: 3, openFrom: 0, openTo: 2, closeFrom: 3, closeTo: 5 },
    ]);
  });

  test("~1~ — single tilde is subscript (Typora extension)", () => {
    expect(parseInline("~1~")).toEqual([
      { type: "sub", from: 1, to: 2, openFrom: 0, openTo: 1, closeFrom: 2, closeTo: 3 },
    ]);
  });

  test("display math with line fences spans newlines", () => {
    expect(parseInline("$$\na^2+b^2\n$$")).toMatchObject([
      {
        type: "math",
        from: 2,
        to: 11,
        openFrom: 0,
        openTo: 2,
        closeFrom: 11,
        closeTo: 13,
        attrs: { tex: "a^2+b^2", delimiter: "$$", display: true },
      },
    ]);
  });

  test("same-line double-dollar source is not stable display math", () => {
    expect(parseInline("$$ ssada sad $$").filter((span) => span.type === "math")).toEqual([]);
  });

  test("empty display math fence stays a display math span", () => {
    expect(parseInline("$$\n$$")).toMatchObject([
      {
        type: "math",
        from: 2,
        to: 3,
        openFrom: 0,
        openTo: 2,
        closeFrom: 3,
        closeTo: 5,
        attrs: { tex: "", delimiter: "$$", display: true },
      },
    ]);
  });

  test("display math close fence must be on its own line", () => {
    expect(parseInline(String.raw`$$
d\mathrm{GA} \le_p \mathrm{GI} $$`).filter((span) => span.type === "math")).toEqual([]);
  });

  test("display math open fence must be on its own line", () => {
    expect(parseInline("$$ adad\n$$").filter((span) => span.type === "math")).toEqual([]);
  });

  test("display math preserves internal blank lines", () => {
    expect(parseInline("$$\nasdasda\n\nasdasd\n\nadasda s\n$$")).toMatchObject([
      {
        type: "math",
        openFrom: 0,
        openTo: 2,
        attrs: { tex: "asdasda\n\nasdasd\n\nadasda s", delimiter: "$$", display: true },
      },
    ]);
  });

  test("unclosed double-dollar source is not partially parsed as inline math", () => {
    expect(parseInline("$$dTA\\le_p TI>$")).toEqual([]);
  });

  test("non-display double-dollar pair is not split into single-dollar math", () => {
    expect(parseInline("x $$not display$$ y")).toEqual([]);
  });

  test("single-dollar line fences are not display math", () => {
    expect(parseInline("$\na^2+b^2\n$").filter((span) => span.type === "math")).toEqual([]);
  });
});
