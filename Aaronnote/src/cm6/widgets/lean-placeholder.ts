import { EditorSelection, EditorState, Prec, RangeSet, RangeSetBuilder, RangeValue, StateEffect, StateField, Transaction, type ChangeSet, type ChangeSpec, type Extension, type Text } from "@codemirror/state";
import {
  Decoration,
  EditorView,
  GutterMarker,
  gutter,
  hoverTooltip,
  highlightActiveLine,
  highlightActiveLineGutter,
    keymap,
    lineNumbers,
    showTooltip,
    tooltips,
    ViewPlugin,
  type DecorationSet,
  type Tooltip,
  type ViewUpdate,
} from "@codemirror/view";
import { MeasuredWidget } from "./measured-widget.ts";
import { defaultKeymap, history, historyKeymap, redo, undo } from "@codemirror/commands";
import {
  acceptCompletion,
  autocompletion,
  closeBrackets,
  completionKeymap,
  completionStatus,
  hasNextSnippetField,
  hasPrevSnippetField,
  moveCompletionSelection,
  nextSnippetField,
  prevSnippetField,
  selectedCompletionIndex,
  setSelectedCompletion,
  snippet,
  snippetCompletion,
  startCompletion,
  type Completion,
  type CompletionContext,
} from "@codemirror/autocomplete";
import type { Range } from "@codemirror/state";
import initLeanTreeSitter, { create_session, free_session, parse_utf16, set_text, type LeanTreeSitterSpan } from "@arborium/lean";
import leanTreeSitterWasmUrl from "@arborium/lean/grammar_bg.wasm?url";
import { leanSummary, renderLeanMarkdown, stripLeanMarkdownFence } from "../../lean-render.ts";
import { api } from "../../../aaronnote/api-client.ts";
import { getLeanNoteInfo } from "./lean-block.ts";
import { findHighlightExtension } from "../find-highlight.ts";
import leanAbbreviationsRaw from "../../lean4-abbreviations.json";
import { expandSnippetBody } from "../../../aaronnote/snippets.ts";
import type { SnippetSummary } from "../../../aaronnote/types.ts";
import { canonicalLeanSelector, formatLeanPlaceholder, parseLeanPlaceholderLine } from "../../../shared/lean-placeholder.mjs";

type LeanPlaceholder = {
  from: number;
  to: number;
  tag: string;
  selector: string;
};

class LeanPlaceholderValue extends RangeValue {
  readonly tag: string;
  readonly selector: string;

  constructor(tag: string, selector: string) {
    super();
    this.tag = tag;
    this.selector = selector;
  }

  eq(other: RangeValue): boolean {
    return other instanceof LeanPlaceholderValue
      && other.tag === this.tag
      && other.selector === this.selector;
  }
}

type LeanRegionRead = {
  ok?: boolean;
  body?: string;
  text?: string;
  leanPath?: string;
  region?: LeanRegionMeta;
  message?: string;
};

type LeanRegionMeta = {
  bodyFrom: number;
  bodyTo: number;
};

type LeanContext = {
  notePath: string;
  tag: string;
  selector: string;
  leanPath: string;
  leanText: string;
  lspVersion?: number;
  region: LeanRegionMeta | null;
  ensureLspOpen?: () => Promise<boolean>;
  syncForLsp?: () => Promise<void>;
  jumpToFullPosition?: (line: number, character: number) => void;
};

export type LeanLspAction = "definition" | "declaration" | "typeDefinition" | "implementation" | "references" | "hover";
export type LeanEditAction =
  | "toggleLineComment"
  | "toggleBlockComment"
  | "duplicateUp"
  | "duplicateDown"
  | "moveUp"
  | "moveDown"
  | "joinLines"
  | "deleteTrailingWhitespace"
  | "indent"
  | "outdent";
export type LeanPosition = { line: number; character: number };

/** Server `get-locations` result shape (see server/lib/lean.mjs normalizeLspLocations). */
export type LeanLocation = {
  uri: string;
  file: string;
  range: { start: LeanPosition; end: LeanPosition };
  summary: string;
};

/**
 * Per-mounted-child handle the app shell uses to drive a Lean editor from native
 * menus, the command palette, and the locations picker. Registered on mount and
 * removed on teardown; the focused child is tracked as the "active" controller.
 */
export type LeanEditorController = {
  id: string;
  notePath: string;
  leanPath: string;
  tag: string;
  selector: string;
  runLspAction(action: LeanLspAction, position?: LeanPosition): Promise<void>;
  runEditAction(action: LeanEditAction): void;
  jumpTo(line: number, character: number): void; // full-file Lean line/character
};

const leanControllers = new Map<string, LeanEditorController>();
let activeLeanControllerId = "";

export function registerLeanController(controller: LeanEditorController): void {
  leanControllers.set(controller.id, controller);
}

export function unregisterLeanController(id: string): void {
  leanControllers.delete(id);
  if (activeLeanControllerId === id) activeLeanControllerId = "";
}

export function setActiveLeanController(id: string): void {
  if (leanControllers.has(id)) activeLeanControllerId = id;
}

export function getLeanController(id: string): LeanEditorController | null {
  return leanControllers.get(id) ?? null;
}

export function activeLeanController(): LeanEditorController | null {
  return activeLeanControllerId ? leanControllers.get(activeLeanControllerId) ?? null : null;
}

/**
 * Hook set by the app shell to present a searchable picker for multi-target
 * results (multiple definitions, references). When unset, the router falls back
 * to navigating directly to the first location.
 */
export type LeanLocationsPicker = (locations: LeanLocation[], onPick: (location: LeanLocation) => void) => void;
let leanLocationsPicker: LeanLocationsPicker | null = null;
export function setLeanLocationsPicker(picker: LeanLocationsPicker | null): void {
  leanLocationsPicker = picker;
}

type LeanDiagnosticMark = {
  from: number;
  to: number;
  severity: "error" | "warning" | "info";
  message: string;
  leanTags: LeanDiagnosticTag[];
};

type LeanDiagnosticTag = "unsolvedGoals" | "goalsAccomplished";
type LeanProgressKind = "processing" | "fatalError";

type LeanProgressMark = {
  from: number;
  to: number;
  kind: LeanProgressKind;
};

type LeanGoalStatusMark = {
  from: number;
};

type LeanVimMode = "insert" | "normal" | "visual" | "visual-line";
type LeanJumpTarget = {
  pos: number;
  rect: { left: number; top: number; bottom: number };
  label: string;
};
type LeanJumpModeState =
  | { phase: "target" }
  | { phase: "label"; typed: string; targets: LeanJumpTarget[] };

type LeanRegionInfoviewEvent = {
  notePath: string;
  tag: string;
  selector?: string;
  leanPath?: string;
  uri?: string;
  line?: number;
  character?: number;
  goals: string | null;
  termGoal: string | null;
  goalsAccomplished?: boolean;
  goalError?: string | null;
};

type LeanRegionJumpEvent = CustomEvent<{
  notePath?: string;
  tag?: string;
  selector?: string;
  leanPath?: string;
  line?: number;
  character?: number;
}>;

type LeanRegionInsertEvent = CustomEvent<{
  notePath?: string;
  leanPath?: string;
  text?: string;
  kind?: "here" | "above";
  line?: number;
  character?: number;
}>;

type LeanRegionApplyEditEvent = CustomEvent<{
  notePath?: string;
  edit?: unknown;
}>;

type CopilotEditorLike = {
  getMarkdown(): string;
  getMarkdownSelection(): { from: number; to: number };
  getSelection(): { from: number; to: number };
  insertText(text: string, deleteBefore?: number): { from: number; to: number };
  cursorContext(maxChars?: number): { before?: string; after?: string; rect: { left: number; top: number; bottom: number } | null };
  revealCursor(): void;
};

type CopilotEditorDetail = {
  id: string;
  editor: CopilotEditorLike;
  host: HTMLElement;
  currentFile: () => string;
  vimMode: () => LeanVimMode;
  setStatus: (message: string) => void;
  onChange: (handler: () => void) => () => void;
  onKeyDown: (handler: (event: KeyboardEvent) => boolean) => () => void;
  onAction: (handler: (action: string) => void) => () => void;
  onDocumentEvent: <K extends keyof DocumentEventMap>(
    type: K,
    handler: (event: DocumentEventMap[K]) => void,
    options?: AddEventListenerOptions,
  ) => () => void;
  jumpSnippetNext: () => boolean;
  jumpSnippetPrevious: () => boolean;
  forwardDelimiter: () => boolean;
  backwardDelimiter: () => boolean;
  ack: () => void;
};

const SetLeanDiagnostics = StateEffect.define<LeanDiagnosticMark[]>();
const SetLeanProgress = StateEffect.define<LeanProgressMark[]>();
const SetLeanGoalStatus = StateEffect.define<LeanGoalStatusMark | null>();
const SetLeanSemanticTokens = StateEffect.define<{
  text: string;
  region: LeanRegionMeta | null;
  legend: unknown;
  data: unknown[];
}>();
const SetLeanCursorHover = StateEffect.define<{ pos: number; text: string } | null>();
const SetLeanTreeSitterSpans = StateEffect.define<{
  text: string;
  spans: LeanTreeSitterSpan[];
}>();
const leanAbbreviations = leanAbbreviationsRaw as Record<string, string>;
const leanAbbreviationKeys = Object.keys(leanAbbreviations);
const leanAbbreviationKeySet = new Set(leanAbbreviationKeys);
const leanAbbreviationPrefixSet = new Set<string>();
const copilotRegisterEvent = "aaronnote:copilot-register-editor";
const copilotDisposeEvent = "aaronnote:copilot-dispose-editor";
for (const key of leanAbbreviationKeys) {
  for (let i = 1; i < key.length; i++) {
    leanAbbreviationPrefixSet.add(key.slice(0, i));
  }
}
const leanIndentUnit = "  ";

function fileUri(path: string): string {
  return `file://${path.split("/").map((part) => encodeURIComponent(part)).join("/")}`;
}

let indexedLeanText = "";
let indexedLeanLineStarts = [0];

function leanLineStarts(text: string): number[] {
  if (text === indexedLeanText) return indexedLeanLineStarts;
  const starts = [0];
  let newline = text.indexOf("\n");
  while (newline >= 0) {
    starts.push(newline + 1);
    newline = text.indexOf("\n", newline + 1);
  }
  indexedLeanText = text;
  indexedLeanLineStarts = starts;
  return starts;
}

function positionToOffset(text: string, line: number, character: number): number {
  const starts = leanLineStarts(text);
  const lineNo = Math.max(0, Math.floor(Number(line) || 0));
  const lineStart = starts[lineNo] ?? text.length;
  return Math.min(text.length, lineStart + Math.max(0, Math.floor(Number(character) || 0)));
}

function offsetToPosition(text: string, offset: number): { line: number; character: number } {
  const starts = leanLineStarts(text);
  const pos = Math.max(0, Math.min(text.length, Math.floor(Number(offset) || 0)));
  let low = 0;
  let high = starts.length - 1;
  while (low < high) {
    const mid = (low + high + 1) >> 1;
    if ((starts[mid] ?? 0) <= pos) low = mid;
    else high = mid - 1;
  }
  return { line: low, character: pos - (starts[low] ?? 0) };
}

function localOffsetToFull(ctx: LeanContext, offset: number): number | null {
  if (!ctx.region) return null;
  return ctx.region.bodyFrom + offset;
}

function spliceRegionText(text: string, region: LeanRegionMeta | null, body: string): string {
  if (!region) return text;
  return `${text.slice(0, region.bodyFrom)}${body}${text.slice(region.bodyTo)}`;
}

function updateLeanContextBody(ctx: LeanContext, body: string): void {
  if (!ctx.region) return;
  ctx.leanText = spliceRegionText(ctx.leanText, ctx.region, body);
  ctx.region = { ...ctx.region, bodyTo: ctx.region.bodyFrom + body.length };
}

function fullOffsetToLocal(ctx: LeanContext, offset: number): number | null {
  if (!ctx.region) return null;
  if (offset < ctx.region.bodyFrom || offset > ctx.region.bodyTo) return null;
  return offset - ctx.region.bodyFrom;
}

function stripHoverFence(raw: string): string {
  return stripLeanMarkdownFence(raw);
}

function severityName(sev: number | undefined): LeanDiagnosticMark["severity"] {
  if (sev === 1) return "error";
  if (sev === 2) return "warning";
  return "info";
}

function leanDiagnosticTags(rawTags: unknown): LeanDiagnosticTag[] {
  if (!Array.isArray(rawTags)) return [];
  const tags: LeanDiagnosticTag[] = [];
  for (const raw of rawTags) {
    if (raw === 1 || raw === "1" || raw === "UnsolvedGoals" || raw === "unsolvedGoals") {
      tags.push("unsolvedGoals");
    } else if (raw === 2 || raw === "2" || raw === "GoalsAccomplished" || raw === "goalsAccomplished") {
      tags.push("goalsAccomplished");
    }
  }
  return Array.from(new Set(tags));
}

function semanticTokenClass(tokenType: string): string {
  const safe = String(tokenType || "unknown").replace(/[^A-Za-z0-9_-]/g, "-").toLowerCase();
  return `cm-lean-token cm-lean-token-${safe}`;
}

function treeSitterCaptureClass(capture: string): string {
  const parts = String(capture || "unknown")
    .split(".")
    .map((part) => part.replace(/[^A-Za-z0-9_-]/g, "-").toLowerCase())
    .filter(Boolean);
  const full = parts.length > 0 ? parts.join("-") : "unknown";
  const classes = [`cm-lean-ts-${full}`];
  if (parts[0]) classes.push(`cm-lean-ts-${parts[0]}`);
  return `cm-lean-ts ${Array.from(new Set(classes)).join(" ")}`;
}

function buildTreeSitterDecorations(text: string, spans: LeanTreeSitterSpan[]): DecorationSet {
  const out: Range<Decoration>[] = [];
  for (const span of spans) {
    const from = Math.max(0, Math.min(text.length, Number(span.start)));
    const to = Math.max(0, Math.min(text.length, Number(span.end)));
    if (!Number.isFinite(from) || !Number.isFinite(to) || from >= to) continue;
    out.push(Decoration.mark({ class: treeSitterCaptureClass(span.capture) }).range(from, to));
  }
  out.sort((a, b) => a.from - b.from || (a.value.startSide - b.value.startSide));
  return Decoration.set(out, true);
}

let leanTreeSitterReady: Promise<void> | null = null;

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
      && typeof span.capture === "string");
  } finally {
    free_session(session);
  }
}

function buildSemanticTokenDecorations(text: string, region: LeanRegionMeta | null, legend: unknown, data: unknown[]): DecorationSet {
  if (!region) return Decoration.none;
  const tokenTypes = Array.isArray((legend as { tokenTypes?: unknown[] } | null)?.tokenTypes)
    ? (legend as { tokenTypes: unknown[] }).tokenTypes.map(String)
    : [];
  const raw = data.map((value) => Number(value));
  const out: Range<Decoration>[] = [];
  let line = 0;
  let character = 0;

  for (let i = 0; i + 4 < raw.length; i += 5) {
    const deltaLine = raw[i] ?? 0;
    const deltaStart = raw[i + 1] ?? 0;
    const length = raw[i + 2] ?? 0;
    const tokenTypeIndex = raw[i + 3] ?? -1;
    if (!Number.isFinite(deltaLine) || !Number.isFinite(deltaStart) || !Number.isFinite(length) || length <= 0) continue;

    line += deltaLine;
    character = deltaLine === 0 ? character + deltaStart : deltaStart;

    const fullFrom = positionToOffset(text, line, character);
    const fullTo = positionToOffset(text, line, character + length);
    if (fullTo <= region.bodyFrom || fullFrom >= region.bodyTo) continue;
    const from = Math.max(0, fullFrom - region.bodyFrom);
    const to = Math.max(0, Math.min(region.bodyTo, fullTo) - region.bodyFrom);
    if (from >= to) continue;
    out.push(Decoration.mark({ class: semanticTokenClass(tokenTypes[tokenTypeIndex] ?? "unknown") }).range(from, to));
  }
  out.sort((a, b) => a.from - b.from || (a.value.startSide - b.value.startSide));
  return Decoration.set(out, true);
}

function cleanSnippetText(value: string): string {
  return value
    .replace(/\$\{(\d+)\|([^}]*)\|\}/g, (_match, _idx, choices: string) => choices.split(",")[0] ?? "")
    .replace(/\$\{(\d+):([^}]*)\}/g, "$2")
    .replace(/\$\{(\d+)\}/g, "")
    .replace(/\$\d+/g, "");
}

export type LspCompletionItem = {
  label?: string;
  labelDetails?: { detail?: string; description?: string };
  detail?: string;
  documentation?: string | { kind?: string; value?: string };
  filterText?: string;
  insertText?: string;
  insertTextFormat?: number;
  kind?: number;
  textEdit?: { newText?: string; range?: LspRange };
  additionalTextEdits?: Array<{ newText?: string; range?: LspRange }>;
  data?: unknown;
};

type LspRange = {
  start?: { line?: number; character?: number };
  end?: { line?: number; character?: number };
};

function completionType(kind: number | undefined): Completion["type"] {
  if (kind === 2) return "method";
  if (kind === 3 || kind === 4 || kind === 25) return "function";
  if (kind === 5 || kind === 10) return "property";
  if (kind === 6) return "variable";
  if (kind === 7) return "class";
  if (kind === 8) return "interface";
  if (kind === 9) return "namespace";
  if (kind === 11 || kind === 22 || kind === 26) return "type";
  if (kind === 12 || kind === 21) return "constant";
  if (kind === 13 || kind === 23) return "enum";
  if (kind === 14) return "keyword";
  return "text";
}

