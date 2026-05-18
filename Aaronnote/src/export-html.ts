import DOMPurify from "dompurify";

function stripAttrs(el: Element): void {
  for (const attr of Array.from(el.attributes)) {
    if (
      attr.name === "contenteditable" ||
      attr.name === "data-pos" ||
      attr.name === "data-unsafe-href" ||
      attr.name.startsWith("data-pm-") ||
      attr.name.startsWith("aria-")
    ) {
      el.removeAttribute(attr.name);
    }
  }
}

export function cleanEditorHTML(root: HTMLElement): string {
  const clone = root.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(
    [
      ".cb-chrome",
      ".ProseMirror-separator",
      ".ProseMirror-trailingBreak",
      ".emoji-completion",
      ".file-input",
      ".play-caret",
      ".syntax-hidden",
      ".syntax-hint",
      ".syntax-hint-italic",
      ".math-source-hidden",
    ].join(","),
  ).forEach((node) => node.remove());

  clone.querySelectorAll("pre.cb-diagram-rendered:not(.cb-diagram-error) > code")
    .forEach((node) => node.remove());
  clone.querySelectorAll("[hidden]").forEach((node) => node.remove());
  clone.querySelectorAll("*").forEach(stripAttrs);
  stripAttrs(clone);
  return DOMPurify.sanitize(clone.innerHTML, {
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel|file|zotero|roam):|[#/]|\.{0,2}\/|[^a-z])/i,
    ADD_TAGS: ["math", "mrow", "mi", "mn", "mo", "msup", "msub", "msubsup", "mfrac", "msqrt", "mroot", "mtable", "mtr", "mtd", "semantics", "annotation"],
    ADD_ATTR: ["xmlns", "viewBox", "d", "x", "y", "x1", "y1", "x2", "y2", "cx", "cy", "r", "rx", "ry", "width", "height", "fill", "stroke", "stroke-width", "transform", "points"],
  });
}
