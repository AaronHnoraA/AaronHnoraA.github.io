import DOMPurify from "dompurify";
import TurndownService from "turndown";
import { gfm } from "turndown-plugin-gfm";

const MAX_HTML_TO_MARKDOWN_CHARS = 900_000;

const turndown = new TurndownService({
  bulletListMarker: "-",
  codeBlockStyle: "fenced",
  emDelimiter: "*",
  headingStyle: "atx",
  hr: "---",
});

turndown.use(gfm);

turndown.addRule("strikethrough", {
  filter: (node) => ["DEL", "S", "STRIKE"].includes(node.nodeName),
  replacement: (content) => content ? `~~${content}~~` : "",
});

turndown.addRule("mark", {
  filter: ["mark"],
  replacement: (content) => content ? `==${content}==` : "",
});

turndown.addRule("subscript", {
  filter: ["sub"],
  replacement: (content) => content ? `~${content}~` : "",
});

turndown.addRule("superscript", {
  filter: ["sup"],
  replacement: (content) => content ? `^${content}^` : "",
});

function normalizeMarkdown(md: string): string {
  return md
    .replace(/\r\n?/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function plainTextFromHtml(html: string): string {
  const template = document.createElement("template");
  template.innerHTML = html;
  return normalizeMarkdown(template.content.textContent ?? "");
}

export function htmlToMarkdown(html: string): string {
  const raw = String(html || "");
  if (raw.length > MAX_HTML_TO_MARKDOWN_CHARS) return plainTextFromHtml(raw);
  const clean = DOMPurify.sanitize(raw, {
    ALLOWED_URI_REGEXP: /^(?:(?:https?|mailto|tel|file|zotero|roam):|[#/]|\.{0,2}\/|[^a-z])/i,
    FORBID_TAGS: ["script", "style", "iframe", "object", "embed"],
  });
  return normalizeMarkdown(turndown.turndown(clean));
}
