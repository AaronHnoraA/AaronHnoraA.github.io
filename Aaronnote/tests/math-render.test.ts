import { describe, expect, test } from "@voidzero-dev/vite-plus-test";

import { renderMathLazy } from "../src/math-render.ts";

describe("math render source handling", () => {
  test("renders from the exact TeX source without command-name repairs", () => {
    const el = document.createElement("span");
    const tex = "dathrm{GA} e_p athrm{GI}";
    renderMathLazy(tex, el, { displayMode: false, throwOnError: false }, () => {});
    expect(el.getAttribute("data-math-render-key")).toBe(`inline\n${tex}`);
  });
});