function completionKindName(kind: number | undefined): string {
  const names: Record<number, string> = {
    1: "text", 2: "method", 3: "function", 4: "constructor",
    5: "field", 6: "variable", 7: "class", 8: "interface",
    9: "module", 10: "property", 11: "unit", 12: "value",
    13: "enum", 14: "keyword", 15: "snippet", 16: "color",
    17: "file", 18: "reference", 21: "constant", 22: "struct",
    23: "enum member", 24: "event", 25: "operator", 26: "type param",
  };
  return names[kind ?? 0] ?? "identifier";
}

let leanSnippetPromise: Promise<SnippetSummary[]> | null = null;

function loadLeanSnippets(): Promise<SnippetSummary[]> {
  leanSnippetPromise ??= api.notes.snippets()
    .then((msg) => Array.isArray(msg.snippets)
      ? msg.snippets.filter((snippet) => snippet.mode === "lean4-mode")
      : [])
    .catch(() => []);
  return leanSnippetPromise;
}

function completionDocumentation(item: LspCompletionItem): string {
  const doc = item.documentation;
  return typeof doc === "string" ? doc : doc?.value ?? "";
}

function completionDetailText(item: LspCompletionItem): string {
  return [
    item.labelDetails?.detail,
    item.labelDetails?.description,
    item.detail,
  ].map((part) => String(part ?? "").trim()).filter(Boolean).join(" ");
}

function normalizeLspSnippetTemplate(value: string): string {
  return value
    .replace(/\$\{(\d+)\|([^}]*)\|\}/g, (_match, idx: string, choices: string) => {
      const first = choices.split(",")[0] ?? "";
      return `\${${idx}:${first}}`;
    })
    .replace(/\$(\d+)/g, (_match, idx: string) => `\${${idx}}`);
}

export function leanCompletionApplyTextForTest(item: LspCompletionItem): string | undefined {
  const text = item.textEdit?.newText ?? item.insertText;
  if (!text) return undefined;
  return item.insertTextFormat === 2 ? normalizeLspSnippetTemplate(String(text)) : String(text);
}

function completionApplyText(item: LspCompletionItem): string | undefined {
  return leanCompletionApplyTextForTest(item);
}

async function resolveCompletion(item: LspCompletionItem): Promise<LspCompletionItem> {
  if (!item?.data && item.documentation && item.detail) return item;
  try {
    const raw = await api.lean.request("resolve-completion", { item });
    const resolved = (raw as { result?: LspCompletionItem } | null)?.result;
    return resolved?.label ? resolved : item;
  } catch {
    return item;
  }
}

function renderCompletionInfo(kind: string, detail: string, doc: string): HTMLElement | null {
  if (!detail.trim() && !doc.trim()) return null;
  const dom = document.createElement("div");
  dom.className = "cm-lean-completion-info";
  const kindSpan = document.createElement("span");
  kindSpan.className = "cm-lean-completion-kind";
  kindSpan.textContent = kind;
  dom.append(kindSpan);
  if (detail.trim()) {
    const detailEl = document.createElement("div");
    detailEl.className = "cm-lean-completion-type";
    renderLeanMarkdown(detailEl, detail);
    dom.append(detailEl);
  }
  if (doc.trim()) {
    const docEl = document.createElement("div");
    docEl.className = "cm-lean-completion-doc";
    renderLeanMarkdown(docEl, doc);
    dom.append(docEl);
  }
  return dom;
}

async function leanSnippetCompletions(): Promise<Completion[]> {
  const snippets = await loadLeanSnippets();
  const completions: Completion[] = [];
  for (const snippet of snippets) {
    const expanded = expandSnippetBody(snippet);
    const label = String(snippet.key || snippet.name || "").trim();
    const name = String(snippet.name || label || "snippet").trim();
    if (!label) continue;
    const detail = name !== label ? name : "lean4-mode snippet";
    completions.push(snippetCompletion(expanded.text, {
      label,
      detail,
      type: "snippet",
      section: "Snippets",
      boost: -1,
      info: () => {
        const dom = document.createElement("div");
        dom.className = "cm-lean-completion-info";
        const kind = document.createElement("span");
        kind.className = "cm-lean-completion-kind";
        kind.textContent = "snippet";
        const pre = document.createElement("div");
        pre.className = "cm-lean-completion-type";
        renderLeanMarkdown(pre, expanded.text || String(snippet.body ?? ""));
        dom.append(kind, pre);
        return dom;
      },
    }));
  }
  return completions;
}

function lspRangeToLocal(ctx: LeanContext, range: LspRange | undefined, fallbackFrom: number, fallbackTo: number): { from: number; to: number } | null {
  if (!range) return { from: fallbackFrom, to: fallbackTo };
  const start = range.start;
  const end = range.end ?? start;
  if (!start || !end) return { from: fallbackFrom, to: fallbackTo };
  const fullFrom = positionToOffset(ctx.leanText, Number(start.line ?? 0), Number(start.character ?? 0));
  const fullTo = positionToOffset(ctx.leanText, Number(end.line ?? 0), Number(end.character ?? 0));
  const from = fullOffsetToLocal(ctx, fullFrom);
  const to = fullOffsetToLocal(ctx, fullTo);
  if (from == null || to == null) return null;
  return { from, to };
}

function changeFrom(change: ChangeSpec): number {
  return typeof change === "object" && change !== null && "from" in change ? Number(change.from) : 0;
}

function applyLeanCompletion(ctx: LeanContext, item: LspCompletionItem, view: EditorView, completion: Completion, from: number, to: number): void {
  const mainText = completionApplyText(item) ?? String(item.label ?? "");
  const mainRange = lspRangeToLocal(ctx, item.textEdit?.range, from, to);
  if (!mainRange) return;
  const extras = Array.isArray(item.additionalTextEdits) ? item.additionalTextEdits : [];
  const extraChanges: ChangeSpec[] = [];
  for (const edit of extras) {
    const range = lspRangeToLocal(ctx, edit.range, from, to);
    if (!range) continue;
    extraChanges.push({ from: range.from, to: range.to, insert: String(edit.newText ?? "") });
  }
  if (item.insertTextFormat === 2 && extraChanges.length === 0) {
    snippet(mainText)(view, completion, mainRange.from, mainRange.to);
    return;
  }
  const insert = item.insertTextFormat === 2 ? cleanSnippetText(mainText) : mainText;
  view.dispatch({
    changes: [...extraChanges, { from: mainRange.from, to: mainRange.to, insert }]
      .sort((a, b) => changeFrom(a) - changeFrom(b)),
    scrollIntoView: true,
  });
}

