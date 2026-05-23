import initLeanTreeSitter, {
  create_session,
  free_session,
  parse_utf16,
  set_text,
  type LeanTreeSitterSpan,
} from "@arborium/lean";
import leanTreeSitterWasmUrl from "@arborium/lean/grammar_bg.wasm?url";

const LEAN_DECL_RE = /^(\s*)([A-Za-z_][\w'.!?]*|✝[A-Za-z_][\w'.!?]*)\s*(:)(.*)$/u;
const FENCE_RE = /```([A-Za-z0-9_-]*)[ \t]*\n?([\s\S]*?)```/g;
let leanTreeSitterReady: Promise<void> | null = null;
const renderGenerations = new WeakMap<HTMLElement, number>();

type MarkdownSegment =
  | { kind: "text"; text: string }
  | { kind: "lean"; text: string; spans?: LeanTreeSitterSpan[] };

function ensureLeanTreeSitter(): Promise<void> {
  leanTreeSitterReady ??= initLeanTreeSitter({ module_or_path: leanTreeSitterWasmUrl }).then(() => undefined);
  return leanTreeSitterReady;
}

async function parseLeanTreeSitter(text: string): Promise<LeanTreeSitterSpan[]> {
  await ensureLeanTreeSitter();
  const session = create_session();
  try {
    set_text(session, text);
    return (parse_utf16(session).spans ?? []).filter((span) =>
      typeof span.start === "number"
      && typeof span.end === "number"
      && typeof span.capture === "string")
      .sort((a, b) => a.start - b.start || a.end - b.end);
  } finally {
    free_session(session);
  }
}

export function stripLeanMarkdownFence(raw: string): string {
  const trimmed = raw.trim();
  const match = /^```[A-Za-z0-9_-]*[ \t]*\n?([\s\S]*?)```\s*$/.exec(trimmed);
  return match ? match[1].trimEnd() : trimmed;
}

export function leanSummary(raw: string, max = 96): string {
  const oneLine = stripLeanMarkdownFence(raw).replace(/\s+/g, " ").trim();
  return oneLine.length > max ? `${oneLine.slice(0, Math.max(0, max - 1))}…` : oneLine;
}

function span(className: string, text: string): HTMLSpanElement {
  const node = document.createElement("span");
  node.className = className;
  node.textContent = text;
  return node;
}

function treeSitterCaptureClass(capture: string): string {
  const parts = String(capture || "unknown")
    .split(".")
    .map((part) => part.replace(/[^A-Za-z0-9_-]/g, "-").toLowerCase())
    .filter(Boolean);
  const full = parts.length > 0 ? parts.join("-") : "unknown";
  const classes = [`cm-lean-ts-${full}`];
  if (parts[0]) classes.push(`cm-lean-ts-${parts[0]}`);
  return Array.from(new Set(classes)).join(" ");
}

function appendHighlightedLean(row: HTMLElement, text: string, from: number, to: number, spans: LeanTreeSitterSpan[] | undefined): void {
  if (!spans?.length) {
    row.append(document.createTextNode(text.slice(from, to)));
    return;
  }
  let cursor = from;
  for (const rawSpan of spans) {
    const start = Math.max(from, Number(rawSpan.start));
    const end = Math.min(to, Number(rawSpan.end));
    if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start || start < cursor) continue;
    if (start > cursor) row.append(document.createTextNode(text.slice(cursor, start)));
    const node = span(`lean-render-token ${treeSitterCaptureClass(rawSpan.capture)}`, text.slice(start, end));
    row.append(node);
    cursor = end;
  }
  if (cursor < to) row.append(document.createTextNode(text.slice(cursor, to)));
}

