import { describe, expect, test } from "@voidzero-dev/vite-plus-test";

// @ts-ignore The server is a Node ESM module outside the TS app graph.
import { assetRefsFromContent } from "../server/aaronnote-server.mjs";

const noteRoot = decodeURIComponent(new URL("../../roam", import.meta.url).pathname.replace(/^\/@fs/, "").replace(/\/$/, ""));

describe("server asset refs", () => {
  test("extracts markdown image and attachment paths relative to note file", () => {
    const note = `${noteRoot}/project/a.md`;
    expect(
      assetRefsFromContent("![plot](./images/a/plot.png)\n[file](attachments/a/raw%20data.pdf)", note),
    ).toEqual([
      `${noteRoot}/project/images/a/plot.png`,
      `${noteRoot}/project/attachments/a/raw data.pdf`,
    ]);
  });

  test("ignores external asset URLs", () => {
    expect(
      assetRefsFromContent("![remote](https://example.com/a.png)\n<a href=\"mailto:x@y.z\">x</a>", `${noteRoot}/a.md`),
    ).toEqual([]);
  });
});