function leanAbbreviationBefore(view: EditorView, pos: number, typed: string): { from: number; key: string } | null {
  const start = Math.max(0, pos - 80);
  const before = view.state.doc.sliceString(start, pos);
  const match = /\\([A-Za-z0-9_!?'<>|#&.*~:\-]*)$/.exec(before);
  if (!match) return null;
  return {
    from: start + match.index,
    key: `${match[1] ?? ""}${typed}`,
  };
}

function isLeanAbbreviationDelimiter(text: string): boolean {
  return text.length === 1 && !/[A-Za-z0-9_!?'<>|#&.*~:\-]/.test(text);
}

function applyLeanAbbreviation(view: EditorView, from: number, to: number, key: string, suffix = ""): boolean {
  const replacement = leanAbbreviations[key];
  if (!replacement || replacement.includes("$CURSOR")) return false;
  view.dispatch({
    changes: { from, to, insert: `${replacement}${suffix}` },
    selection: { anchor: from + replacement.length + suffix.length },
  });
  return true;
}

function leanInputHandler(view: EditorView, from: number, to: number, text: string): boolean {
  if (from !== to || text.length !== 1) return false;
  if (isLeanAbbreviationDelimiter(text)) {
    const before = leanAbbreviationBefore(view, from, "");
    if (!before || !leanAbbreviationKeySet.has(before.key)) return false;
    return applyLeanAbbreviation(view, before.from, to, before.key, text);
  }
  const abbrev = leanAbbreviationBefore(view, from, text);
  if (!abbrev || !leanAbbreviationKeySet.has(abbrev.key)) return false;
  if (leanAbbreviationPrefixSet.has(abbrev.key)) return false;
  return applyLeanAbbreviation(view, abbrev.from, to, abbrev.key);
}

function leanPlaceholderRangeForLine(doc: Text, lineNo: number): Range<LeanPlaceholderValue> | null {
  const line = doc.line(lineNo);
  const parsed = parseLeanPlaceholderLine(line.text);
  if (!parsed) return null;
  return new LeanPlaceholderValue(parsed.tag, canonicalLeanSelector(parsed.selector))
    .range(line.from + parsed.commandFrom, line.from + parsed.commandTo);
}

function scanLeanPlaceholderIndex(doc: Text): RangeSet<LeanPlaceholderValue> {
  const builder = new RangeSetBuilder<LeanPlaceholderValue>();
  for (let lineNo = 1; lineNo <= doc.lines; lineNo++) {
    const placeholder = leanPlaceholderRangeForLine(doc, lineNo);
    if (placeholder) builder.add(placeholder.from, placeholder.to, placeholder.value);
  }
  return builder.finish();
}

function leanPlaceholderFromRange(from: number, to: number, value: LeanPlaceholderValue): LeanPlaceholder {
  return { from, to, tag: value.tag, selector: value.selector };
}

function findLeanPlaceholder(
  index: RangeSet<LeanPlaceholderValue>,
  predicate: (placeholder: LeanPlaceholder) => boolean,
): LeanPlaceholder | null {
  const cursor = index.iter();
  while (cursor.value) {
    const placeholder = leanPlaceholderFromRange(cursor.from, cursor.to, cursor.value);
    if (predicate(placeholder)) return placeholder;
    cursor.next();
  }
  return null;
}

function changedLineNumbers(doc: Text, changes: ChangeSet): Set<number> {
  const out = new Set<number>();
  changes.iterChanges((_fromA, _toA, fromB, toB) => {
    const startLine = doc.lineAt(Math.max(0, Math.min(fromB, doc.length))).number;
    const endLine = doc.lineAt(Math.max(0, Math.min(toB, doc.length))).number;
    for (let lineNo = startLine; lineNo <= endLine; lineNo++) out.add(lineNo);
  });
  return out;
}

function stopEmbeddedEvent(event: Event): void {
  event.stopPropagation();
  event.stopImmediatePropagation();
}

function stopEmbeddedKeyboardEvent(event: Event): void {
  if (event instanceof KeyboardEvent) {
    const primaryMod = /Mac/.test(navigator.platform)
      ? event.metaKey && !event.ctrlKey
      : event.ctrlKey && !event.metaKey;
    if (event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey && event.key === "Enter") return;
    if (primaryMod && !event.shiftKey && !event.altKey && event.key.toLowerCase() === "l") return;
    event.stopPropagation();
    event.stopImmediatePropagation();
  }
}

type NativeCaretPosition = { node: Node; offset: number };

function nativeCaretPositionFromPoint(x: number, y: number): NativeCaretPosition | null {
  const doc = document as Document & {
    caretPositionFromPoint?: (x: number, y: number) => { offsetNode: Node; offset: number } | null;
    caretRangeFromPoint?: (x: number, y: number) => globalThis.Range | null;
  };
  const caret = doc.caretPositionFromPoint?.(x, y);
  if (caret?.offsetNode) return { node: caret.offsetNode, offset: caret.offset };
  const range = doc.caretRangeFromPoint?.(x, y);
  if (range) return { node: range.startContainer, offset: range.startOffset };
  return null;
}

function eventTargetElement(target: EventTarget | Node | null): Element | null {
  if (target instanceof Element) return target;
  if (target instanceof globalThis.Text) return target.parentElement;
  return null;
}

// Shadow DOM isolates native caret position from CM6's own posAtCoords, causing
// click-to-caret drift. Re-dispatch with the correct anchor when they diverge.
// Shadow-DOM-only — any future shadow widget that embeds a CM6 view needs the same.
function calibrateLeanEditorClick(view: EditorView, event: MouseEvent): boolean {
  if (event.button !== 0 || event.shiftKey || event.metaKey || event.ctrlKey || event.altKey) return false;
  const target = eventTargetElement(event.target);
  if (target?.closest("input, textarea, select, button, a, [contenteditable='true']")) return false;
  const caret = nativeCaretPositionFromPoint(event.clientX, event.clientY);
  if (!caret || !view.contentDOM.contains(caret.node)) return false;
  let anchor = 0;
  try {
    anchor = view.posAtDOM(caret.node, caret.offset);
  } catch {
    return false;
  }
  const mapped = view.posAtCoords({ x: event.clientX, y: event.clientY });
  if (mapped != null && Math.abs(mapped - anchor) <= 1) return false;
  event.preventDefault();
  event.stopPropagation();
  window.setTimeout(() => {
    if (!view.dom.isConnected) return;
    view.dispatch({ selection: { anchor }, scrollIntoView: true });
    view.focus();
  }, 0);
  return true;
}

function publishLeanRegionInfoview(detail: LeanRegionInfoviewEvent): void {
  window.dispatchEvent(new CustomEvent("aaronnote:lean-region-infoview", { detail }));
}

let lastPublishedLeanRegionActive = "";

function publishLeanRegionActive(notePath: string, tag: string, selector = "", leanPath = ""): void {
  const key = `${notePath}\n${selector}\n${tag}\n${leanPath}`;
  if (key === lastPublishedLeanRegionActive) return;
  lastPublishedLeanRegionActive = key;
  window.dispatchEvent(new CustomEvent("aaronnote:lean-region-active", {
    detail: { notePath, tag, selector, leanPath },
  }));
}

function fullLineNumberForLocalLine(ctx: LeanContext, localLineNumber: number): string {
  if (!ctx.region) return String(localLineNumber);
  return String(offsetToPosition(ctx.leanText, ctx.region.bodyFrom).line + localLineNumber);
}

function leanCopilotEditor(view: EditorView): CopilotEditorLike {
  const selection = (): { from: number; to: number } => {
    const range = view.state.selection.main;
    return { from: range.from, to: range.to };
  };
  return {
    getMarkdown: () => view.state.doc.toString(),
    getMarkdownSelection: selection,
    getSelection: selection,
    insertText(text: string, deleteBefore = 0) {
      const range = view.state.selection.main;
      const from = Math.max(0, range.from - Math.max(0, deleteBefore));
      const to = range.to;
      view.dispatch({
        changes: { from, to, insert: text },
        selection: { anchor: from + text.length },
        scrollIntoView: true,
      });
      view.focus();
      return { from, to: from + text.length };
    },
    cursorContext(maxChars = 800) {
      const pos = view.state.selection.main.to;
      const from = Math.max(0, pos - maxChars);
      const to = Math.min(view.state.doc.length, pos + maxChars);
      const rect = view.coordsAtPos(pos);
      return {
        before: view.state.doc.sliceString(from, pos),
        after: view.state.doc.sliceString(pos, to),
        rect: rect ? { left: rect.left, top: rect.top, bottom: rect.bottom } : null,
      };
    },
    revealCursor() {
      view.dispatch({ effects: EditorView.scrollIntoView(view.state.selection.main.head) });
    },
  };
}

function shadowStyles(): HTMLStyleElement {
  const style = document.createElement("style");
  style.textContent = `
    :host { all: initial; display: block; box-sizing: border-box; padding: 10px 0; }
    .lean-card {
      display: block;
      position: relative;
      border: 1px solid #3a3530;
      background: #171615;
      color: #e8e2da;
      font-family: "Fira Code", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      margin: 0;
    }
    .lean-card.is-error { border-color: #7f1d1d; }
    .lean-head {
      display: flex;
      align-items: center;
      gap: 8px;
      min-height: 28px;
      padding: 0 10px;
      border-bottom: 1px solid #3a3530;
      background: #2a2724;
      box-sizing: border-box;
    }
    .lean-label {
      color: #c8b5e8;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
    }
    .lean-tag { color: #f9e2af; font-size: 11px; }
    .lean-status { margin-left: auto; color: #9b928a; font-size: 11px; }
    .lean-host .cm-editor {
      background: #1e1c1a;
      color: #e8e2da;
      border: 0;
      outline: none;
    }
    .lean-host .cm-editor.cm-focused { outline: none; }
    .lean-host .cm-line { color: #e8e2da; }
    .lean-host .cm-scroller { font-family: inherit; caret-color: #ffffff; }
    .lean-host .cm-content {
      min-height: 56px;
      padding: 8px 12px 10px;
      font-size: 13px;
      line-height: 1.6;
      caret-color: #ffffff !important;
    }
    .lean-host .cm-cursorLayer,
    .lean-host .cm-selectionLayer {
      pointer-events: none;
      z-index: 20;
    }
    .lean-host .cm-focused .cm-cursorLayer {
      visibility: visible !important;
    }
    .lean-host .cm-gutters {
      background: #191715 !important;
      color: #736a62 !important;
      border-right: 1px solid #342f2a !important;
      padding-right: 2px;
      font-size: 12px;
    }
    .lean-host .cm-lineNumbers .cm-gutterElement {
      min-width: 30px;
      padding: 0 8px 0 7px;
      color: #7b736b !important;
      font-weight: 600;
      font-variant-numeric: tabular-nums;
      text-align: right;
    }
    .lean-host .cm-lean-status-gutter .cm-gutterElement {
      box-sizing: border-box;
      min-width: 22px;
      padding: 0 2px;
      text-align: center;
    }
    .lean-host .cm-lean-status-sign {
      display: inline-block;
      width: 1.25em;
      font-family: "Fira Code", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 13px;
      line-height: inherit;
      text-align: center;
    }
    .lean-host .cm-lean-status-sign--success { color: #facc15; }
    .lean-host .cm-lean-status-sign--error { color: #f87171; }
    .lean-host .cm-lean-status-sign--warning { color: #fbbf24; }
    .lean-host .cm-lean-status-sign--info { color: #60a5fa; }
    .lean-host .cm-lean-status-sign--processing { color: #67e8f9; }
    .lean-host .cm-lean-status-sign--blocked { color: #fb7185; }
    .lean-host .cm-activeLineGutter {
      background: #24211e !important;
      color: #e0d2be !important;
      box-shadow: inset 2px 0 0 #b88a4a;
    }
    .lean-host .cm-activeLine {
      background: rgb(255 255 255 / 2.5%);
    }
    .lean-host .cm-cursor,
    .lean-host .cm-dropCursor {
      display: block !important;
      visibility: visible !important;
      border-left: 2px solid #f8f1e8 !important;
      border-left-color: #f8f1e8 !important;
    }
    .lean-host .cm-editor.cm-focused .cm-cursor,
    .lean-host .cm-editor.cm-focused .cm-dropCursor {
      border-left: 2px solid #ffffff !important;
    }
    .lean-host .cm-editor[data-lean-vim-mode="normal"] .cm-cursor,
    .lean-host .cm-editor[data-lean-vim-mode="normal"] .cm-dropCursor,
    .lean-host .cm-editor[data-lean-vim-mode="visual"] .cm-cursor,
    .lean-host .cm-editor[data-lean-vim-mode="visual"] .cm-dropCursor,
    .lean-host .cm-editor[data-lean-vim-mode="visual-line"] .cm-cursor,
    .lean-host .cm-editor[data-lean-vim-mode="visual-line"] .cm-dropCursor {
      border-left: 3px solid #fb4058 !important;
      border-left-color: #fb4058 !important;
    }
    .lean-host .cm-editor[data-lean-vim-mode="normal"] .cm-activeLine,
    .lean-host .cm-editor[data-lean-vim-mode="visual"] .cm-activeLine,
    .lean-host .cm-editor[data-lean-vim-mode="visual-line"] .cm-activeLine {
      background: rgba(178, 13, 34, 0.18) !important;
    }
    .lean-host .cm-editor[data-lean-vim-mode="normal"] .cm-activeLineGutter,
    .lean-host .cm-editor[data-lean-vim-mode="visual"] .cm-activeLineGutter,
    .lean-host .cm-editor[data-lean-vim-mode="visual-line"] .cm-activeLineGutter {
      box-shadow: inset 3px 0 0 #fb4058;
    }
    .lean-host .cm-selectionBackground,
    .lean-host .cm-focused .cm-selectionBackground,
    .lean-host ::selection {
      background: #315f8f !important;
      color: #ffffff !important;
    }
    .lean-host .cm-tooltip-autocomplete ul li[aria-selected] {
      background: #315f8f;
      color: #ffffff;
    }
    .cm-tooltip {
      background: #171615 !important;
      color: #f4eee7 !important;
      border: 1px solid #4a433d !important;
      box-shadow: 0 14px 34px rgb(0 0 0 / 36%) !important;
    }
    .cm-tooltip .cm-completionLabel,
    .cm-tooltip .cm-completionDetail,
    .cm-tooltip .cm-completionIcon {
      color: inherit;
      background: transparent;
    }
    .cm-tooltip-hover,
    .cm-tooltip.cm-tooltip-hover,
    .cm-tooltip .cm-tooltip-hover,
    .cm-lean-hover-tooltip {
      background: #171615 !important;
      color: #f4eee7 !important;
    }
    .cm-tooltip-autocomplete {
      box-sizing: border-box;
      max-width: min(760px, calc(100vw - 32px));
      max-height: 330px;
      overflow: hidden;
      background: #171615 !important;
      color: #f4eee7 !important;
      box-shadow: 0 14px 34px rgb(0 0 0 / 36%);
    }
    .cm-tooltip-autocomplete ul {
      background: #1f1d1a !important;
      color: #f4eee7 !important;
      max-height: 320px;
      scrollbar-color: #7a7068 #2a2724;
    }
    .cm-tooltip-autocomplete ul li {
      color: #f4eee7 !important;
      background: #1f1d1a !important;
      opacity: 1;
    }
    .cm-tooltip-autocomplete ul li[aria-selected] {
      background: #1f5fbf !important;
      color: #ffffff !important;
    }
    .cm-tooltip-autocomplete .cm-completionIcon {
      color: #9cc7ff;
      opacity: 1;
    }
    .cm-tooltip-autocomplete .cm-completionIcon::after {
      display: inline-block;
      width: 1.15em;
      text-align: center;
      font-style: normal;
      font-weight: 700;
    }
    .cm-tooltip-autocomplete .cm-completionIcon-method::after { content: "◆"; color: #60a5fa; }
    .cm-tooltip-autocomplete .cm-completionIcon-function::after { content: "ƒ"; color: #60a5fa; }
    .cm-tooltip-autocomplete .cm-completionIcon-variable::after { content: "𝑥"; color: #e8e2da; }
    .cm-tooltip-autocomplete .cm-completionIcon-class::after { content: "C"; color: #fbbf24; }
    .cm-tooltip-autocomplete .cm-completionIcon-interface::after { content: "I"; color: #fbbf24; }
    .cm-tooltip-autocomplete .cm-completionIcon-type::after { content: "T"; color: #fbbf24; }
    .cm-tooltip-autocomplete .cm-completionIcon-namespace::after { content: "□"; color: #c084fc; }
    .cm-tooltip-autocomplete .cm-completionIcon-property::after { content: "·"; color: #34d399; }
    .cm-tooltip-autocomplete .cm-completionIcon-constant::after { content: "π"; color: #34d399; }
    .cm-tooltip-autocomplete .cm-completionIcon-enum::after { content: "E"; color: #fbbf24; }
    .cm-tooltip-autocomplete .cm-completionIcon-keyword::after { content: "K"; color: #c084fc; }
    .cm-tooltip-autocomplete .cm-completionIcon-snippet::after { content: "✂"; color: #f59e0b; }
    .cm-tooltip-autocomplete .cm-completionIcon-text::after { content: "a"; color: #c8c1b8; }
    .cm-tooltip-autocomplete .cm-completionLabel,
    .cm-tooltip-autocomplete .cm-completionDetail {
      color: inherit;
      opacity: 1;
    }
    .cm-tooltip-autocomplete .cm-completionDetail {
      color: #c8c1b8;
    }
    .cm-tooltip-autocomplete ul li[aria-selected] .cm-completionDetail {
      color: #eaf2ff;
    }
    .lean-host .cm-completionMatchedText {
      color: #facc15;
      text-decoration: none;
    }
    .lean-host .cm-lean-ts-keyword { color: #f0b45f; font-weight: 600; }
    .lean-host .cm-lean-ts-function,
    .lean-host .cm-lean-ts-function-builtin,
    .lean-host .cm-lean-ts-function-definition { color: #d6b36a; font-weight: 600; }
    .lean-host .cm-lean-ts-variable,
    .lean-host .cm-lean-ts-variable-parameter { color: #e8e2da; }
    .lean-host .cm-lean-ts-type,
    .lean-host .cm-lean-ts-constructor,
    .lean-host .cm-lean-ts-constant { color: #a7d39b; }
    .lean-host .cm-lean-ts-string { color: #9fd18b; }
    .lean-host .cm-lean-ts-comment {
      color: #6fa878;
      font-style: italic;
    }
    .lean-host .cm-lean-ts-number { color: #93c5fd; }
    .lean-host .cm-lean-ts-operator,
    .lean-host .cm-lean-ts-punctuation,
    .lean-host .cm-lean-ts-punctuation-bracket,
    .lean-host .cm-lean-ts-punctuation-delimiter {
      color: #a7b0bd;
    }
    .lean-host .cm-lean-token-keyword,
    .lean-host .cm-lean-token-macro { color: #c084fc; font-weight: 600; }
    .lean-host .cm-lean-token-command,
    .lean-host .cm-lean-token-function,
    .lean-host .cm-lean-token-method { color: #60a5fa; font-weight: 600; }
    .lean-host .cm-lean-token-tactic,
    .lean-host .cm-lean-token-constant { color: #34d399; }
    .lean-host .cm-lean-token-namespace,
    .lean-host .cm-lean-token-type,
    .lean-host .cm-lean-token-class,
    .lean-host .cm-lean-token-struct,
    .lean-host .cm-lean-token-typeparameter { color: #fbbf24; }
    .lean-host .cm-lean-token-variable,
    .lean-host .cm-lean-token-parameter,
    .lean-host .cm-lean-token-property { color: #e8e2da; }
    .lean-host .cm-lean-token-string { color: #fca5a5; }
    .lean-host .cm-lean-token-comment { color: #6fa878; font-style: italic; }
    .lean-host .cm-lean-token-number { color: #93c5fd; }
    .lean-host .cm-lean-token-operator,
    .lean-host .cm-lean-token-punctuation {
      color: #a7b0bd;
    }
    .lean-host .cm-lean-diag {
      text-decoration-line: underline;
      text-decoration-style: wavy;
      text-underline-offset: 3px;
    }
    .lean-host .cm-lean-diag--error { text-decoration-color: #f87171; }
    .lean-host .cm-lean-diag--warning { text-decoration-color: #fbbf24; }
    .lean-host .cm-lean-diag--info { text-decoration-color: #60a5fa; }
    .cm-tooltip,
    .cm-tooltip-autocomplete,
    .lean-host .cm-tooltip,
    .lean-host .cm-tooltip-autocomplete {
      background: #171615 !important;
      color: #f4eee7 !important;
      border: 1px solid #4a433d !important;
      font-family: inherit;
      z-index: 1000;
    }
    .cm-lean-hover-tooltip,
    .lean-host .cm-lean-hover-tooltip {
      box-sizing: border-box;
      max-width: min(560px, calc(100vw - 32px));
      max-height: min(48vh, 420px);
      overflow: auto;
      white-space: normal;
    }
    .cm-lean-hover-tooltip pre,
    .lean-host .cm-lean-hover-tooltip pre {
      margin: 0;
      max-width: 100%;
      white-space: pre-wrap;
      font-family: inherit;
      font-size: 12px;
      line-height: 1.45;
      color: #f4eee7 !important;
    }
    .cm-lean-completion-info {
      padding: 6px 10px;
      max-width: min(420px, calc(100vw - 48px));
      max-height: min(220px, calc(100vh - 96px));
      overflow: auto;
      font-family: inherit;
    }
    .cm-lean-completion-type {
      margin: 0 0 6px;
      font-size: 12px;
      line-height: 1.45;
      color: #93c5fd;
      white-space: pre-wrap;
    }
    .cm-lean-completion-doc {
      margin: 0;
      max-height: 150px;
      overflow: auto;
      font-size: 12px;
      line-height: 1.5;
      color: #c8c1b8;
      white-space: pre-wrap;
    }
    .cm-lean-completion-info .cm-lean-completion-type:only-child {
      margin-bottom: 0;
    }
    .lean-render-code {
      display: grid;
      gap: 2px;
      white-space: pre-wrap;
      color: #f4eee7;
    }
    .lean-render-line--target {
      margin-top: 5px;
      padding-top: 5px;
      border-top: 1px solid #4a433d;
      color: #fecaca;
      font-weight: 650;
    }
    .lean-render-paragraph {
      margin: 0 0 6px;
      color: #e7ded4;
      white-space: normal;
    }
    .lean-render-paragraph:last-child {
      margin-bottom: 0;
    }
    .lean-render-inline-code {
      color: #93c5fd;
      background: #25211d;
      border-radius: 3px;
      padding: 0 3px;
    }
    .lean-render-name { color: #93c5fd; font-weight: 700; }
    .lean-render-punct,
    .cm-lean-ts-punctuation,
    .cm-lean-ts-punctuation-bracket,
    .cm-lean-ts-punctuation-delimiter,
    .cm-lean-ts-operator { color: #a7b0bd; }
    .cm-lean-ts-keyword { color: #f0b45f; font-weight: 650; }
    .cm-lean-ts-function,
    .cm-lean-ts-function-builtin,
    .cm-lean-ts-function-definition { color: #d6b36a; font-weight: 650; }
    .cm-lean-ts-variable,
    .cm-lean-ts-variable-parameter { color: #f4eee7; }
    .cm-lean-ts-type,
    .cm-lean-ts-constructor,
    .cm-lean-ts-constant { color: #a7d39b; }
    .cm-lean-ts-string { color: #9fd18b; }
    .cm-lean-ts-comment { color: #6fa878; font-style: italic; }
    .cm-lean-ts-number { color: #93c5fd; }
  `;
  return style;
}

function tooltipStyles(): HTMLStyleElement {
  const style = document.createElement("style");
  style.textContent = `
    .lean-editor-tooltips {
      position: fixed;
      top: 0;
      left: 0;
      width: 0;
      height: 0;
      overflow: visible;
      z-index: 99999;
    }
    .lean-editor-tooltips .cm-tooltip {
      background: #171615 !important;
      color: #f4eee7 !important;
      border: 1px solid #4a433d !important;
      box-shadow: 0 14px 34px rgb(0 0 0 / 36%) !important;
      font-family: "Fira Code", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      z-index: 99999 !important;
    }
    .lean-editor-tooltips .cm-tooltip-autocomplete .cm-completionLabel,
    .lean-editor-tooltips .cm-tooltip-autocomplete .cm-completionDetail,
    .lean-editor-tooltips .cm-tooltip-autocomplete .cm-completionIcon {
      color: inherit;
    }
    .lean-editor-tooltips .cm-tooltip-autocomplete {
      box-sizing: border-box;
      max-width: min(760px, calc(100vw - 32px));
      max-height: 330px;
      overflow: hidden;
      background: #171615 !important;
      color: #f4eee7 !important;
      box-shadow: 0 14px 34px rgb(0 0 0 / 36%);
    }
    .lean-editor-tooltips .cm-tooltip-autocomplete ul {
      background: #1f1d1a !important;
      color: #f4eee7 !important;
      max-height: 320px;
      scrollbar-color: #7a7068 #2a2724;
    }
    .lean-editor-tooltips .cm-tooltip-autocomplete ul li {
      color: #f4eee7 !important;
      background: #1f1d1a !important;
      opacity: 1;
    }
    .lean-editor-tooltips .cm-tooltip-autocomplete ul li[aria-selected] {
      background: #1f5fbf !important;
      color: #ffffff !important;
    }
    .lean-editor-tooltips .cm-tooltip-autocomplete .cm-completionIcon { color: #9cc7ff; opacity: 1; }
    .lean-editor-tooltips .cm-tooltip-autocomplete .cm-completionLabel,
    .lean-editor-tooltips .cm-tooltip-autocomplete .cm-completionDetail { color: inherit; opacity: 1; }
    .lean-editor-tooltips .cm-tooltip-autocomplete .cm-completionDetail { color: #c8c1b8; }
    .lean-editor-tooltips .cm-tooltip-autocomplete ul li[aria-selected] .cm-completionDetail { color: #eaf2ff; }
    .lean-editor-tooltips .cm-completionMatchedText { color: #facc15; text-decoration: none; }
    .lean-editor-tooltips[data-lean-hide-completion-info="true"] .cm-completionInfo {
      display: none !important;
    }
    .lean-editor-tooltips .cm-lean-hover-tooltip {
      box-sizing: border-box;
      max-width: min(560px, calc(100vw - 32px));
      max-height: min(48vh, 420px);
      overflow: auto;
      white-space: normal;
    }
    .lean-editor-tooltips .cm-lean-hover-tooltip pre {
      margin: 0;
      max-width: 100%;
      white-space: pre-wrap;
      font-family: "Fira Code", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      font-size: 12px;
      line-height: 1.45;
      color: #f4eee7 !important;
    }
    .lean-editor-tooltips .cm-lean-completion-info {
      padding: 6px 10px;
      max-width: min(420px, calc(100vw - 48px));
      max-height: min(220px, calc(100vh - 96px));
      overflow: auto;
      font-family: "Fira Code", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }
    .lean-editor-tooltips .cm-lean-completion-type {
      margin: 0 0 6px;
      font-size: 12px;
      line-height: 1.45;
      color: #93c5fd;
      white-space: pre-wrap;
    }
    .lean-editor-tooltips .cm-lean-completion-doc {
      margin: 0;
      max-height: 150px;
      overflow: auto;
      font-size: 12px;
      line-height: 1.5;
      color: #c8c1b8;
      white-space: pre-wrap;
    }
    .lean-editor-tooltips .cm-lean-completion-info .cm-lean-completion-type:only-child { margin-bottom: 0; }
    .lean-editor-tooltips .cm-completionInfo {
      background: #1a1816 !important;
      border: 1px solid #4a433d !important;
      border-left: none !important;
      box-shadow: 4px 4px 16px rgb(0 0 0 / 40%) !important;
      max-width: min(420px, calc(100vw - 48px));
      max-height: min(220px, calc(100vh - 96px));
      overflow-y: auto;
      font-family: "Fira Code", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
    }
    .lean-editor-tooltips .cm-lean-completion-kind {
      display: inline-block;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #a78bfa;
      margin-bottom: 5px;
    }
    .lean-editor-tooltips .lean-render-code {
      display: grid;
      gap: 2px;
      white-space: pre-wrap;
      color: #f4eee7;
    }
    .lean-editor-tooltips .lean-render-line--target {
      margin-top: 5px;
      padding-top: 5px;
      border-top: 1px solid #4a433d;
      color: #fecaca;
      font-weight: 650;
    }
    .lean-editor-tooltips .lean-render-paragraph {
      margin: 0 0 6px;
      color: #e7ded4;
      white-space: normal;
    }
    .lean-editor-tooltips .lean-render-paragraph:last-child { margin-bottom: 0; }
    .lean-editor-tooltips .lean-render-inline-code {
      color: #93c5fd;
      background: #25211d;
      border-radius: 3px;
      padding: 0 3px;
    }
    .lean-editor-tooltips .lean-render-name { color: #93c5fd; font-weight: 700; }
    .lean-editor-tooltips .lean-render-punct,
    .lean-editor-tooltips .cm-lean-ts-punctuation,
    .lean-editor-tooltips .cm-lean-ts-punctuation-bracket,
    .lean-editor-tooltips .cm-lean-ts-punctuation-delimiter,
    .lean-editor-tooltips .cm-lean-ts-operator { color: #a7b0bd; }
    .lean-editor-tooltips .cm-lean-ts-keyword { color: #f0b45f; font-weight: 650; }
    .lean-editor-tooltips .cm-lean-ts-function,
    .lean-editor-tooltips .cm-lean-ts-function-builtin,
    .lean-editor-tooltips .cm-lean-ts-function-definition { color: #d6b36a; font-weight: 650; }
    .lean-editor-tooltips .cm-lean-ts-variable,
    .lean-editor-tooltips .cm-lean-ts-variable-parameter { color: #f4eee7; }
    .lean-editor-tooltips .cm-lean-ts-type,
    .lean-editor-tooltips .cm-lean-ts-constructor,
    .lean-editor-tooltips .cm-lean-ts-constant { color: #a7d39b; }
    .lean-editor-tooltips .cm-lean-ts-string { color: #9fd18b; }
    .lean-editor-tooltips .cm-lean-ts-comment { color: #6fa878; font-style: italic; }
    .lean-editor-tooltips .cm-lean-ts-number { color: #93c5fd; }
  `;
  return style;
}

const leanDiagnosticsField = StateField.define<LeanDiagnosticMark[]>({
  create: () => [],
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(SetLeanDiagnostics)) return effect.value;
    }
    return tr.docChanged
      ? value.map((diag) => ({
        ...diag,
        from: tr.changes.mapPos(diag.from, -1),
        to: tr.changes.mapPos(diag.to, 1),
      }))
      : value;
  },
});

