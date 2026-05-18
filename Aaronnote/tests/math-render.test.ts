import { describe, expect, test } from "@voidzero-dev/vite-plus-test";

import { renderMathHTML, renderMathLazy } from "../src/math-render.ts";

describe("math render source handling", () => {
  test("renders from the exact TeX source without command-name repairs", () => {
    const el = document.createElement("span");
    const tex = "dathrm{GA} e_p athrm{GI}";
    renderMathLazy(tex, el, { displayMode: false, throwOnError: false }, () => {});
    expect(el.getAttribute("data-math-render-key")).toBe(`inline\n${tex}`);
  });

  test("uses KaTeX as the primary renderer for TeX commands", () => {
    const rendered = renderMathHTML("G[i] \\cong G[j].\\quad \\varphi(i)=j.", {
      displayMode: true,
      output: "html",
      strict: false,
    });

    expect(rendered.error).toBeUndefined();
    expect(rendered.html).toContain("katex");
    expect(rendered.html).toContain("≅");
    expect(rendered.html).toContain("φ");
    expect(rendered.html).not.toContain("ongG");
    expect(rendered.html).not.toContain("ăr");
  });
});
