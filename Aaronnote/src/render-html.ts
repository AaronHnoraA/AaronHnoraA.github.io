import MarkdownIt from "markdown-it";
import { full as emoji } from "markdown-it-emoji";
import type Token from "markdown-it/lib/token.mjs";
import type StateBlock from "markdown-it/lib/rules_block/state_block.mjs";
import type StateInline from "markdown-it/lib/rules_inline/state_inline.mjs";

import { cleanEditorHTML } from "./export-html.ts";
import { renderMathHTML } from "./math-render.ts";
import { safeHref } from "./url-safety.ts";

declare global {
  interface Window {
    AaronnoteResolveAssetUrl?: (src: string) => string;
  }
}

export type RenderMarkdownHTMLOptions = {
  assetResolver?: (src: string) => string;
};

export type RenderPublishedNoteOptions = {
  title: string;
  group?: string;
  date?: string;
  root?: string;
  kind?: string;
  format?: "html" | "pdf";
  noteThemeVersion?: string;
  kindAssetsHtml?: string;
  private?: boolean;
  includePrivateContent?: boolean;
};

type OrgEnvTokenMeta = {
  kind: string;
  title: string;
  body: string;
};

const ORG_ENV_OPEN_RE = /^\s*#\+begin\s+(\S+)(?:[ \t]+([^\n]*?))?[ \t]*$/i;

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(value: string): string {
  return escapeHtml(value);
}

function safeNoteKind(value: string | undefined): string {
  const kind = String(value || "default").toLowerCase();
  return /^[a-z0-9_-]+$/.test(kind) ? kind : "default";
}