const leanProgressField = StateField.define<LeanProgressMark[]>({
  create: () => [],
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(SetLeanProgress)) return effect.value;
    }
    if (!tr.docChanged || value.length === 0) return value;
    return value.map((mark) => ({
      from: tr.changes.mapPos(mark.from, -1),
      to: tr.changes.mapPos(mark.to, 1),
      kind: mark.kind,
    }));
  },
});

const leanGoalStatusField = StateField.define<LeanGoalStatusMark | null>({
  create: () => null,
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(SetLeanGoalStatus)) return effect.value;
    }
    if (!value || !tr.docChanged) return value;
    return { from: tr.changes.mapPos(value.from, -1) };
  },
});

const leanDiagnosticDecorations = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(SetLeanDiagnostics)) {
        return Decoration.set(effect.value
          .filter((diag) => diag.from < diag.to)
          .map((diag) => Decoration.mark({
            class: `cm-lean-diag cm-lean-diag--${diag.severity}`,
            attributes: { title: diag.message },
          }).range(diag.from, diag.to)), true);
      }
    }
    return tr.docChanged ? value.map(tr.changes) : value;
  },
  provide: (field) => EditorView.decorations.from(field),
});

type LeanStatusSignKind = "processing" | "success" | "info" | "warning" | "blocked" | "error";

const leanStatusSignRank: Record<LeanStatusSignKind, number> = {
  processing: 0,
  info: 1,
  success: 2,
  warning: 3,
  blocked: 4,
  error: 5,
};

const leanStatusSignText: Record<LeanStatusSignKind, string> = {
  processing: "⋯",
  success: "✓",
  info: "i",
  warning: "!",
  blocked: "⊘",
  error: "×",
};

class LeanStatusGutterMarker extends GutterMarker {
  readonly kind: LeanStatusSignKind;
  readonly title: string;

  constructor(kind: LeanStatusSignKind, title: string) {
    super();
    this.kind = kind;
    this.title = title;
  }

  eq(other: GutterMarker): boolean {
    return other instanceof LeanStatusGutterMarker
      && other.kind === this.kind
      && other.title === this.title;
  }

  toDOM(): HTMLElement {
    const span = document.createElement("span");
    span.className = `cm-lean-status-sign cm-lean-status-sign--${this.kind}`;
    span.textContent = leanStatusSignText[this.kind];
    if (this.title) span.title = this.title;
    return span;
  }
}

const leanStatusGutterSpacer = new LeanStatusGutterMarker("error", "");

function setLeanStatusSign(
  byLine: Map<number, { kind: LeanStatusSignKind; title: string }>,
  lineNo: number,
  kind: LeanStatusSignKind,
  title: string,
): void {
  const previous = byLine.get(lineNo);
  if (previous && leanStatusSignRank[previous.kind] >= leanStatusSignRank[kind]) return;
  byLine.set(lineNo, { kind, title });
}

function addLeanStatusRange(
  state: EditorState,
  byLine: Map<number, { kind: LeanStatusSignKind; title: string }>,
  from: number,
  to: number,
  kind: LeanStatusSignKind,
  title: string,
): void {
  const start = Math.max(0, Math.min(state.doc.length, from));
  const end = Math.max(start, Math.min(state.doc.length, to > from ? to - 1 : from));
  const startLine = state.doc.lineAt(start).number;
  const endLine = state.doc.lineAt(end).number;
  for (let lineNo = startLine; lineNo <= endLine; lineNo++) {
    setLeanStatusSign(byLine, lineNo, kind, title);
  }
}

function diagnosticStatusSignKind(diag: LeanDiagnosticMark): LeanStatusSignKind {
  if (diag.leanTags.includes("goalsAccomplished")) return "success";
  if (diag.leanTags.includes("unsolvedGoals")) return "error";
  return diag.severity;
}

function diagnosticStatusTitle(diag: LeanDiagnosticMark): string {
  if (diag.leanTags.includes("goalsAccomplished")) return diag.message || "Goals accomplished";
  if (diag.leanTags.includes("unsolvedGoals")) return diag.message || "Unsolved goals";
  return diag.message;
}

function progressStatusSignKind(mark: LeanProgressMark): LeanStatusSignKind {
  return mark.kind === "fatalError" ? "blocked" : "processing";
}

function progressStatusTitle(mark: LeanProgressMark): string {
  return mark.kind === "fatalError"
    ? "Lean hit a fatal file-processing error"
    : "Lean is elaborating this range";
}

function buildLeanStatusGutter(state: EditorState): RangeSet<GutterMarker> {
  const byLine = new Map<number, { kind: LeanStatusSignKind; title: string }>();
  const progress = state.field(leanProgressField, false) ?? [];
  const diagnostics = state.field(leanDiagnosticsField, false) ?? [];
  const goalStatus = state.field(leanGoalStatusField, false);

  for (const mark of progress) {
    addLeanStatusRange(state, byLine, mark.from, mark.to, progressStatusSignKind(mark), progressStatusTitle(mark));
  }
  if (goalStatus) {
    addLeanStatusRange(state, byLine, goalStatus.from, goalStatus.from, "success", "Goals accomplished");
  }
  for (const diag of diagnostics) {
    addLeanStatusRange(state, byLine, diag.from, diag.to, diagnosticStatusSignKind(diag), diagnosticStatusTitle(diag));
  }

  const builder = new RangeSetBuilder<GutterMarker>();
  for (const [lineNo, sign] of Array.from(byLine.entries()).sort((a, b) => a[0] - b[0])) {
    if (lineNo < 1 || lineNo > state.doc.lines) continue;
    const line = state.doc.line(lineNo);
    builder.add(line.from, line.from, new LeanStatusGutterMarker(sign.kind, sign.title));
  }
  return builder.finish();
}

const leanStatusGutterField = StateField.define<RangeSet<GutterMarker>>({
  create: () => RangeSet.empty,
  update(value, tr) {
    const affected = tr.effects.some((effect) =>
      effect.is(SetLeanDiagnostics) || effect.is(SetLeanProgress) || effect.is(SetLeanGoalStatus));
    if (affected) return buildLeanStatusGutter(tr.state);
    return tr.docChanged ? value.map(tr.changes) : value;
  },
});

const leanStatusGutter = gutter({
  class: "cm-lean-status-gutter",
  markers: (view) => view.state.field(leanStatusGutterField),
  initialSpacer: () => leanStatusGutterSpacer,
});

const leanTreeSitterDecorations = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(SetLeanTreeSitterSpans)) {
        return buildTreeSitterDecorations(effect.value.text, effect.value.spans);
      }
    }
    return tr.docChanged ? value.map(tr.changes) : value;
  },
  provide: (field) => EditorView.decorations.from(field),
});

const leanSemanticTokenDecorations = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(SetLeanSemanticTokens)) {
        return buildSemanticTokenDecorations(effect.value.text, effect.value.region, effect.value.legend, effect.value.data);
      }
    }
    return tr.docChanged ? value.map(tr.changes) : value;
  },
  provide: (field) => EditorView.decorations.from(field),
});

function leanTreeSitterHighlight(): Extension {
  const plugin = ViewPlugin.fromClass(class {
    private timer: ReturnType<typeof setTimeout> | null = null;
    private generation = 0;
    private readonly view: EditorView;

    constructor(view: EditorView) {
      this.view = view;
      this.schedule(0);
    }

    update(update: ViewUpdate): void {
      if (update.docChanged) this.schedule(80);
    }

    destroy(): void {
      if (this.timer) clearTimeout(this.timer);
      this.generation++;
    }

    private schedule(delay: number): void {
      if (this.timer) clearTimeout(this.timer);
      const generation = ++this.generation;
      this.timer = setTimeout(() => {
        this.timer = null;
        const text = this.view.state.doc.toString();
        void parseLeanTreeSitter(text)
          .then((spans) => {
            if (generation !== this.generation) return;
            this.view.dispatch({ effects: SetLeanTreeSitterSpans.of({ text, spans }) });
          })
          .catch(() => {});
      }, delay);
    }
  });

  return [leanTreeSitterDecorations, plugin];
}