export function appendLeanCodeBlock(parent: HTMLElement, raw: string, spans?: LeanTreeSitterSpan[]): HTMLElement {
  const text = stripLeanMarkdownFence(raw);
  const block = document.createElement("div");
  block.className = "lean-render-code";
  if (text.includes("⊢")) block.classList.add("lean-render-code--goal");
  const lines = text.split("\n");
  let lineFrom = 0;
  for (const line of lines) {
    const lineTo = lineFrom + line.length;
    const row = document.createElement("div");
    row.className = "lean-render-line";
    if (/^\s*⊢/.test(line)) row.classList.add("lean-render-line--target");
    else if (line.trim()) row.classList.add("lean-render-line--hypothesis");
    const decl = LEAN_DECL_RE.exec(line);
    if (decl) {
      row.append(document.createTextNode(decl[1] ?? ""));
      row.append(span("lean-render-name", decl[2] ?? ""));
      row.append(span("lean-render-punct", decl[3] ?? ":"));
      row.append(document.createTextNode(" "));
      const suffix = decl[4] ?? "";
      const suffixTrimmed = suffix.trimStart();
      const suffixStart = lineTo - suffixTrimmed.length;
      appendHighlightedLean(row, text, suffixStart, lineTo, spans);
    } else if (line) {
      appendHighlightedLean(row, text, lineFrom, lineTo, spans);
    } else {
      row.append(document.createTextNode(" "));
    }
    block.append(row);
    lineFrom = lineTo + 1;
  }
  parent.append(block);
  return block;
}

function appendInlineMarkdown(parent: HTMLElement, text: string): void {
  const re = /`([^`]+)`/g;
  let cursor = 0;
  for (const match of text.matchAll(re)) {
    const from = match.index ?? cursor;
    if (from > cursor) parent.append(document.createTextNode(text.slice(cursor, from)));
    parent.append(span("lean-render-inline-code", match[1] ?? ""));
    cursor = from + (match[0]?.length ?? 0);
  }
  if (cursor < text.length) parent.append(document.createTextNode(text.slice(cursor)));
}

function appendMarkdownParagraphs(parent: HTMLElement, raw: string): void {
  for (const para of raw.split(/\n{2,}/).map((x) => x.trim()).filter(Boolean)) {
    const p = document.createElement("p");
    p.className = "lean-render-paragraph";
    appendInlineMarkdown(p, para.replace(/\n/g, " "));
    parent.append(p);
  }
}

export function renderLeanMarkdown(parent: HTMLElement, raw: string): void {
  const generation = (renderGenerations.get(parent) ?? 0) + 1;
  renderGenerations.set(parent, generation);
  const segments = markdownSegments(raw);
  renderLeanMarkdownSegments(parent, segments);
  const leanSegments = segments.filter((segment): segment is { kind: "lean"; text: string; spans?: LeanTreeSitterSpan[] } => segment.kind === "lean");
  if (leanSegments.length === 0) return;
  void Promise.all(leanSegments.map(async (segment) => {
    segment.spans = await parseLeanTreeSitter(segment.text);
  })).then(() => {
    if (generation !== renderGenerations.get(parent)) return;
    renderLeanMarkdownSegments(parent, segments);
  }).catch(() => {});
}

function renderLeanMarkdownSegments(parent: HTMLElement, segments: MarkdownSegment[]): void {
  parent.replaceChildren();
  if (segments.length === 0) return;
  const root = document.createElement("div");
  root.className = "lean-render";
  for (const segment of segments) {
    if (segment.kind === "lean") appendLeanCodeBlock(root, segment.text, segment.spans);
    else appendMarkdownParagraphs(root, segment.text);
  }
  parent.append(root);
}

function markdownSegments(raw: string): MarkdownSegment[] {
  const text = raw.trim();
  if (!text) return [];
  let cursor = 0;
  let matched = false;
  const segments: MarkdownSegment[] = [];
  for (const match of text.matchAll(FENCE_RE)) {
    matched = true;
    const from = match.index ?? cursor;
    if (from > cursor) segments.push({ kind: "text", text: text.slice(cursor, from) });
    const lang = String(match[1] ?? "").toLowerCase();
    const code = match[2] ?? "";
    if (!lang || lang === "lean" || lang === "lean4") {
      segments.push({ kind: "lean", text: code.trimEnd() });
    } else {
      segments.push({ kind: "text", text: code });
    }
    cursor = from + (match[0]?.length ?? 0);
  }
  if (cursor < text.length) {
    if (!matched && looksLikeLean(text)) segments.push({ kind: "lean", text });
    else segments.push({ kind: "text", text: text.slice(cursor) });
  }
  return segments;
}

function looksLikeLean(text: string): boolean {
  if (text.includes("⊢")) return true;
  if (/^\s*(import|example|theorem|lemma|def|rw|exact|simp)\b/m.test(text)) return true;
  return /^[A-Za-z_][\w'.!?]*\s*(?:\{[^}]*\}\s*)*(?:\[[^\]]*\]\s*)*\([^)]*\)\s*:/.test(text.trim());
}