function classList(...parts: Array<string | false | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function parseMetaEntries(body: string): Array<{ key: string; value: string }> {
  return body
    .split(/\r?\n/)
    .map((line) => line.match(/^\s*([A-Za-z0-9_-]+)\s*:\s*(.*?)\s*$/))
    .filter((match): match is RegExpMatchArray => Boolean(match))
    .map((match) => ({ key: match[1]!, value: match[2] ?? "" }));
}

export function metaEntryMap(entries: Array<{ key: string; value: string }>): Map<string, string> {
  return new Map(entries.map((entry) => [entry.key.toLowerCase(), entry.value]));
}

export function metaTags(value: string): string[] {
  return String(value || "")
    .split(",")
    .map((tag) => tag.trim().replace(/^#/, ""))
    .filter(Boolean);
}

export function showMetaTag(tag: string): boolean {
  return !/[\\/_]/.test(tag);
}

function renderMetaCover(body: string): string {
  const entries = parseMetaEntries(body);
  if (entries.length === 0) {
    return [
      '<div class="cm-org-env-block org-env-block" data-kind="meta" data-label="Meta">',
      '<div class="org-env-meta aaronnote-meta-cover">',
      '<span class="org-env-meta-empty">No metadata</span>',
      "</div>",
      "</div>",
    ].join("");
  }

  const byKey = metaEntryMap(entries);
  const title = byKey.get("title") || "Untitled";
  const date = byKey.get("date") || "";
  const tags = metaTags(byKey.get("tags") || "")
    .filter(showMetaTag)
    .map((tag) => `<button class="aaronnote-meta-tag">#${escapeHtml(tag)}</button>`)
    .join("");

  return [
    '<div class="cm-org-env-block org-env-block" data-kind="meta" data-label="Meta">',
    '<div class="org-env-meta aaronnote-meta-cover">',
    `<h1 class="aaronnote-meta-title">${escapeHtml(title)}</h1>`,
    date ? `<p class="aaronnote-meta-date">${escapeHtml(date)}</p>` : "",
    tags ? `<nav class="aaronnote-meta-tags" aria-label="Tags">${tags}</nav>` : "",
    "</div>",
    "</div>",
  ].join("");
}

function resolveAssetSrc(src: string, resolver?: (src: string) => string): string {
  const raw = String(src || "").trim();
  if (!raw) return raw;
  return resolver?.(raw) ?? window.AaronnoteResolveAssetUrl?.(raw) ?? raw;
}

function envLabel(kind: string): string {
  const labels: Record<string, string> = {
    meta: "Meta",
    theorem: "Theorem",
    thm: "Theorem",
    definition: "Definition",
    defn: "Definition",
    lemma: "Lemma",
    corollary: "Corollary",
    cor: "Corollary",
    proposition: "Proposition",
    prop: "Proposition",
    property: "Property",
    proof: "Proof",
    example: "Example",
    attention: "Attention",
    warning: "Warning",
    note: "Note",
    info: "Info",
    comment: "Comment",
    summary: "Summary",
  };
  return labels[kind] ?? kind;
}

function lineText(state: StateBlock, line: number): string {
  return state.src.slice(state.bMarks[line]! + state.tShift[line]!, state.eMarks[line]);
}

function orgEnvBlockRule(state: StateBlock, startLine: number, endLine: number, silent: boolean): boolean {
  const openLine = lineText(state, startLine);
  const open = openLine.match(ORG_ENV_OPEN_RE);
  if (!open) return false;
  const kind = open[1]!;
  const closeRe = new RegExp(`^\\s*#\\+end\\s+${kind.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*$`, "i");

  let closeLine = -1;
  for (let line = startLine + 1; line < endLine; line++) {
    if (closeRe.test(lineText(state, line))) {
      closeLine = line;
      break;
    }
  }
  if (closeLine < 0) return false;
  if (silent) return true;

  const bodyStart = state.bMarks[startLine + 1] ?? state.eMarks[startLine];
  const bodyEnd = state.bMarks[closeLine] ?? state.eMarks[closeLine];
  const token = state.push("org_env_block", "org-env-block", 0);
  token.block = true;
  token.map = [startLine, closeLine + 1];
  token.meta = {
    kind,
    title: open[2]?.trim() ?? "",
    body: state.src.slice(bodyStart, bodyEnd).replace(/\n$/, ""),
  } satisfies OrgEnvTokenMeta;
  state.line = closeLine + 1;
  return true;
}

function mathBlockRule(state: StateBlock, startLine: number, endLine: number, silent: boolean): boolean {
  const open = lineText(state, startLine);
  if (!/^\s*\$\$\s*$/.test(open)) return false;
  let closeLine = -1;
  for (let line = startLine + 1; line < endLine; line++) {
    if (/^\s*\$\$\s*$/.test(lineText(state, line))) {
      closeLine = line;
      break;
    }
  }
  if (closeLine < 0) return false;
  if (silent) return true;

  const bodyStart = state.bMarks[startLine + 1] ?? state.eMarks[startLine];
  const bodyEnd = state.bMarks[closeLine] ?? state.eMarks[closeLine];
  const token = state.push("math_block", "math-block", 0);
  token.block = true;
  token.map = [startLine, closeLine + 1];
  token.content = state.src.slice(bodyStart, bodyEnd).trim();
  state.line = closeLine + 1;
  return true;
}

function frontMatterRule(state: StateBlock, startLine: number, endLine: number, silent: boolean): boolean {
  if (startLine !== 0 || !/^---\s*$/.test(lineText(state, startLine))) return false;
  let closeLine = -1;
  for (let line = startLine + 1; line < endLine; line++) {
    if (/^---\s*$/.test(lineText(state, line))) {
      closeLine = line;
      break;
    }
  }
  if (closeLine < 0) return false;
  if (silent) return true;
  const bodyStart = state.bMarks[startLine + 1] ?? state.eMarks[startLine];
  const bodyEnd = state.bMarks[closeLine] ?? state.eMarks[closeLine];
  const token = state.push("front_matter", "yaml-block", 0);
  token.block = true;
  token.map = [startLine, closeLine + 1];
  token.content = state.src.slice(bodyStart, bodyEnd).trim();
  state.line = closeLine + 1;
  return true;
}

function tocRule(state: StateBlock, startLine: number, _endLine: number, silent: boolean): boolean {
  if (!/^\s*\[toc\]\s*$/i.test(lineText(state, startLine))) return false;
  if (silent) return true;
  const token = state.push("toc_block", "div", 0);
  token.block = true;
  token.map = [startLine, startLine + 1];
  state.line = startLine + 1;
  return true;
}

function mathInlineRule(state: StateInline, silent: boolean): boolean {
  const start = state.pos;
  if (state.src.charCodeAt(start) !== 0x24 /* $ */) return false;
  if (state.src[start + 1] === "$") return false;
  if (start > 0 && state.src[start - 1] === "\\") return false;
  const end = state.src.indexOf("$", start + 1);
  if (end < 0 || end === start + 1) return false;
  const tex = state.src.slice(start + 1, end);
  if (tex.includes("\n")) return false;
  if (silent) return true;
  const token = state.push("math_inline", "span", 0);
  token.content = tex;
  state.pos = end + 1;
  return true;
}

function renderMath(tex: string, displayMode: boolean): string {
  const { html, error } = renderMathHTML(tex, {
    displayMode,
    throwOnError: false,
    strict: false,
    trust: false,
    output: "html",
  });
  return error ? "" : html;
}

function renderMathBlock(tokens: Token[], idx: number, _options: unknown, _env: unknown, renderer: MarkdownIt["renderer"]): string {
  const tex = tokens[idx]!.content;
  const escaped = escapeAttr(tex);
  const html = renderMath(tex, true) || renderer.rules.text?.(tokens, idx, {}, {}, renderer) || renderer.renderToken(tokens, idx, {});
  return `<math-block data-aaronnote-math-block="" class="math-block-rendered" data-tex="${escaped}"><div class="aaronnote-math-block math-block-render" data-tex="${escaped}" data-math-render-key="display\n${escaped}">${html}</div></math-block>`;
}

function renderMathInline(tokens: Token[], idx: number, _options: unknown, _env: unknown, _renderer: MarkdownIt["renderer"]): string {
  const tex = tokens[idx]!.content;
  const escaped = escapeAttr(tex);
  const html = renderMath(tex, false) || escapeHtml(`$${tex}$`);
  return `<span class="aaronnote-math-inline" data-tex="${escaped}" data-math-render-key="inline\n${escaped}">${html}</span>`;
}

function isRoamCoreHref(href: string): boolean {
  const raw = String(href || "").trim();
  if (!raw) return false;
  if (/^roam:\/\//i.test(raw)) return true;
  if (/^[A-Za-z][\w+.-]*:/i.test(raw)) return false;
  if (raw.startsWith("#") || raw.startsWith("@")) return false;
  return raw.includes("#") || raw.includes("@");
}

function renderOrgEnv(md: MarkdownIt, tokens: Token[], idx: number): string {
  const meta = tokens[idx]!.meta as OrgEnvTokenMeta;
  const kind = meta.kind;
  if (kind.toLowerCase() === "meta") return renderMetaCover(meta.body);
  const title = meta.title;
  const label = envLabel(kind);
  const body = meta.body.trim() ? md.render(meta.body) : "";
  return [
    `<org-env-block data-kind="${escapeAttr(kind)}" data-title="${escapeAttr(title)}" data-label="${escapeAttr(label)}" data-comment-open="false">`,
    `<span class="org-env-heading"><span class="org-env-heading-label">${escapeHtml(label)}</span><span class="org-env-heading-title" data-empty="${title ? "false" : "true"}">${escapeHtml(title)}</span></span>`,
    `<div class="org-env-content">${body}</div>`,
    "</org-env-block>",
  ].join("");
}

function applyTaskCheckboxes(root: HTMLElement): void {
  root.querySelectorAll<HTMLLIElement>("li").forEach((li) => {
    const first = li.firstChild;
    if (!(first instanceof Text)) return;
    const match = first.data.match(/^\[([ xX])\]\s+/);
    if (!match) return;
    first.data = first.data.slice(match[0].length);
    const box = document.createElement("span");
    box.className = "checkbox";
    box.dataset.checked = match[1]!.toLowerCase() === "x" ? "1" : "0";
    li.prepend(box);
  });
}

function createMarkdownIt(options: RenderMarkdownHTMLOptions): MarkdownIt {
  const md = new MarkdownIt({
    html: false,
    linkify: true,
    typographer: false,
  }).use(emoji);

  md.validateLink = () => true;
  md.block.ruler.before("fence", "front_matter", frontMatterRule, { alt: [] });
  md.block.ruler.before("fence", "org_env_block", orgEnvBlockRule, { alt: ["paragraph", "reference", "blockquote"] });
  md.block.ruler.before("fence", "math_block", mathBlockRule, { alt: ["paragraph", "reference", "blockquote"] });
  md.block.ruler.before("paragraph", "toc_block", tocRule, { alt: ["paragraph"] });
  md.inline.ruler.after("escape", "math_inline", mathInlineRule);

  md.renderer.rules.math_block = renderMathBlock;
  md.renderer.rules.math_inline = renderMathInline;
  md.renderer.rules.org_env_block = (tokens, idx) => renderOrgEnv(md, tokens, idx);
  md.renderer.rules.front_matter = (tokens, idx, _opts, _env, _renderer) =>
    `<yaml-block><pre>${escapeHtml(tokens[idx]!.content)}</pre></yaml-block>`;
  md.renderer.rules.toc_block = () => `<div class="toc"><div class="toc-empty">(no headings yet)</div></div>`;

  const originalLinkOpen = md.renderer.rules.link_open ?? ((tokens, idx, opts, _env, self) => self.renderToken(tokens, idx, opts));
  md.renderer.rules.link_open = (tokens, idx, opts, env, self) => {
    const token = tokens[idx]!;
    const href = token.attrGet("href");
    if (href && !safeHref(href)) {
      const attrIndex = token.attrIndex("href");
      if (attrIndex >= 0) token.attrs?.splice(attrIndex, 1);
    } else if (href && isRoamCoreHref(href)) {
      token.attrJoin("class", "aaronnote-roam-link");
      token.attrSet("data-roam-link", "true");
    }
    return originalLinkOpen(tokens, idx, opts, env, self);
  };

  const originalImage = md.renderer.rules.image ?? ((tokens, idx, opts, _env, self) => self.renderToken(tokens, idx, opts));
  md.renderer.rules.image = (tokens, idx, opts, env, self) => {
    const src = tokens[idx]!.attrGet("src");
    if (src && !safeHref(src)) {
      const attrIndex = tokens[idx]!.attrIndex("src");
      if (attrIndex >= 0) tokens[idx]!.attrs?.splice(attrIndex, 1);
    } else if (src) {
      tokens[idx]!.attrSet("src", resolveAssetSrc(src, options.assetResolver));
    }
    return originalImage(tokens, idx, opts, env, self);
  };

  return md;
}

export function renderMarkdownHTML(
  markdown: string,
  options: RenderMarkdownHTMLOptions = {},
): string {
  const md = createMarkdownIt(options);
  const root = document.createElement("div");
  root.innerHTML = md.render(markdown);
  applyTaskCheckboxes(root);
  return cleanEditorHTML(root);
}

export function renderPublishedNoteHTML(
  markdown: string,
  options: RenderPublishedNoteOptions,
): string {
  const root = options.root || "./";
  const assetRoot = escapeAttr(root);
  const version = options.noteThemeVersion || "dev";
  const title = options.title || "Untitled";
  const group = options.group || "Root";
  const date = options.date || "Undated";
  const kind = safeNoteKind(options.kind);
  const format = options.format === "pdf" ? "pdf" : "html";
  const pdf = format === "pdf";
  const hidden = Boolean(options.private && !options.includePrivateContent);
  const contentHtml = hidden
    ? '<p class="sealed-note-message">This note has been sealed by the administrator.</p>'
    : renderMarkdownHTML(markdown);
  const shellClass = classList(
    "aaronnote-shell",
    "published-note-page",
    pdf && "published-note-pdf",
    hidden && "hidden-note-page",
    kind !== "default" && `note-kind-${kind}`,
  );
  const kindAssetsHtml = options.kindAssetsHtml ? `${options.kindAssetsHtml}\n` : "";
  const toolbarHtml = pdf ? "" : `    <header class="aaronnote-toolbar">
      <div class="aaronnote-title">
        <strong>Aaronnote</strong>
        <span data-file-label>${escapeHtml(group)} / ${escapeHtml(date)}</span>
      </div>
      <nav class="aaronnote-actions" aria-label="Published note navigation">
        <a href="${assetRoot}index.html">Home</a>
        <a href="${assetRoot}notes.html">Archive</a>
      </nav>
      <span class="aaronnote-vim-mode">READ</span>
      <span class="aaronnote-status">Published HTML</span>
    </header>
`;
  const tocHtml = pdf ? "" : `      <aside class="aaronnote-floating-toc is-collapsed" data-floating-toc data-published-toc>
        <button type="button" data-toc-toggle aria-expanded="false">TOC</button>
        <nav data-toc-list aria-label="Table of contents"></nav>
      </aside>
`;
  const localGraphHtml = pdf ? "" : `      <aside class="aaronnote-local-graph is-collapsed" data-published-local-graph hidden>
        <button type="button" data-local-graph-toggle aria-expanded="false">Graph</button>
        <section class="aaronnote-local-graph-panel" aria-label="Local graph">
          <header>
            <strong>Local graph</strong>
            <span data-local-graph-status></span>
          </header>
          <div class="aaronnote-local-graph-controls">
            <label class="aaronnote-local-graph-depth">
              <span>Depth</span>
              <input data-local-graph-depth type="range" min="1" max="2" step="1" value="1" />
              <b data-local-graph-depth-label>1</b>
            </label>
            <label><input data-local-graph-refs type="checkbox" checked /> Refs</label>
            <label><input data-local-graph-backlinks type="checkbox" checked /> Backlinks</label>
            <label><input data-local-graph-tags type="checkbox" checked /> Tags</label>
          </div>
          <div class="aaronnote-local-graph-canvas" data-local-graph-canvas></div>
        </section>
      </aside>
`;
  const scriptHtml = pdf ? "" : `  <script type="module" src="${assetRoot}Aaronnote/aaronnote/published-toc.js?v=${escapeAttr(version)}"></script>
  <script type="module" src="${assetRoot}Aaronnote/aaronnote/published-local-graph.js?v=${escapeAttr(version)}"></script>
`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtml(title)} | Aaron He</title>
  <link rel="stylesheet" href="${assetRoot}Aaronnote/aaronnote/style.css?v=${escapeAttr(version)}" />
  <link rel="stylesheet" href="${assetRoot}Aaronnote/src/styles/widgets.css?v=${escapeAttr(version)}" />
  <link rel="stylesheet" href="${assetRoot}Aaronnote/src/styles/theme-typora.css?v=${escapeAttr(version)}" />
  <link rel="stylesheet" href="${assetRoot}css/aaronnote-published.css?v=${escapeAttr(version)}" />
${kindAssetsHtml}</head>
<body class="${pdf ? "aaronnote-published-document aaronnote-pdf-document" : "aaronnote-published-document"}" data-note-kind="${escapeAttr(kind)}">
  <main class="${escapeAttr(shellClass)}" data-note-kind="${escapeAttr(kind)}">
${toolbarHtml}
    <section class="aaronnote-body">
      <section class="aaronnote-editor" id="editor">
        <div class="typora-web-wrap">
          <div class="typora-web-editor-host">
            <article id="content" class="cm-editor" data-note-title="${escapeAttr(title)}" data-note-kind="${escapeAttr(kind)}">
              ${contentHtml}
            </article>
          </div>
        </div>
      </section>
${tocHtml}
${localGraphHtml}
    </section>
  </main>
${scriptHtml}
</body>
</html>
`;
}