function leanCompletionSource(ctx: LeanContext) {
  return async (context: CompletionContext) => {
    if (!ctx.leanPath || !ctx.region) return null;
    const token = context.matchBefore(/[\\#A-Za-z0-9_.'?!<>\-]+/);
    if (!context.explicit && !token) return null;
    await ctx.syncForLsp?.();
    if (!await ctx.ensureLspOpen?.()) return null;
    if (context.aborted) return null;
    if (!ctx.leanPath || !ctx.region) return null;
    const fullOffset = localOffsetToFull(ctx, context.pos);
    if (fullOffset == null) return null;
    const pos = offsetToPosition(ctx.leanText, fullOffset);
    const triggerCharacter = context.pos > 0 ? context.state.doc.sliceString(context.pos - 1, context.pos) : "";
    const raw = await api.lean.getCompletions({
      leanPath: ctx.leanPath,
      line: pos.line,
      character: pos.character,
      triggerCharacter: triggerCharacter === "." ? "." : undefined,
    });
    if (context.aborted) return null;
    const result = (raw as { result?: { items?: unknown[] } | unknown[] } | null)?.result;
    const items = Array.isArray(result) ? result : Array.isArray((result as { items?: unknown[] } | null)?.items) ? (result as { items: unknown[] }).items : [];
    const tokenText = token?.text ?? "";
    const lastDot = tokenText.lastIndexOf(".");
    const from = lastDot >= 0 ? (token?.from ?? context.pos) + lastDot + 1 : (token?.from ?? context.pos);
    const lspOptions: Completion[] = items.map((item) => {
      const c = item as LspCompletionItem;
      const label = String(c.label ?? "");
      const typeDetail = stripHoverFence(completionDetailText(c));
      const docText = stripHoverFence(completionDocumentation(c));
      return {
        label,
        apply: (view: EditorView, completion: Completion, completionFrom: number, completionTo: number) => {
          applyLeanCompletion(ctx, c, view, completion, completionFrom, completionTo);
        },
        boost: c.filterText && c.filterText !== label ? 1 : undefined,
        detail: typeDetail ? leanSummary(typeDetail, 120) : undefined,
        info: async () => {
          const resolved = await resolveCompletion(c);
          const cleanType = stripHoverFence(completionDetailText(resolved));
          const cleanDoc = stripHoverFence(completionDocumentation(resolved));
          return renderCompletionInfo(completionKindName(resolved.kind ?? c.kind), cleanType || typeDetail, cleanDoc || docText);
        },
        type: completionType(c.kind),
      };
    }).filter((item) => item.label);
    const snippets = await leanSnippetCompletions();
    if (context.aborted) return null;
    return {
      from,
      validFor: /^[\\#A-Za-z0-9_'?!<>\-]*$/,
      options: [...lspOptions, ...snippets],
    };
  };
}

async function leanHoverText(ctx: LeanContext, localPos: number): Promise<string> {
  if (!ctx.leanPath || !ctx.region) return "";
  await ctx.syncForLsp?.();
  if (!await ctx.ensureLspOpen?.()) return "";
  const fullOffset = localOffsetToFull(ctx, localPos);
  if (fullOffset == null) return "";
  const pos = offsetToPosition(ctx.leanText, fullOffset);
  const raw = await api.lean.getHover({
    leanPath: ctx.leanPath,
    line: pos.line,
    character: pos.character,
  });
  const hover = raw as { result?: { contents?: string | { value?: string } } } | null;
  const contents = hover?.result?.contents;
  return typeof contents === "string" ? contents : contents?.value ?? "";
}

function leanHoverTooltip(pos: number, text: string): Tooltip {
  return {
    pos,
    above: true,
    create() {
      const dom = document.createElement("div");
      dom.className = "cm-lean-hover-tooltip";
      renderLeanMarkdown(dom, text);
      return { dom };
    },
  };
}

const leanCursorHoverField = StateField.define<Tooltip | null>({
  create: () => null,
  update(value, tr) {
    for (const effect of tr.effects) {
      if (effect.is(SetLeanCursorHover)) {
        return effect.value ? leanHoverTooltip(effect.value.pos, effect.value.text) : null;
      }
    }
    return tr.docChanged ? null : value;
  },
  provide: (field) => showTooltip.from(field),
});

function leanHover(ctx: LeanContext): Extension {
  return hoverTooltip(async (_view, hoverPos) => {
    if (!ctx.leanPath || !ctx.region) return null;
    const text = await leanHoverText(ctx, hoverPos);
    if (!text.trim()) return null;
    return leanHoverTooltip(hoverPos, text);
  });
}

function leanCursorHover(ctx: LeanContext): Extension {
  let timer: ReturnType<typeof setTimeout> | null = null;
  let seq = 0;
  let lastKey = "";
  return [
    leanCursorHoverField,
    EditorView.updateListener.of((update) => {
      if (!update.selectionSet && !update.docChanged && !update.focusChanged) return;
      if (timer) clearTimeout(timer);
      const view = update.view;
      const selection = view.state.selection.main;
      const pos = selection.head;
      const currentSeq = ++seq;
      const pointerSelection = update.transactions.some((tr) => tr.isUserEvent("select.pointer"));
      if (pointerSelection || !view.hasFocus || !selection.empty || !ctx.leanPath || !ctx.region) {
        lastKey = "";
        view.dispatch({ effects: SetLeanCursorHover.of(null) });
        return;
      }
      const key = `${pos}:${view.state.doc.length}:${ctx.leanText.length}`;
      if (key === lastKey && !update.focusChanged) return;
      lastKey = key;
      timer = setTimeout(() => {
        timer = null;
        void leanHoverText(ctx, pos)
          .then((text) => {
            if (currentSeq !== seq || !view.hasFocus || !view.state.selection.main.empty) return;
            view.dispatch({ effects: SetLeanCursorHover.of(text.trim() ? { pos, text } : null) });
          })
          .catch(() => {
            if (currentSeq === seq && view.hasFocus) {
              view.dispatch({ effects: SetLeanCursorHover.of(null) });
            }
          });
      }, 1000);
    }),
  ];
}

/**
 * Navigate to a single resolved LSP location. Targets inside an embedded
 * `-- @aaronnote` region jump through the region-jump event (current region,
 * another region, or — once the note is open — another note). Targets outside
 * any region (Mathlib/prelude, non-embedded `.lean`) open in an external
 * Kitty/Nvim window.
 */
async function navigateToLeanLocation(ctx: LeanContext, loc: LeanLocation): Promise<void> {
  const line = loc.range.start.line;
  const character = loc.range.start.character;
  const resolved = await api.lean.request("resolve-location", {
    file: loc.file,
    line,
    character,
  }) as { inRegion?: boolean; notePath?: string; external?: boolean } | null;
  // Record where we came from so the app jump stack can return here.
  window.dispatchEvent(new CustomEvent("aaronnote:lean-push-jump"));
  if (resolved?.inRegion) {
    window.dispatchEvent(new CustomEvent("aaronnote:lean-region-jump", {
      detail: {
        notePath: resolved.notePath || ctx.notePath,
        leanPath: loc.file,
        line,
        character,
      },
    }));
    return;
  }
  const result = await api.shell.openLeanLocation?.({ file: loc.file, line, character });
  if (result && result.ok === false) {
    window.dispatchEvent(new CustomEvent("aaronnote:lean-status", {
      detail: { message: result.message || "Could not open Lean location" },
    }));
  }
}

/**
 * Unified LSP navigation router for the embedded Lean editor. Reused by Cmd/Ctrl+
 * Click, Vim keys (gd/gD/gy/gi/gr/K), the context menu, and the command palette.
 * `fullPos` is a full-file Lean position (right-click target); when omitted the
 * current child cursor is used.
 */
async function runLeanLocationAction(
  ctx: LeanContext,
  view: EditorView,
  action: LeanLspAction,
  fullPos?: LeanPosition,
): Promise<void> {
  if (!ctx.leanPath || !ctx.region) return;
  await ctx.syncForLsp?.();
  if (!await ctx.ensureLspOpen?.()) return;
  const localPos = fullPos
    ? fullOffsetToLocal(ctx, positionToOffset(ctx.leanText, fullPos.line, fullPos.character)) ?? view.state.selection.main.head
    : view.state.selection.main.head;
  const fullOffset = localOffsetToFull(ctx, localPos);
  if (fullOffset == null) return;
  const pos = fullPos ?? offsetToPosition(ctx.leanText, fullOffset);

  if (action === "hover") {
    const text = await leanHoverText(ctx, localPos);
    view.dispatch({ effects: SetLeanCursorHover.of(text.trim() ? { pos: localPos, text } : null) });
    return;
  }

  const resp = await api.lean.request("get-locations", {
    action,
    leanPath: ctx.leanPath,
    line: pos.line,
    character: pos.character,
  }) as { locations?: LeanLocation[] } | null;
  const locations = resp?.locations ?? [];
  if (locations.length === 0) {
    window.dispatchEvent(new CustomEvent("aaronnote:lean-status", {
      detail: { message: `No ${action} results` },
    }));
    return;
  }
  if (locations.length === 1 && action !== "references") {
    await navigateToLeanLocation(ctx, locations[0]);
    return;
  }
  if (leanLocationsPicker) {
    leanLocationsPicker(locations, (loc) => { void navigateToLeanLocation(ctx, loc); });
  } else {
    await navigateToLeanLocation(ctx, locations[0]);
  }
}

function leanDefinitionClick(ctx: LeanContext): Extension {
  return EditorView.domEventHandlers({
    mousedown(event, view) {
      if (!(event.metaKey || event.ctrlKey) || event.button !== 0) return false;
      const pos = view.posAtCoords({ x: event.clientX, y: event.clientY });
      if (pos == null || !ctx.leanPath || !ctx.region) return false;
      event.preventDefault();
      event.stopPropagation();
      const fullOffset = localOffsetToFull(ctx, pos);
      const fullPos = fullOffset == null ? undefined : offsetToPosition(ctx.leanText, fullOffset);
      void runLeanLocationAction(ctx, view, "definition", fullPos);
      return true;
    },
  });
}

function blockKey(event: KeyboardEvent): void {
  event.preventDefault();
  event.stopPropagation();
  event.stopImmediatePropagation();
}

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function selectedLineStarts(state: EditorState): number[] {
  const starts = new Set<number>();
  for (const range of state.selection.ranges) {
    const startLine = state.doc.lineAt(range.from);
    const endPos = range.empty ? range.from : Math.max(range.from, range.to - 1);
    const endLine = state.doc.lineAt(endPos);
    for (let lineNo = startLine.number; lineNo <= endLine.number; lineNo++) {
      starts.add(state.doc.line(lineNo).from);
    }
  }
  return Array.from(starts).sort((a, b) => a - b);
}

function indentLeanSelection(view: EditorView): boolean {
  if (view.state.selection.ranges.every((range) => range.empty)) {
    view.dispatch(view.state.changeByRange((range) => ({
      changes: { from: range.from, insert: leanIndentUnit },
      range: EditorSelection.cursor(range.from + leanIndentUnit.length),
    })));
    return true;
  }
  const changes: ChangeSpec[] = selectedLineStarts(view.state).map((from) => ({ from, insert: leanIndentUnit }));
  if (changes.length === 0) return true;
  view.dispatch({ changes, scrollIntoView: true });
  return true;
}

function unindentLeanSelection(view: EditorView): boolean {
  const changes: ChangeSpec[] = [];
  for (const from of selectedLineStarts(view.state)) {
    const line = view.state.doc.lineAt(from);
    const spaces = /^\s*/.exec(line.text)?.[0] ?? "";
    const remove = line.text.startsWith("\t")
      ? 1
      : Math.min(leanIndentUnit.length, spaces.replace(/\t/g, "").length);
    if (remove > 0) changes.push({ from, to: from + remove, insert: "" });
  }
  if (changes.length > 0) view.dispatch({ changes, scrollIntoView: true });
  return true;
}

/**
 * Region-local editing tools for the embedded Lean editor. Each action mutates
 * only the child document (the region body) in a single transaction so Undo
 * reverses it in one step. Additional actions are implemented incrementally.
 */
function runLeanEditAction(view: EditorView, action: LeanEditAction): void {
  switch (action) {
    case "indent":
      indentLeanSelection(view);
      break;
    case "outdent":
      unindentLeanSelection(view);
      break;
    default:
      break;
  }
}

function insertLeanNewline(view: EditorView): boolean {
  view.dispatch(view.state.changeByRange((range) => {
    const line = view.state.doc.lineAt(range.from);
    const before = line.text.slice(0, range.from - line.from).trimEnd();
    const baseIndent = /^\s*/.exec(line.text)?.[0] ?? "";
    const extraIndent = /(?:^|[\s:=(])(?:by|where|do|then|else)$|(?:=>|:=)\s*$/.test(before)
      ? leanIndentUnit
      : "";
    const insert = `\n${baseIndent}${extraIndent}`;
    return {
      changes: { from: range.from, to: range.to, insert },
      range: EditorSelection.cursor(range.from + insert.length),
    };
  }));
  return true;
}

function leanDocChar(text: Text, pos: number): string {
  if (pos < 0 || pos >= text.length) return "";
  return text.sliceString(pos, pos + 1);
}

function leanWordChar(ch: string): boolean {
  return /[A-Za-z0-9_]/.test(ch);
}

function leanCursor(view: EditorView): number {
  return view.state.selection.main.head;
}

function setLeanCursor(view: EditorView, pos: number): void {
  view.dispatch({
    selection: { anchor: clampNumber(pos, 0, view.state.doc.length) },
    scrollIntoView: true,
  });
}

function setLeanSelection(view: EditorView, anchor: number, head: number): void {
  const length = view.state.doc.length;
  view.dispatch({
    selection: EditorSelection.single(clampNumber(anchor, 0, length), clampNumber(head, 0, length)),
    scrollIntoView: true,
  });
}

function moveLeanChar(view: EditorView, dir: -1 | 1): void {
  const selection = view.state.selection.main;
  const pos = selection.empty ? selection.head + dir : (dir < 0 ? selection.from : selection.to);
  setLeanCursor(view, pos);
}

function moveLeanLine(view: EditorView, dir: -1 | 1, goalColumn: number | null): number {
  const text = view.state.doc;
  const pos = leanCursor(view);
  const line = text.lineAt(clampNumber(pos, 0, text.length));
  const desired = goalColumn ?? clampNumber(pos, line.from, line.to) - line.from;
  if (dir < 0) {
    if (line.number <= 1) return desired;
    const prev = text.line(line.number - 1);
    setLeanCursor(view, Math.min(prev.from + desired, prev.to));
    return desired;
  }
  if (line.number >= text.lines) return desired;
  const next = text.line(line.number + 1);
  setLeanCursor(view, Math.min(next.from + desired, next.to));
  return desired;
}

function leanLineBoundary(view: EditorView, which: "start" | "end"): void {
  const line = view.state.doc.lineAt(leanCursor(view));
  setLeanCursor(view, which === "start" ? line.from : line.to);
}

function leanDocBoundary(view: EditorView, which: "start" | "end"): void {
  setLeanCursor(view, which === "start" ? 0 : view.state.doc.length);
}

function moveLeanWord(view: EditorView, dir: -1 | 1): void {
  const text = view.state.doc;
  let pos = leanCursor(view);
  if (dir > 0) {
    while (pos < text.length && leanWordChar(leanDocChar(text, pos))) pos++;
    while (pos < text.length && !leanWordChar(leanDocChar(text, pos))) pos++;
  } else {
    pos = Math.max(0, pos - 1);
    while (pos > 0 && !leanWordChar(leanDocChar(text, pos))) pos--;
    while (pos > 0 && leanWordChar(leanDocChar(text, pos - 1))) pos--;
  }
  setLeanCursor(view, pos);
}

function deleteLeanChar(view: EditorView): string {
  const selection = view.state.selection.main;
  const from = selection.from;
  const to = selection.empty ? Math.min(selection.from + 1, view.state.doc.length) : selection.to;
  if (from >= to) return "";
  const deleted = view.state.doc.sliceString(from, to);
  view.dispatch({ changes: { from, to, insert: "" }, selection: { anchor: from }, scrollIntoView: true });
  return deleted;
}

function deleteLeanLine(view: EditorView): string {
  const selection = view.state.selection.main;
  const text = view.state.doc;
  const line = text.lineAt(selection.from);
  const from = selection.empty ? line.from : selection.from;
  const to = selection.empty
    ? (line.to < text.length ? line.to + 1 : line.to)
    : selection.to;
  if (from >= to) return "";
  const deleted = text.sliceString(from, to);
  const anchor = Math.min(from, Math.max(0, text.length - (to - from)));
  view.dispatch({ changes: { from, to, insert: "" }, selection: { anchor }, scrollIntoView: true });
  return deleted;
}

function replaceLeanChar(view: EditorView, ch: string): void {
  const selection = view.state.selection.main;
  const from = selection.from;
  const to = selection.empty ? Math.min(from + 1, view.state.doc.length) : selection.to;
  if (from >= to) return;
  view.dispatch({
    changes: { from, to, insert: ch.repeat(Math.max(1, to - from)) },
    selection: { anchor: from },
    scrollIntoView: true,
  });
}

function openLeanLine(view: EditorView, where: "above" | "below"): void {
  const text = view.state.doc;
  const line = text.lineAt(leanCursor(view));
  const indent = /^\s*/.exec(line.text)?.[0] ?? "";
  const insertAt = where === "above" ? line.from : line.to;
  const insert = where === "above" ? `${indent}\n` : `\n${indent}`;
  const anchor = where === "above" ? insertAt + indent.length : insertAt + 1 + indent.length;
  view.dispatch({
    changes: { from: insertAt, insert },
    selection: { anchor },
    scrollIntoView: true,
  });
}

function selectionText(view: EditorView): string {
  const selection = view.state.selection.main;
  return selection.from < selection.to ? view.state.doc.sliceString(selection.from, selection.to) : "";
}

function isLeanVimEscape(event: KeyboardEvent): boolean {
  return event.key === "Escape" || (event.ctrlKey && !event.metaKey && !event.altKey && event.key === "[");
}

function hasLeanCommandModifier(event: KeyboardEvent): boolean {
  return event.metaKey || event.ctrlKey || event.altKey;
}

const leanJumpLabelAlphabet = "asdfghjklqwertyuiopzxcvbnm";
let leanJumpOverlay: HTMLDivElement | null = null;

function leanJumpLabels(count: number): string[] {
  if (count <= leanJumpLabelAlphabet.length) return [...leanJumpLabelAlphabet.slice(0, count)];
  const labels: string[] = [];
  for (const first of leanJumpLabelAlphabet) {
    for (const second of leanJumpLabelAlphabet) {
      labels.push(`${first}${second}`);
      if (labels.length >= count) return labels;
    }
  }
  return labels;
}

function leanJumpInputChar(key: string): string {
  return key.length === 1 && !/\s/.test(key) ? key : "";
}

function leanJumpLabelChar(key: string): string {
  const ch = key.length === 1 ? key.toLowerCase() : "";
  return leanJumpLabelAlphabet.includes(ch) ? ch : "";
}

function hideLeanJumpOverlay(): void {
  leanJumpOverlay?.remove();
  leanJumpOverlay = null;
}

function leanJumpRectInViewport(rect: { left: number; top: number; bottom: number }): boolean {
  return rect.bottom >= 44
    && rect.top <= window.innerHeight
    && rect.left >= 0
    && rect.left <= window.innerWidth;
}

function addLeanJumpTarget(
  targets: Omit<LeanJumpTarget, "label">[],
  seen: Set<string>,
  pos: number,
  rect: { left: number; top: number; bottom: number } | null,
): void {
  if (!rect || !leanJumpRectInViewport(rect)) return;
  const key = `${pos}:${Math.round(rect.left)}:${Math.round(rect.top)}`;
  if (seen.has(key)) return;
  seen.add(key);
  targets.push({ pos, rect: { left: rect.left, top: rect.top, bottom: rect.bottom } });
}

function visibleLeanJumpTargets(view: EditorView, query: string): LeanJumpTarget[] {
  const labels = leanJumpLabels(180);
  const targets: Omit<LeanJumpTarget, "label">[] = [];
  const seen = new Set<string>();
  const queryLower = query.toLowerCase();
  for (const range of view.visibleRanges) {
    const text = view.state.doc.sliceString(range.from, range.to).toLowerCase();
    for (let index = text.indexOf(queryLower); index >= 0; index = text.indexOf(queryLower, index + 1)) {
      const pos = range.from + index;
      let coords: { left: number; top: number; bottom: number } | null = null;
      try {
        coords = view.coordsAtPos(pos);
      } catch {
        coords = null;
      }
      addLeanJumpTarget(targets, seen, pos, coords);
      if (targets.length >= labels.length) break;
    }
    if (targets.length >= labels.length) break;
  }
  return targets.map((target, index) => ({ ...target, label: labels[index] ?? "" })).filter((target) => target.label);
}

function renderLeanJumpOverlay(state: LeanJumpModeState | null): void {
  if (!state || state.phase !== "label") {
    hideLeanJumpOverlay();
    return;
  }
  if (!leanJumpOverlay) {
    leanJumpOverlay = document.createElement("div");
    leanJumpOverlay.className = "aaronnote-jump-overlay";
    document.body.appendChild(leanJumpOverlay);
  }
  leanJumpOverlay.replaceChildren();
  for (const target of state.targets) {
    const marker = document.createElement("span");
    marker.className = target.label.startsWith(state.typed)
      ? "aaronnote-jump-label"
      : "aaronnote-jump-label is-muted";
    marker.textContent = target.label;
    marker.style.left = `${target.rect.left}px`;
    marker.style.top = `${target.rect.top}px`;
    leanJumpOverlay.appendChild(marker);
  }
}

function createLeanVimController(ctx: LeanContext) {
  let mode: LeanVimMode = "insert";
  let pending = "";
  let goalColumn: number | null = null;
  let visualAnchor: number | null = null;
  let register = "";
  let jumpMode: LeanJumpModeState | null = null;

  const setMode = (view: EditorView, next: LeanVimMode): void => {
    mode = next;
    pending = "";
    goalColumn = null;
    jumpMode = null;
    hideLeanJumpOverlay();
    if (next !== "visual" && next !== "visual-line") visualAnchor = null;
    view.dom.dataset.leanVimMode = next;
  };

  const yank = (text: string): void => {
    if (!text) return;
    register = text;
    void navigator.clipboard?.writeText(text).catch(() => {});
  };

  const paste = (view: EditorView, where: "before" | "after"): void => {
    if (!register) return;
    const selection = view.state.selection.main;
    const insertAt = where === "after" ? Math.min(view.state.doc.length, selection.to + 1) : selection.from;
    view.dispatch({
      changes: { from: insertAt, insert: register },
      selection: { anchor: insertAt + register.length },
      scrollIntoView: true,
    });
  };

  const enterVisual = (view: EditorView, next: LeanVimMode): void => {
    visualAnchor = leanCursor(view);
    setMode(view, next);
    if (next === "visual-line") {
      const line = view.state.doc.lineAt(visualAnchor);
      setLeanSelection(view, line.from, line.to);
    }
  };

  const visualMove = (view: EditorView, move: () => void): void => {
    if (visualAnchor == null) visualAnchor = leanCursor(view);
    move();
    setLeanSelection(view, visualAnchor, leanCursor(view));
  };

  const normalCommand = (view: EditorView, key: string): boolean => {
    if (pending === "d") {
      pending = "";
      if (key === "d") yank(deleteLeanLine(view));
      return true;
    }
    if (pending === "y") {
      pending = "";
      if (key === "y") {
        const line = view.state.doc.lineAt(leanCursor(view));
        yank(view.state.doc.sliceString(line.from, line.to < view.state.doc.length ? line.to + 1 : line.to));
      }
      return true;
    }
    if (pending === "r") {
      pending = "";
      if (key.length === 1) replaceLeanChar(view, key);
      return true;
    }
    if (pending === "g") {
      pending = "";
      if (key === "g") leanDocBoundary(view, "start");
      else if (key === "d") void runLeanLocationAction(ctx, view, "definition");
      else if (key === "D") void runLeanLocationAction(ctx, view, "declaration");
      else if (key === "y") void runLeanLocationAction(ctx, view, "typeDefinition");
      else if (key === "i") void runLeanLocationAction(ctx, view, "implementation");
      else if (key === "r") void runLeanLocationAction(ctx, view, "references");
      return true;
    }
    if (pending === "s" || pending === "S") {
      const dir = pending === "s" ? 1 : -1;
      pending = "";
      if (key.length === 1) {
        const text = view.state.doc.toString();
        const cur = leanCursor(view);
        let idx = dir > 0 ? text.indexOf(key, cur + 1) : text.lastIndexOf(key, cur - 1);
        if (idx < 0) idx = dir > 0 ? text.indexOf(key, 0) : text.lastIndexOf(key);
        if (idx >= 0) { goalColumn = null; setLeanCursor(view, idx); }
      }
      return true;
    }

    switch (key) {
      case "h":
      case "ArrowLeft":
      case "Backspace":
        goalColumn = null;
        moveLeanChar(view, -1);
        return true;
      case "l":
      case "ArrowRight":
      case " ":
        goalColumn = null;
        moveLeanChar(view, 1);
        return true;
      case "j":
      case "ArrowDown":
        goalColumn = moveLeanLine(view, 1, goalColumn);
        return true;
      case "k":
      case "ArrowUp":
        goalColumn = moveLeanLine(view, -1, goalColumn);
        return true;
      case "0":
        goalColumn = null;
        leanLineBoundary(view, "start");
        return true;
      case "$":
        goalColumn = null;
        leanLineBoundary(view, "end");
        return true;
      case "w":
        goalColumn = null;
        moveLeanWord(view, 1);
        return true;
      case "b":
        goalColumn = null;
        moveLeanWord(view, -1);
        return true;
      case "u":
        return undo(view);
      case "g":
        pending = "g";
        return true;
      case "G":
        leanDocBoundary(view, "end");
        return true;
      case "K":
        void runLeanLocationAction(ctx, view, "hover");
        return true;
      case "i":
        setMode(view, "insert");
        return true;
      case "a":
        moveLeanChar(view, 1);
        setMode(view, "insert");
        return true;
      case "I":
        leanLineBoundary(view, "start");
        setMode(view, "insert");
        return true;
      case "A":
        leanLineBoundary(view, "end");
        setMode(view, "insert");
        return true;
      case "o":
        openLeanLine(view, "below");
        setMode(view, "insert");
        return true;
      case "O":
        openLeanLine(view, "above");
        setMode(view, "insert");
        return true;
      case "x":
      case "Delete":
        yank(deleteLeanChar(view));
        return true;
      case "p":
        paste(view, "after");
        return true;
      case "P":
        paste(view, "before");
        return true;
      case "v":
        enterVisual(view, "visual");
        return true;
      case "V":
        enterVisual(view, "visual-line");
        return true;
      case "s":
        jumpMode = { phase: "target" };
        hideLeanJumpOverlay();
        return true;
      case "S":
        pending = key;
        return true;
      case "d":
      case "y":
      case "r":
        pending = key;
        return true;
      default:
        return key.length === 1 || key === "Tab";
    }
  };

  const handleJumpModeKey = (event: KeyboardEvent, view: EditorView): boolean => {
    if (!jumpMode) return false;
    if (event.metaKey || event.ctrlKey || event.altKey) {
      jumpMode = null;
      hideLeanJumpOverlay();
      return false;
    }
    blockKey(event);
    if (event.key === "Escape") {
      jumpMode = null;
      hideLeanJumpOverlay();
      return true;
    }
    if (jumpMode.phase === "target") {
      const query = leanJumpInputChar(event.key);
      if (!query) return true;
      const targets = visibleLeanJumpTargets(view, query);
      if (targets.length === 0) {
        jumpMode = null;
        hideLeanJumpOverlay();
        return true;
      }
      jumpMode = { phase: "label", typed: "", targets };
      renderLeanJumpOverlay(jumpMode);
      return true;
    }
    if (event.key === "Backspace") {
      jumpMode = { ...jumpMode, typed: jumpMode.typed.slice(0, -1) };
      renderLeanJumpOverlay(jumpMode);
      return true;
    }
    const labelChar = leanJumpLabelChar(event.key);
    if (!labelChar) return true;
    const typed = jumpMode.typed + labelChar;
    const exact = jumpMode.targets.find((target) => target.label === typed);
    if (exact) {
      jumpMode = null;
      hideLeanJumpOverlay();
      goalColumn = null;
      setLeanCursor(view, exact.pos);
      return true;
    }
    if (jumpMode.targets.some((target) => target.label.startsWith(typed))) {
      jumpMode = { ...jumpMode, typed };
      renderLeanJumpOverlay(jumpMode);
      return true;
    }
    return true;
  };

  const visualCommand = (view: EditorView, key: string): boolean => {
    switch (key) {
      case "h":
      case "ArrowLeft":
      case "Backspace":
        visualMove(view, () => moveLeanChar(view, -1));
        return true;
      case "l":
      case "ArrowRight":
      case " ":
        visualMove(view, () => moveLeanChar(view, 1));
        return true;
      case "j":
      case "ArrowDown":
        visualMove(view, () => { goalColumn = moveLeanLine(view, 1, goalColumn); });
        return true;
      case "k":
      case "ArrowUp":
        visualMove(view, () => { goalColumn = moveLeanLine(view, -1, goalColumn); });
        return true;
      case "0":
        visualMove(view, () => leanLineBoundary(view, "start"));
        return true;
      case "$":
        visualMove(view, () => leanLineBoundary(view, "end"));
        return true;
      case "w":
        visualMove(view, () => moveLeanWord(view, 1));
        return true;
      case "b":
        visualMove(view, () => moveLeanWord(view, -1));
        return true;
      case "x":
      case "d":
      case "Delete":
        yank(deleteLeanChar(view));
        setMode(view, "normal");
        return true;
      case "y":
        yank(selectionText(view));
        setMode(view, "normal");
        return true;
      case "v":
      case "Escape":
        setMode(view, "normal");
        return true;
      default:
        return key.length === 1 || key === "Tab";
    }
  };

  const visualLineCommand = (view: EditorView, key: string): boolean => {
    switch (key) {
      case "j":
      case "ArrowDown": {
        const line = view.state.doc.lineAt(view.state.selection.main.to);
        if (line.number < view.state.doc.lines) {
          const next = view.state.doc.line(line.number + 1);
          setLeanSelection(view, visualAnchor ?? line.from, next.to);
        }
        return true;
      }
      case "k":
      case "ArrowUp": {
        const line = view.state.doc.lineAt(view.state.selection.main.from);
        if (line.number > 1) {
          const prev = view.state.doc.line(line.number - 1);
          setLeanSelection(view, visualAnchor ?? line.to, prev.from);
        }
        return true;
      }
      case "x":
      case "d":
      case "Delete":
        yank(deleteLeanChar(view));
        setMode(view, "normal");
        return true;
      case "y":
        yank(selectionText(view));
        setMode(view, "normal");
        return true;
      case "V":
      case "v":
      case "Escape":
        setMode(view, "normal");
        return true;
      default:
        return key.length === 1 || key === "Tab";
    }
  };

  return {
    handleKeyDown(event: KeyboardEvent, view: EditorView): boolean {
      if (event.isComposing) return false;
      if (jumpMode) {
        if (isLeanVimEscape(event)) {
          blockKey(event);
          jumpMode = null;
          hideLeanJumpOverlay();
          setMode(view, "normal");
          return true;
        }
        if (handleJumpModeKey(event, view)) return true;
      }
      if (isLeanVimEscape(event)) {
        blockKey(event);
        setMode(view, "normal");
        return true;
      }
      if (mode === "insert") return false;
      if (event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey && event.key.toLowerCase() === "r") {
        blockKey(event);
        return redo(view);
      }
      if (hasLeanCommandModifier(event)) return false;
      blockKey(event);
      const handled = mode === "visual-line"
        ? visualLineCommand(view, event.key)
        : mode === "visual"
          ? visualCommand(view, event.key)
          : normalCommand(view, event.key);
      return handled;
    },
  };
}

function handleLeanCompletionKey(event: KeyboardEvent, view: EditorView): boolean {
  const status = completionStatus(view.state);
  const key = event.key;
  if (status === "active" && primaryMod(event) && /^[1-9]$/.test(key)) {
    blockKey(event);
    applyCompletionIndex(view, Number(key) - 1);
    return true;
  }
  if (key === "Tab") {
    blockKey(event);
    if (event.shiftKey && hasPrevSnippetField(view.state)) prevSnippetField(view);
    else if (!event.shiftKey && hasNextSnippetField(view.state)) nextSnippetField(view);
    else if (status === "active") acceptCompletion(view);
    else if (status === "pending") return true;
    else if (event.shiftKey) unindentLeanSelection(view);
    else indentLeanSelection(view);
    return true;
  }
  if (key === "Enter" && status !== "active" && status !== "pending") {
    blockKey(event);
    insertLeanNewline(view);
    return true;
  }
  if (!status) return false;
  if (key === "ArrowDown") {
    blockKey(event);
    moveCompletionSelection(true)(view);
    return true;
  }
  if (key === "ArrowUp") {
    blockKey(event);
    moveCompletionSelection(false)(view);
    return true;
  }
  if (key === "PageDown") {
    blockKey(event);
    moveCompletionSelection(true, "page")(view);
    return true;
  }
  if (key === "PageUp") {
    blockKey(event);
    moveCompletionSelection(false, "page")(view);
    return true;
  }
  if (key === "Enter") {
    blockKey(event);
    if (status === "active") acceptCompletion(view);
    return true;
  }
  return false;
}

function leanTooltipContainer(view: EditorView): HTMLElement | null {
  const root = view.dom.getRootNode();
  if (!(root instanceof Document || root instanceof ShadowRoot)) return null;
  return root.querySelector<HTMLElement>(".lean-editor-tooltips");
}

function hideCurrentCompletionInfo(view: EditorView): boolean {
  const tooltipContainer = leanTooltipContainer(view);
  if (!tooltipContainer?.querySelector(".cm-completionInfo")) return false;
  tooltipContainer.dataset.leanHideCompletionInfo = "true";
  tooltipContainer.dataset.leanHiddenCompletionInfoIndex = String(selectedCompletionIndex(view.state) ?? "");
  return true;
}

function syncHiddenCompletionInfo(view: EditorView): void {
  const tooltipContainer = leanTooltipContainer(view);
  if (!tooltipContainer?.dataset.leanHideCompletionInfo) return;
  if (completionStatus(view.state) !== "active") {
    delete tooltipContainer.dataset.leanHideCompletionInfo;
    delete tooltipContainer.dataset.leanHiddenCompletionInfoIndex;
    return;
  }
  const hiddenIndex = tooltipContainer.dataset.leanHiddenCompletionInfoIndex ?? "";
  if (hiddenIndex !== String(selectedCompletionIndex(view.state) ?? "")) {
    delete tooltipContainer.dataset.leanHideCompletionInfo;
    delete tooltipContainer.dataset.leanHiddenCompletionInfoIndex;
  }
}

function handleLeanPopupEscapeKey(event: KeyboardEvent, view: EditorView): boolean {
  if (event.key !== "Escape") return false;
  const hasCursorHover = view.state.field(leanCursorHoverField, false) !== null;
  const hasCompletionInfo = hideCurrentCompletionInfo(view);
  if (!hasCompletionInfo && !hasCursorHover) return false;
  blockKey(event);
  if (hasCursorHover) view.dispatch({ effects: SetLeanCursorHover.of(null) });
  return true;
}

function handleLeanUndoRedoKey(event: KeyboardEvent, view: EditorView): boolean {
  const key = event.key.toLowerCase();
  const isMac = /Mac/.test(navigator.platform);
  if (key === "z" && !event.altKey) {
    if (event.metaKey && !event.ctrlKey) {
      blockKey(event);
      if (event.shiftKey) redo(view); else undo(view);
      return true;
    }
    if (event.ctrlKey && !event.metaKey) {
      blockKey(event);
      if (isMac) redo(view);
      else if (event.shiftKey) redo(view);
      else undo(view);
      return true;
    }
  }
  if (key === "y" && event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) {
    blockKey(event);
    redo(view);
    return true;
  }
  return false;
}

function leanUndoRedoKeymap(): Extension {
  return Prec.highest(keymap.of([
    { key: "Mod-z", run: undo },
    { key: "Mod-Shift-z", run: redo },
    { mac: "Ctrl-z", run: redo },
    { key: "Ctrl-y", run: redo },
  ]));
}

function primaryMod(event: KeyboardEvent): boolean {
  return /Mac/.test(navigator.platform)
    ? event.metaKey && !event.ctrlKey && !event.altKey
    : event.ctrlKey && !event.metaKey && !event.altKey;
}

function applyCompletionIndex(view: EditorView, index: number): boolean {
  if (completionStatus(view.state) !== "active") return false;
  view.dispatch({ effects: setSelectedCompletion(index) });
  return acceptCompletion(view);
}

function leanCompletionKeymap(): Extension {
  return Prec.highest(keymap.of([
    { key: "Ctrl-Space", run: startCompletion },
    { mac: "Alt-`", run: startCompletion },
    { mac: "Alt-i", run: startCompletion },
    { key: "ArrowDown", run: moveCompletionSelection(true) },
    { key: "ArrowUp", run: moveCompletionSelection(false) },
    { key: "PageDown", run: moveCompletionSelection(true, "page") },
    { key: "PageUp", run: moveCompletionSelection(false, "page") },
    { key: "Enter", run: acceptCompletion },
    { key: "Tab", run: acceptCompletion },
    ...Array.from({ length: 9 }, (_, i) => ({
      key: `Mod-${i + 1}`,
      run: (view: EditorView) => applyCompletionIndex(view, i),
    })),
  ]));
}

function leanKeyboardIsolation(ctx: LeanContext): Extension {
  const vim = createLeanVimController(ctx);
  return Prec.highest(EditorView.domEventHandlers({
    keydown(event, view) {
      if (event.ctrlKey && !event.metaKey && !event.shiftKey && !event.altKey && event.key === "Enter") return false;
      if (handleLeanUndoRedoKey(event, view)) return true;
      if (handleLeanPopupEscapeKey(event, view)) return true;
      if (handleLeanCompletionKey(event, view)) return true;
      if (vim.handleKeyDown(event, view)) return true;
      event.stopPropagation();
      return false;
    },
    keyup(event) {
      event.stopPropagation();
      return false;
    },
    keypress(event) {
      event.stopPropagation();
      return false;
    },
  }));
}

function progressMarksFromLeanNotification(ctx: LeanContext, rawProgress: unknown[], docLength: number): LeanProgressMark[] {
  const marks: LeanProgressMark[] = [];
  for (const item of rawProgress) {
    const progress = item as {
      range?: { start?: { line?: number; character?: number }; end?: { line?: number; character?: number } };
      kind?: number;
    };
    const kind: LeanProgressKind | null = progress.kind === 2 ? "fatalError" : progress.kind === 1 || progress.kind == null ? "processing" : null;
    if (!kind) continue;
    const start = progress.range?.start;
    const end = progress.range?.end ?? start;
    if (!start || !end) continue;
    const fullFrom = positionToOffset(ctx.leanText, Number(start.line ?? 0), Number(start.character ?? 0));
    const fullTo = positionToOffset(ctx.leanText, Number(end.line ?? 0), Number(end.character ?? 0));
    const from = fullOffsetToLocal(ctx, fullFrom);
    const to = fullOffsetToLocal(ctx, fullTo);
    if (from == null) continue;
    marks.push({
      from: Math.max(0, Math.min(docLength, from)),
      to: Math.max(0, Math.min(docLength, to ?? from + 1)),
      kind,
    });
  }
  return marks;
}

function leanEditorExtensions(
  ctx: LeanContext,
  tooltipParent: HTMLElement,
  onChange: (view: EditorView) => void,
  onCursor: (view: EditorView) => void,
): Extension[] {
  return [
    history(),
    closeBrackets(),
    leanUndoRedoKeymap(),
    tooltips({ parent: tooltipParent, position: "fixed" }),
    EditorView.inputHandler.of(leanInputHandler),
    leanTreeSitterHighlight(),
    leanDiagnosticsField,
    leanProgressField,
    leanGoalStatusField,
    leanStatusGutterField,
    leanStatusGutter,
    lineNumbers({ formatNumber: (lineNo) => fullLineNumberForLocalLine(ctx, lineNo) }),
    highlightActiveLineGutter(),
    highlightActiveLine(),
    autocompletion({
      override: [leanCompletionSource(ctx)],
      activateOnTyping: true,
      maxRenderedOptions: 80,
      closeOnBlur: false,
      defaultKeymap: false,
    }),
    leanCompletionKeymap(),
    keymap.of([...completionKeymap, ...defaultKeymap, ...historyKeymap]),
    leanKeyboardIsolation(ctx),
    EditorView.lineWrapping,
    leanSemanticTokenDecorations,
    findHighlightExtension,
    leanDiagnosticDecorations,
    leanHover(ctx),
    leanCursorHover(ctx),
    leanDefinitionClick(ctx),
    EditorView.domEventHandlers({
      mousedown: (event, view) => calibrateLeanEditorClick(view, event),
    }),
    EditorView.updateListener.of((update) => {
      syncHiddenCompletionInfo(update.view);
      if (update.docChanged) onChange(update.view);
      if (update.focusChanged && update.view.hasFocus) publishLeanRegionActive(ctx.notePath, ctx.tag, ctx.selector, ctx.leanPath);
      if (update.view.hasFocus && (update.selectionSet || update.docChanged)) {
        publishLeanRegionActive(ctx.notePath, ctx.tag, ctx.selector, ctx.leanPath);
        onCursor(update.view);
      }
    }),
  ];
}

class LeanPlaceholderWidget extends MeasuredWidget {
  readonly block: LeanPlaceholder;

  constructor(block: LeanPlaceholder) {
    super();
    this.block = block;
  }

  protected measureKey(): string { return `lean:${this.block.selector}:${this.block.tag}`; }

  protected measureGroupKey(): string { return "lean:placeholder"; }

  protected estimatedHeightFallback(): number { return 420; }

  eq(other: LeanPlaceholderWidget): boolean {
    return this.block.tag === other.block.tag && this.block.selector === other.block.selector;
  }

  toDOM(parentView: EditorView): HTMLElement {
    const tag = this.block.tag.trim();
    const selector = canonicalLeanSelector(this.block.selector);
    const outer = document.createElement("div");
    outer.className = "cm-lean-placeholder-widget";
    outer.dataset.leanTag = tag;
    outer.dataset.leanSelector = selector;

    for (const type of ["mousedown", "mouseup", "click", "dblclick", "beforeinput", "input", "compositionstart", "compositionend"]) {
      outer.addEventListener(type, stopEmbeddedEvent);
    }
    for (const type of ["keydown", "keyup", "keypress"]) {
      outer.addEventListener(type, stopEmbeddedKeyboardEvent);
    }

    const shadow = outer.attachShadow({ mode: "open" });
    shadow.append(shadowStyles());

    const card = document.createElement("div");
    card.className = "lean-card";
    const head = document.createElement("div");
    head.className = "lean-head";
    const label = document.createElement("span");
    label.className = "lean-label";
    label.textContent = "Lean 4";
    const tagEl = document.createElement("span");
    tagEl.className = "lean-tag";
    tagEl.textContent = selector ? `${selector} #${tag}` : `default #${tag}`;
    const status = document.createElement("span");
    status.className = "lean-status";
    status.textContent = "Loading";
    head.append(label, tagEl, status);
    const host = document.createElement("div");
    host.className = "lean-host";
    card.append(head, host);
    shadow.append(card);

    const noteInfo = getLeanNoteInfo(parentView);
    if (!noteInfo || !tag || !api.lean.available()) {
      status.textContent = !noteInfo ? "No note" : !tag ? "Missing tag" : "Lean unavailable";
      card.classList.add("is-error");
      return outer;
    }

    let destroyed = false;

    shadow.append(tooltipStyles());
    const tooltipContainer = document.createElement("div");
    tooltipContainer.className = "lean-editor-tooltips";
    shadow.append(tooltipContainer);

    let loaded = false;
    let saveTimer: ReturnType<typeof setTimeout> | null = null;
    let goalTimer: ReturnType<typeof setTimeout> | null = null;
    let goalSeq = 0;
    let syncSeq = 0;
    let bodyGeneration = 0;
    let pendingBody: string | null = null;
    let syncPromise: Promise<void> | null = null;
    // The region body the Lean server is known to already hold. Lets us skip the
    // file-write + IPC round-trip that updateRegion costs when nothing changed
    // (e.g. cursor moves and completion requests that flush "to be safe").
    let lastSyncedBody: string | null = null;
    // Track what we last published to the infoview so we can skip redundant DOM rebuilds.
    let lastPublishedKey = "";
    let lastPublishedGoals: string | null = null;
    let lastPublishedTerm: string | null = null;
    let lastPublishedAccomplished = false;
    let lastPublishedGoalError: string | null = null;
    let lastPushRetryKey = "";
    let goalRetryTimer: ReturnType<typeof setTimeout> | null = null;
    let diagnosticsTimer: ReturnType<typeof setTimeout> | null = null;
    let progressTimer: ReturnType<typeof setTimeout> | null = null;
    let semanticTokensTimer: ReturnType<typeof setTimeout> | null = null;
    let lastDiagnosticsSig = "";
    let lastProgressSig = "";
    let lastSemanticTokensSig = "";
    const ctx: LeanContext = {
      notePath: noteInfo.notePath,
      tag,
      selector,
      leanPath: "",
      leanText: "",
      region: null,
    };
    let lspOpened = false;
    let lspOpenPromise: Promise<boolean> | null = null;

    ctx.ensureLspOpen = async () => {
      if (destroyed || !loaded || !ctx.leanPath || !ctx.region) return false;
      if (lspOpened) return true;
      if (lspOpenPromise) return lspOpenPromise;
      status.textContent = "Checking";
      lspOpenPromise = api.lean.openRegionFile({ notePath: noteInfo.notePath, tag, selector })
        .then((openRaw) => {
          const openRes = openRaw as { ok?: boolean; message?: string; lspVersion?: number; leanPath?: string } | null;
          if (openRes?.ok === false) throw new Error(openRes.message || "Lean open failed");
          if (typeof openRes?.lspVersion === "number") ctx.lspVersion = openRes.lspVersion;
          if (openRes?.leanPath) ctx.leanPath = String(openRes.leanPath);
          if (destroyed) {
            void api.lean.closeNote({ leanPath: ctx.leanPath }).catch(() => {});
            return false;
          }
          lspOpened = true;
          status.textContent = "Ready";
          card.classList.remove("is-error");
          publishLeanRegionInfoview({
            notePath: noteInfo.notePath,
            tag,
            selector,
            leanPath: ctx.leanPath,
            uri: fileUri(ctx.leanPath),
            line: 0,
            character: 0,
            goals: null,
            termGoal: null,
            goalError: null,
          });
          return true;
        })
        .catch((err) => {
          status.textContent = err instanceof Error ? err.message : "Lean open failed";
          card.classList.add("is-error");
          return false;
        })
        .finally(() => {
          lspOpenPromise = null;
        });
      return lspOpenPromise;
    };

    const syncRegion = (body: string, mode: "lsp" | "save"): Promise<void> => {
      if (!loaded) return Promise.resolve();
      if (body === lastSyncedBody) {
        status.textContent = mode === "save" ? "Saved" : "Ready";
        return syncPromise ?? Promise.resolve();
      }
      const seq = ++syncSeq;
      const generation = bodyGeneration;
      pendingBody = body;
      updateLeanContextBody(ctx, body);
      status.textContent = mode === "save" ? "Saving" : "Checking";
      syncPromise = api.lean.updateRegion({ notePath: noteInfo.notePath, tag, selector, body })
        .then((raw) => {
          const res = raw as { ok?: boolean; message?: string; text?: string; region?: LeanRegionMeta; leanPath?: string; lspVersion?: number };
          if (res?.ok === false) throw new Error(res.message || "Lean sync failed");
          if (seq !== syncSeq) return;
          ctx.leanText = String(res.text ?? ctx.leanText);
          ctx.region = res.region ?? ctx.region;
          ctx.leanPath = String(res.leanPath ?? ctx.leanPath);
          if (bodyGeneration !== generation) {
            const latestBody = child.state.doc.toString();
            if (latestBody !== body) updateLeanContextBody(ctx, latestBody);
          }
          if (typeof res.lspVersion === "number") ctx.lspVersion = res.lspVersion;
          lastSyncedBody = body;
          if (pendingBody === body) pendingBody = null;
          // Reset so push-triggered re-query fires after the edit is elaborated.
          lastPublishedGoals = null;
          lastPublishedTerm = null;
          lastPublishedAccomplished = false;
          lastPublishedGoalError = null;
          lastPushRetryKey = "";
          status.textContent = mode === "save" ? "Saved" : "Ready";
          card.classList.remove("is-error");
        })
        .catch((err) => {
          if (seq !== syncSeq) return;
          status.textContent = err instanceof Error ? err.message : "Error";
          card.classList.add("is-error");
        })
        .finally(() => {
          if (seq === syncSeq) syncPromise = null;
        });
      return syncPromise;
    };

    ctx.syncForLsp = async () => {
      const body = child.state.doc.toString();
      if (body === lastSyncedBody) {
        if (syncPromise) await syncPromise;
        return;
      }
      if (pendingBody === body && syncPromise) {
        await syncPromise;
        return;
      }
      if (syncPromise) await syncPromise;
      if (body === lastSyncedBody) return;
      await syncRegion(body, "lsp");
    };

    ctx.jumpToFullPosition = (line, character) => {
      if (!ctx.region) return;
      const fullOffset = positionToOffset(ctx.leanText, line, character);
      const local = fullOffsetToLocal(ctx, fullOffset);
      if (local == null) return;
      // Look up current block position dynamically — the widget may have shifted since toDOM was called.
      const currentBlocks = parentView.state.field(leanPlaceholdersScanField, false) ?? scanLeanPlaceholderIndex(parentView.state.doc);
      const currentBlock = findLeanPlaceholder(currentBlocks, (b) => b.tag === tag && b.selector === selector);
      const parentAnchor = currentBlock
        ? (currentBlock.to < parentView.state.doc.length
            ? currentBlock.to + 1
            : currentBlock.from > 0
              ? currentBlock.from - 1
              : null)
        : null;
      if (parentAnchor != null) {
        parentView.dispatch({
          selection: { anchor: parentAnchor },
          scrollIntoView: true,
        });
      }
      outer.scrollIntoView({ block: "center", inline: "nearest" });
      child.dispatch({
        selection: { anchor: Math.max(0, Math.min(child.state.doc.length, local)) },
        scrollIntoView: true,
      });
      child.focus();
    };

    const renderGoals = (view: EditorView, flush = false): void => {
      if (!loaded || !ctx.leanPath || !ctx.region) return;
      if (goalTimer) clearTimeout(goalTimer);
      const seq = ++goalSeq;
      goalTimer = setTimeout(() => {
        goalTimer = null;
        void (async () => {
          // Flush pending edits first so the queried position matches the text the
          // server holds; cheap no-op when nothing changed (see lastSyncedBody).
          if (flush) {
            try { await ctx.syncForLsp?.(); } catch {}
            if (seq !== goalSeq) return;
          }
          if (!await ctx.ensureLspOpen?.()) return;
          const fullOffset = localOffsetToFull(ctx, view.state.selection.main.from);
          if (fullOffset == null) return;
          const pos = offsetToPosition(ctx.leanText, fullOffset);
          const [goalRaw, termRaw] = await Promise.all([
            api.lean.getGoals({ leanPath: ctx.leanPath, line: pos.line, character: pos.character }),
            api.lean.getTermGoal({ leanPath: ctx.leanPath, line: pos.line, character: pos.character }),
          ]);
          if (seq !== goalSeq) return;
          const goalResponse = goalRaw as { ok?: boolean; message?: string; result?: { rendered?: string; goals?: unknown[] } } | null;
          const termResponse = termRaw as { ok?: boolean; message?: string; result?: { rendered?: string } } | null;
          const goalError = goalResponse?.ok === false
            ? (goalResponse.message || "Error fetching goals")
            : termResponse?.ok === false
              ? (termResponse.message || "Error fetching expected type")
              : "";
          const goalResult = goalResponse?.result ?? null;
          const term = termResponse?.result?.rendered ?? "";
          const goalText = String(goalResult?.rendered ?? "");
          const goalCount = Array.isArray(goalResult?.goals) ? goalResult.goals.length : (goalText ? 1 : 0);
          const newKey = `${pos.line}:${pos.character}`;
          const newGoals = goalText || null;
          const newTerm = term || null;
          const newAccomplished = goalResult != null && goalCount === 0;
          view.dispatch({
            effects: SetLeanGoalStatus.of(newAccomplished
              ? { from: view.state.selection.main.from }
              : null),
          });
          // Skip publish when content is identical — prevents lean-panel from calling
          // replaceChildren on every Lean elaboration push (the main flicker source).
          if (
            newKey === lastPublishedKey &&
            newGoals === lastPublishedGoals &&
            newTerm === lastPublishedTerm &&
            newAccomplished === lastPublishedAccomplished &&
            (goalError || null) === lastPublishedGoalError
          ) return;
          lastPublishedKey = newKey;
          lastPublishedGoals = newGoals;
          lastPublishedTerm = newTerm;
          lastPublishedAccomplished = newAccomplished;
          lastPublishedGoalError = goalError || null;
          publishLeanRegionInfoview({
            notePath: noteInfo.notePath,
            tag,
            selector,
            leanPath: ctx.leanPath,
            uri: fileUri(ctx.leanPath),
            line: pos.line,
            character: pos.character,
            goals: newGoals,
            termGoal: newTerm,
            goalsAccomplished: newAccomplished,
            goalError: goalError || null,
          });
        })().catch(() => {});
      }, 180);
    };

    const scheduleGoalRetryFromPush = (): void => {
      if (!lastPublishedKey || lastPublishedGoals !== null || lastPublishedAccomplished) return;
      if (lastPushRetryKey === lastPublishedKey) return;
      lastPushRetryKey = lastPublishedKey;
      if (goalRetryTimer) clearTimeout(goalRetryTimer);
      goalRetryTimer = setTimeout(() => {
        goalRetryTimer = null;
        renderGoals(child);
      }, 550);
    };

    const diagnosticSignature = (marks: LeanDiagnosticMark[]): string =>
      marks.map((mark) => `${mark.from}:${mark.to}:${mark.severity}:${mark.leanTags.join(",")}:${mark.message}`).join("\n");

    const progressSignature = (marks: LeanProgressMark[]): string =>
      marks.map((mark) => `${mark.from}:${mark.to}:${mark.kind}`).join("\n");

    const semanticTokensSignature = (raw: unknown): string => {
      const data = Array.isArray((raw as { data?: unknown[] } | null)?.data)
        ? (raw as { data: unknown[] }).data
        : [];
      return `${data.length}:${String(data[0] ?? "")}:${String(data.at(-1) ?? "")}`;
    };

    const copilotEditorId = `lean:${noteInfo.notePath}:${tag}:${Date.now().toString(36)}:${Math.random().toString(36).slice(2)}`;
    const copilotChangeHandlers = new Set<() => void>();
    let copilotRegistered = false;
    let child: EditorView;
    const requestLeanMeasure = (): void => {
      window.requestAnimationFrame(() => {
        if (!outer.isConnected) return;
        parentView.requestMeasure();
        child?.requestMeasure();
      });
    };
    const registerCopilotEditor = (): void => {
      if (destroyed || !loaded || copilotRegistered) return;
      const detail: CopilotEditorDetail = {
        id: copilotEditorId,
        editor: leanCopilotEditor(child),
        host: outer,
        currentFile: () => ctx.leanPath || noteInfo.notePath,
        vimMode: () => (child.dom.dataset.leanVimMode as LeanVimMode | undefined) || "insert",
        setStatus: (message) => {
          status.textContent = message;
          card.classList.remove("is-error");
        },
        onChange(handler) {
          copilotChangeHandlers.add(handler);
          return () => copilotChangeHandlers.delete(handler);
        },
        onKeyDown(handler) {
          const listener = (event: KeyboardEvent): void => {
            if (!handler(event)) return;
            event.stopPropagation();
            event.stopImmediatePropagation();
          };
          child.dom.addEventListener("keydown", listener, { capture: true });
          return () => child.dom.removeEventListener("keydown", listener, { capture: true });
        },
        onAction: () => () => {},
        onDocumentEvent(type, handler, options) {
          const listener = handler as EventListener;
          const targets: EventTarget[] = [document];
          if (type === "scroll") targets.push(child.scrollDOM);
          if (type === "keyup" || type === "mouseup") targets.push(child.dom);
          for (const target of targets) target.addEventListener(type, listener, options);
          return () => {
            for (const target of targets) target.removeEventListener(type, listener, options);
          };
        },
        jumpSnippetNext: () => hasNextSnippetField(child.state) ? nextSnippetField(child) : false,
        jumpSnippetPrevious: () => hasPrevSnippetField(child.state) ? prevSnippetField(child) : false,
        forwardDelimiter: () => false,
        backwardDelimiter: () => false,
        ack: () => {
          copilotRegistered = true;
        },
      };
      window.dispatchEvent(new CustomEvent(copilotRegisterEvent, { detail }));
    };

    child = new EditorView({
      state: EditorState.create({
        doc: "",
        extensions: leanEditorExtensions(ctx, tooltipContainer, () => {
          if (!loaded) return;
          bodyGeneration++;
          lastPushRetryKey = "";
          if (saveTimer) clearTimeout(saveTimer);
          saveTimer = setTimeout(() => {
            saveTimer = null;
            void syncRegion(child.state.doc.toString(), "save");
          }, 420);
          for (const handler of copilotChangeHandlers) handler();
        }, (view) => {
          lastPushRetryKey = "";
          renderGoals(view, true);
        }),
      }),
      parent: host,
      root: shadow,
    });
    child.dom.dataset.leanVimMode = "insert";
    void document.fonts?.ready.then(() => requestLeanMeasure()).catch(() => {});
    host.addEventListener("mousedown", () => {
      publishLeanRegionActive(noteInfo.notePath, tag, selector, ctx.leanPath);
      setActiveLeanController(copilotEditorId);
      void ctx.ensureLspOpen?.().then((ok) => { if (ok) renderGoals(child); });
      window.setTimeout(() => {
        child.focus();
        registerCopilotEditor();
      }, 0);
    });
    host.addEventListener("focusin", () => {
      publishLeanRegionActive(noteInfo.notePath, tag, selector, ctx.leanPath);
      setActiveLeanController(copilotEditorId);
      void ctx.ensureLspOpen?.().then((ok) => { if (ok) renderGoals(child); });
      registerCopilotEditor();
    });
    (outer as HTMLElement & { __leanChild?: EditorView; __leanTooltips?: HTMLDivElement }).__leanChild = child;
    (outer as HTMLElement & { __leanChild?: EditorView; __leanTooltips?: HTMLDivElement }).__leanTooltips = tooltipContainer;
    (outer as HTMLElement & { __leanHistory?: { undo: () => boolean; redo: () => boolean } }).__leanHistory = {
      undo: () => undo(child),
      redo: () => redo(child),
    };

    registerLeanController({
      id: copilotEditorId,
      notePath: noteInfo.notePath,
      get leanPath() { return ctx.leanPath; },
      tag,
      selector,
      runLspAction: (action, position) => runLeanLocationAction(ctx, child, action, position),
      runEditAction: (action) => runLeanEditAction(child, action),
      jumpTo: (line, character) => ctx.jumpToFullPosition?.(line, character),
    });

    const unsubDiag = api.lean.onDiagnostics((raw) => {
      const data = raw as { uri?: string; version?: number; diagnostics?: unknown[] };
      if (!ctx.leanPath || data.uri !== fileUri(ctx.leanPath)) return;
      if (typeof data.version === "number") {
        if (typeof ctx.lspVersion === "number" && data.version < ctx.lspVersion) return;
        ctx.lspVersion = data.version;
      }
      const marks: LeanDiagnosticMark[] = [];
      for (const item of data.diagnostics ?? []) {
        const diag = item as {
          range?: { start?: { line?: number; character?: number }; end?: { line?: number; character?: number } };
          severity?: number;
          message?: string;
          leanTags?: unknown[];
        };
        const start = positionToOffset(ctx.leanText, diag.range?.start?.line ?? 0, diag.range?.start?.character ?? 0);
        const end = positionToOffset(ctx.leanText, diag.range?.end?.line ?? 0, diag.range?.end?.character ?? 0);
        const from = fullOffsetToLocal(ctx, start);
        const to = fullOffsetToLocal(ctx, end);
        if (from == null) continue;
        marks.push({
          from: Math.max(0, Math.min(child.state.doc.length, from)),
          to: Math.max(0, Math.min(child.state.doc.length, to ?? from + 1)),
          severity: severityName(diag.severity),
          message: String(diag.message ?? ""),
          leanTags: leanDiagnosticTags(diag.leanTags),
        });
      }
      const sig = diagnosticSignature(marks);
      if (sig !== lastDiagnosticsSig) {
        if (diagnosticsTimer) clearTimeout(diagnosticsTimer);
        diagnosticsTimer = setTimeout(() => {
          diagnosticsTimer = null;
          lastDiagnosticsSig = sig;
          child.dispatch({ effects: SetLeanDiagnostics.of(marks) });
        }, 420);
      }
      scheduleGoalRetryFromPush();
    });
    const unsubProgress = api.lean.onProgress((raw) => {
      const data = raw as { uri?: string; version?: number; processing?: unknown[] };
      if (!ctx.leanPath || data.uri !== fileUri(ctx.leanPath)) return;
      if (typeof data.version === "number") {
        if (typeof ctx.lspVersion === "number" && data.version < ctx.lspVersion) return;
        ctx.lspVersion = data.version;
      }
      const marks = progressMarksFromLeanNotification(ctx, data.processing ?? [], child.state.doc.length);
      const sig = progressSignature(marks);
      if (sig !== lastProgressSig) {
        if (progressTimer) clearTimeout(progressTimer);
        progressTimer = setTimeout(() => {
          progressTimer = null;
          lastProgressSig = sig;
          child.dispatch({ effects: SetLeanProgress.of(marks) });
        }, 180);
      }
      scheduleGoalRetryFromPush();
    });
    const unsubSemanticTokens = api.lean.onSemanticTokens((raw) => {
      const data = raw as { uri?: string; legend?: unknown; data?: unknown[] };
      if (!ctx.leanPath || data.uri !== fileUri(ctx.leanPath)) return;
      const sig = semanticTokensSignature(data);
      if (sig === lastSemanticTokensSig) return;
      if (semanticTokensTimer) clearTimeout(semanticTokensTimer);
      semanticTokensTimer = setTimeout(() => {
        semanticTokensTimer = null;
        lastSemanticTokensSig = sig;
        child.dispatch({
          effects: SetLeanSemanticTokens.of({
            text: ctx.leanText,
            region: ctx.region,
            legend: data.legend,
            data: data.data ?? [],
          }),
        });
      }, 420);
    });
    const onRegionJump = (event: Event): void => {
      const detail = (event as LeanRegionJumpEvent).detail;
      if (!detail || detail.notePath !== noteInfo.notePath) return;
      if (detail.tag && detail.tag !== tag) return;
      if (detail.selector && detail.selector !== selector) return;
      if (detail.leanPath && detail.leanPath !== ctx.leanPath) return;
      if (typeof detail.line !== "number") return;
      ctx.jumpToFullPosition?.(detail.line, Number(detail.character ?? 0));
    };
    const onRegionInsert = (event: Event): void => {
      const detail = (event as LeanRegionInsertEvent).detail;
      if (!detail || detail.notePath !== noteInfo.notePath) return;
      if (detail.leanPath && detail.leanPath !== ctx.leanPath) return;
      const text = String(detail.text ?? "");
      if (!text) return;
      let from = child.state.selection.main.from;
      let to = child.state.selection.main.to;
      if (typeof detail.line === "number") {
        const fullOffset = positionToOffset(ctx.leanText, detail.line, Number(detail.character ?? 0));
        const local = fullOffsetToLocal(ctx, fullOffset);
        if (local == null) return;
        from = local;
        to = local;
      }
      if (detail.kind === "above") {
        const line = child.state.doc.lineAt(Math.max(0, Math.min(child.state.doc.length, from)));
        from = line.from;
        to = line.from;
      }
      const insert = detail.kind === "above" && !text.endsWith("\n") ? `${text}\n` : text;
      child.dispatch({
        changes: { from, to, insert },
        selection: { anchor: from + insert.length },
        scrollIntoView: true,
      });
    };
    const onRegionApplyEdit = (event: Event): void => {
      const detail = (event as LeanRegionApplyEditEvent).detail;
      if (!detail || detail.notePath !== noteInfo.notePath) return;
      const edit = detail.edit as {
        changes?: Record<string, Array<{ range?: { start?: { line?: number; character?: number }; end?: { line?: number; character?: number } }; newText?: string }>>;
        documentChanges?: Array<{ textDocument?: { uri?: string }; edits?: Array<{ range?: { start?: { line?: number; character?: number }; end?: { line?: number; character?: number } }; newText?: string }> }>;
      } | null;
      const uri = fileUri(ctx.leanPath);
      const rawEdits = [
        ...(Array.isArray(edit?.changes?.[uri]) ? edit?.changes?.[uri] ?? [] : []),
        ...(Array.isArray(edit?.documentChanges)
          ? edit.documentChanges.flatMap((change) => change?.textDocument?.uri === uri && Array.isArray(change.edits) ? change.edits : [])
          : []),
      ];
      const changes: Array<{ from: number; to: number; insert: string }> = [];
      let rejected = false;
      for (const textEdit of rawEdits) {
        const start = textEdit.range?.start;
        const end = textEdit.range?.end ?? start;
        if (!start || !end) continue;
        const fullFrom = positionToOffset(ctx.leanText, Number(start.line ?? 0), Number(start.character ?? 0));
        const fullTo = positionToOffset(ctx.leanText, Number(end.line ?? 0), Number(end.character ?? 0));
        const from = fullOffsetToLocal(ctx, fullFrom);
        const to = fullOffsetToLocal(ctx, fullTo);
        if (from == null || to == null) {
          rejected = true;
          continue;
        }
        changes.push({ from, to, insert: String(textEdit.newText ?? "") });
      }
      if (rejected) {
        status.textContent = "Edit outside region rejected";
        card.classList.add("is-error");
        return;
      }
      if (changes.length === 0) return;
      card.classList.remove("is-error");
      child.dispatch({
        changes: changes.sort((a, b) => a.from - b.from) as ChangeSpec,
        scrollIntoView: true,
      });
    };
    window.addEventListener("aaronnote:lean-region-jump", onRegionJump);
    window.addEventListener("aaronnote:lean-region-insert", onRegionInsert);
    window.addEventListener("aaronnote:lean-region-apply-edit", onRegionApplyEdit);
    (outer as HTMLElement & { __leanChild?: EditorView; __leanUnsub?: () => void }).__leanUnsub = () => {
      destroyed = true;
      unregisterLeanController(copilotEditorId);
      unsubDiag();
      unsubProgress();
      unsubSemanticTokens();
      if (goalRetryTimer) clearTimeout(goalRetryTimer);
      if (diagnosticsTimer) clearTimeout(diagnosticsTimer);
      if (progressTimer) clearTimeout(progressTimer);
      if (semanticTokensTimer) clearTimeout(semanticTokensTimer);
      window.removeEventListener("aaronnote:lean-region-jump", onRegionJump);
      window.removeEventListener("aaronnote:lean-region-insert", onRegionInsert);
      window.removeEventListener("aaronnote:lean-region-apply-edit", onRegionApplyEdit);
      hideLeanJumpOverlay();
      window.dispatchEvent(new CustomEvent(copilotDisposeEvent, { detail: { id: copilotEditorId } }));
      if ((lspOpened || lspOpenPromise) && ctx.leanPath) void api.lean.closeNote({ leanPath: ctx.leanPath }).catch(() => {});
    };

    void api.lean.readRegion({ notePath: noteInfo.notePath, tag, selector })
      .then((raw) => {
        const res = raw as LeanRegionRead;
        if (res?.ok === false) throw new Error(res.message || "Lean region load failed");
        ctx.leanPath = String(res.leanPath ?? "");
        ctx.leanText = String(res.text ?? "");
        ctx.region = res.region ?? null;
        const body = String(res.body ?? "");
        child.dispatch({
          changes: { from: 0, to: child.state.doc.length, insert: body },
          annotations: Transaction.addToHistory.of(false),
        });
        loaded = true;
        if (destroyed) return;
        lastSyncedBody = String(res.body ?? "");
        status.textContent = "Ready";
        card.classList.remove("is-error");
        if (child.hasFocus) registerCopilotEditor();
        requestLeanMeasure();
      })
      .catch((err) => {
        status.textContent = err instanceof Error ? err.message : "Error";
        card.classList.add("is-error");
      });

    return this.registerMeasured(outer, parentView);
  }

  destroy(dom: HTMLElement): void {
    super.destroy(dom);
    const state = dom as HTMLElement & { __leanChild?: EditorView; __leanUnsub?: () => void; __leanTooltips?: HTMLDivElement };
    state.__leanUnsub?.();
    state.__leanChild?.destroy();
    state.__leanTooltips?.remove();
  }

  ignoreEvent(): boolean {
    return false;
  }
}

function patchLeanPlaceholderIndex(
  index: RangeSet<LeanPlaceholderValue>,
  doc: Text,
  changes: ChangeSet,
): RangeSet<LeanPlaceholderValue> {
  let next = index.map(changes);
  const add: Range<LeanPlaceholderValue>[] = [];
  for (const lineNo of [...changedLineNumbers(doc, changes)].sort((a, b) => a - b)) {
    const line = doc.line(lineNo);
    next = next.update({ filterFrom: line.from, filterTo: line.to, filter: () => false });
    const placeholder = leanPlaceholderRangeForLine(doc, lineNo);
    if (placeholder) add.push(placeholder);
  }
  return add.length > 0 ? next.update({ add, sort: true }) : next;
}

// The initial scan indexes the opened document once. RangeSet mapping shifts
// untouched placeholders cheaply; editing reparses only changed lines.
const leanPlaceholdersScanField = StateField.define<RangeSet<LeanPlaceholderValue>>({
  create: (state) => scanLeanPlaceholderIndex(state.doc),
  update(value, tr) {
    if (!tr.docChanged) return value;
    return patchLeanPlaceholderIndex(value, tr.state.doc, tr.changes);
  },
});

function buildLeanPlaceholderDecorations(state: EditorState): DecorationSet {
  const decos: Range<Decoration>[] = [];
  const sel = state.selection.main;
  const placeholders = state.field(leanPlaceholdersScanField, false) ?? scanLeanPlaceholderIndex(state.doc);
  const cursor = placeholders.iter();
  while (cursor.value) {
    const block = leanPlaceholderFromRange(cursor.from, cursor.to, cursor.value);
    if (!(sel.from <= block.to && sel.to >= block.from)) {
      decos.push(
        Decoration.replace({
          widget: new LeanPlaceholderWidget(block),
          block: true,
        }).range(block.from, block.to),
      );
    }
    cursor.next();
  }
  return Decoration.set(decos, true);
}

function nextNewfileIdInDoc(state: EditorState): number {
  let next = 1;
  const placeholders = state.field(leanPlaceholdersScanField, false) ?? scanLeanPlaceholderIndex(state.doc);
  const cursor = placeholders.iter();
  while (cursor.value) {
    const match = /^newfile:(\d+)$/.exec(cursor.value.selector);
    if (match) next = Math.max(next, Number(match[1]) + 1);
    cursor.next();
  }
  return next;
}

function normalizedLeanPlaceholderForLine(view: EditorView, lineNo: number, rawNewfileSelector = ""): string | null {
  const line = view.state.doc.line(lineNo);
  const parsed = parseLeanPlaceholderLine(line.text);
  if (!parsed) return null;
  const selector = canonicalLeanSelector(parsed.selector === "newfile" && rawNewfileSelector ? rawNewfileSelector : parsed.selector);
  const leading = line.text.slice(0, parsed.commandFrom);
  const normalized = formatLeanPlaceholder(selector, parsed.tag, leading);
  return normalized === line.text.trimEnd() ? null : normalized;
}

const leanPlaceholderNormalizePlugin = ViewPlugin.fromClass(class {
  private timer: ReturnType<typeof setTimeout> | null = null;
  private pendingLineStarts = new Set<number>();
  private readonly view: EditorView;

  constructor(view: EditorView) {
    this.view = view;
  }

  update(update: ViewUpdate): void {
    if (!update.docChanged) return;
    this.pendingLineStarts = new Set(
      [...this.pendingLineStarts].map((from) => update.changes.mapPos(from, 1)),
    );
    for (const lineNo of changedLineNumbers(update.state.doc, update.changes)) {
      const line = update.state.doc.line(lineNo);
      if (line.text.includes("@@lean4")) this.pendingLineStarts.add(line.from);
    }
    if (this.pendingLineStarts.size === 0) return;
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      this.normalize();
    }, 0);
  }

  destroy(): void {
    if (this.timer) clearTimeout(this.timer);
  }

  private normalize(): void {
    if (!this.view.dom.isConnected) return;
    const doc = this.view.state.doc;
    const lineNumbers = new Set(
      [...this.pendingLineStarts].map((from) =>
        doc.lineAt(Math.max(0, Math.min(from, doc.length))).number),
    );
    this.pendingLineStarts.clear();
    const changes: ChangeSpec[] = [];
    let nextNewfileId = nextNewfileIdInDoc(this.view.state);
    for (const lineNo of [...lineNumbers].sort((a, b) => a - b)) {
      const line = doc.line(lineNo);
      const parsed = parseLeanPlaceholderLine(line.text);
      const rawNewfileSelector = parsed?.selector === "newfile" ? `newfile:${nextNewfileId++}` : "";
      const normalized = normalizedLeanPlaceholderForLine(this.view, lineNo, rawNewfileSelector);
      if (normalized == null) continue;
      changes.push({ from: line.from, to: line.to, insert: normalized });
    }
    if (changes.length === 0) return;
    this.view.dispatch({ changes, annotations: Transaction.addToHistory.of(false) });
  }
});

const leanPlaceholderField = StateField.define<DecorationSet>({
  create: buildLeanPlaceholderDecorations,
  update(value, tr) {
    if (tr.docChanged) {
      const mapped = value.map(tr.changes);
      const previous = tr.startState.field(leanPlaceholdersScanField, false) ?? RangeSet.empty;
      const next = tr.state.field(leanPlaceholdersScanField, false) ?? RangeSet.empty;
      return RangeSet.eq([previous.map(tr.changes)], [next])
        ? mapped
        : buildLeanPlaceholderDecorations(tr.state);
    }
    if (tr.selection) {
      // Only rebuild when cursor crosses a placeholder boundary.
      const placeholders = tr.state.field(leanPlaceholdersScanField, false) ?? RangeSet.empty;
      if (placeholders.size === 0) return value;
      const sel = tr.state.selection.main;
      const prevSel = tr.startState.selection.main;
      const activeIndex = (from: number, to: number): string => {
        let key = "";
        placeholders.between(from, to, (blockFrom, blockTo, block) => {
          if (from <= blockTo && to >= blockFrom) {
            key = `${blockFrom}:${blockTo}:${block.selector}:${block.tag}`;
            return false;
          }
        });
        return key;
      };
      const curActive = activeIndex(sel.from, sel.to);
      const prevActive = activeIndex(prevSel.from, prevSel.to);
      if (curActive !== prevActive) return buildLeanPlaceholderDecorations(tr.state);
    }
    return value;
  },
  provide: (field) => EditorView.decorations.from(field),
});

export const leanPlaceholderEditingExtension: Extension = [
  leanPlaceholdersScanField,
  leanPlaceholderNormalizePlugin,
];

export const leanPlaceholderPreviewExtension: Extension = [
  leanPlaceholderField,
];

export const leanPlaceholderExtension: Extension = [
  leanPlaceholderEditingExtension,
  leanPlaceholderPreviewExtension,
];
