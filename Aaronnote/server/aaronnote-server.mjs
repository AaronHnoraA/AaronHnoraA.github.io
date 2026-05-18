#!/usr/bin/env node
import { createServer as createHttpServer } from "node:http";
import { mkdir, mkdtemp, readdir, readFile, rename, rm, stat, writeFile } from "node:fs/promises";
import { createReadStream, existsSync } from "node:fs";
import { basename, dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { homedir, tmpdir } from "node:os";
import { execFile, spawn } from "node:child_process";
import { promisify } from "node:util";
import { fileURLToPath, pathToFileURL } from "node:url";

const appDir = resolve(dirname(fileURLToPath(import.meta.url)), "..");
let workspaceRoot = resolve(process.env.AARONNOTE_WORKSPACE_ROOT || resolve(appDir, ".."));
let publishJsDir = resolve(process.env.AARONNOTE_PUBLISH_JS_DIR || join(workspaceRoot, "js"));
let pluginRoot = resolve(process.env.AARONNOTE_PLUGIN_ROOT || join(workspaceRoot, "plugin"));
const execFileAsync = promisify(execFile);

function parseArgs(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith("--")) continue;
    const key = arg.slice(2);
    const next = argv[i + 1];
    if (!next || next.startsWith("--")) out[key] = true;
    else {
      out[key] = next;
      i++;
    }
  }
  return out;
}

const args = parseArgs(process.argv.slice(2));
let host = String(args.host || process.env.AARONNOTE_HOST || "127.0.0.1");
let port = Number(args.port || process.env.AARONNOTE_PORT || 5179);
let noteRoot = resolve(String(args.root || process.env.AARONNOTE_ROOT || join(appDir, "..", "roam")));
let noteScanRoot = noteRoot;
const excludedDirs = new Set(["_typst", "public", "var", ".git", ".direnv", ".venv", "node_modules"]);
const noteExts = new Set([".typ", ".md", ".markdown"]);
const defaultNoteKind = "default";
const defaultNoteKindAliases = new Set(["", "default", "note"]);
const noteKindPattern = /^[a-z0-9_-]+$/;
let noteCacheRoot = "";
let noteCache = new Map();
let todoCacheRoot = "";
let todoCache = new Map();
let snippetCache = { key: "", scannedAt: 0, snippets: [] };
let pluginCache = { key: "", scannedAt: 0, plugins: [] };
let copilotClient = null;
let copilotLog = [];
let copilotLogRecording = false;
let roamLookupSession = null;
let roamSyncTimer = null;
let queuedRoamSyncNotes = null;
let atomicWriteCounter = 0;
const scanConcurrency = Math.max(1, Math.min(64, Number(process.env.AARONNOTE_SCAN_CONCURRENCY) || 16));
const maxJsonBodyBytes = Math.max(1024 * 1024, Number(process.env.AARONNOTE_MAX_JSON_BYTES) || 64 * 1024 * 1024);
const roamLookupIdleMs = Math.max(10_000, Number(process.env.AARONNOTE_ROAMLOOKUP_IDLE_MS) || 60_000);
const roamLookupQueryTimeoutMs = Math.max(30_000, Number(process.env.AARONNOTE_ROAMLOOKUP_QUERY_TIMEOUT_MS) || 180_000);
const saveRequestVersions = new Map();
const saveWriteQueues = new Map();
const contentTypes = new Map([
  [".html", "text/html; charset=utf-8"],
  [".js", "application/javascript; charset=utf-8"],
  [".css", "text/css; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".png", "image/png"],
  [".jpg", "image/jpeg"],
  [".jpeg", "image/jpeg"],
  [".gif", "image/gif"],
  [".webp", "image/webp"],
  [".avif", "image/avif"],
  [".bmp", "image/bmp"],
  [".pdf", "application/pdf"],
  [".txt", "text/plain; charset=utf-8"],
  [".md", "text/markdown; charset=utf-8"],
  [".markdown", "text/markdown; charset=utf-8"],
  [".mp3", "audio/mpeg"],
  [".mp4", "video/mp4"],
  [".mov", "video/quicktime"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
  [".ttf", "font/ttf"],
]);

function sendJson(res, statusCode, value) {
  const data = JSON.stringify(value);
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "content-length": Buffer.byteLength(data),
  });
  res.end(data);
}

async function sendTextFile(res, file, contentType) {
  const info = await stat(file);
  res.writeHead(200, {
    "content-type": contentType,
    "content-length": info.size,
  });
  createReadStream(file).on("error", (err) => res.destroy(err)).pipe(res);
}

async function atomicWriteFile(file, data, options) {
  await mkdir(dirname(file), { recursive: true });
  const tmp = join(dirname(file), `.${basename(file)}.${process.pid}.${Date.now()}.${++atomicWriteCounter}.tmp`);
  try {
    await writeFile(tmp, data, options);
    await rename(tmp, file);
  } catch (err) {
    await rm(tmp, { force: true }).catch(() => {});
    throw err;
  }
}

async function serveStaticFile(req, res, staticDir) {
  if (!staticDir || req.method !== "GET") return false;
  const url = new URL(req.url || "/", `http://${host}:${port}`);
  const pathname = decodeURIComponent(url.pathname);
  const requested = pathname === "/" ? "index.html" : pathname.replace(/^\/+/, "");
  const file = resolve(staticDir, requested);
  if (!inside(file, staticDir)) {
    res.statusCode = 403;
    res.end("Forbidden");
    return true;
  }
  try {
    const info = await stat(file);
    if (!info.isFile()) return false;
    const dot = file.lastIndexOf(".");
    const ext = dot >= 0 ? file.slice(dot).toLowerCase() : "";
    await sendTextFile(res, file, contentTypes.get(ext) || "application/octet-stream");
    return true;
  } catch {
    if (pathname !== "/") return serveStaticFile({ ...req, url: "/" }, res, staticDir);
    return false;
  }
}

async function serveKindAsset(req, res) {
  if (req.method !== "GET") return false;
  const url = new URL(req.url || "/", `http://${host}:${port}`);
  if (!url.pathname.startsWith("/kinds/")) return false;
  const root = resolve(workspaceRoot, "kinds");
  const requested = decodeURIComponent(url.pathname.slice("/kinds/".length));
  const file = resolve(root, requested);
  if (!inside(file, root)) {
    res.statusCode = 403;
    res.end("Forbidden");
    return true;
  }
  try {
    const info = await stat(file);
    if (!info.isFile()) {
      res.statusCode = 404;
      res.end("Not found");
      return true;
    }
    await sendTextFile(res, file, fileContentType(file));
    return true;
  } catch {
    res.statusCode = 404;
    res.end("Not found");
    return true;
  }
}

function inside(child, parent) {
  const rel = relative(parent, child);
  return rel === "" || (!rel.startsWith("..") && !isAbsolute(rel));
}

function safeFile(input) {
  const file = resolve(String(input || ""));
  if (!inside(file, noteRoot)) {
    const err = new Error(`File is outside note root: ${file}`);
    err.statusCode = 403;
    throw err;
  }
  return file;
}

function standaloneMarkdownFile(file) {
  return /\.(?:md|markdown)$/i.test(file);
}

function safeOpenFile(input) {
  const file = resolve(String(input || ""));
  if (inside(file, noteRoot)) return file;
  if (standaloneMarkdownFile(file)) return file;
  const err = new Error(`File is outside note root: ${file}`);
  err.statusCode = 403;
  throw err;
}

function standaloneFile(file) {
  return !inside(file, noteRoot);
}

function fileContentType(file) {
  return contentTypes.get(extname(file).toLowerCase()) || "application/octet-stream";
}

function sanitizeAssetName(input, fallback = "attachment") {
  const raw = basename(String(input || fallback)).normalize("NFKC");
  const safe = raw
    .replace(/[\u0000-\u001f<>:"/\\|?*]+/g, "-")
    .replace(/\s+/g, "-")
    .trim()
    .replace(/^\.+$/, "");
  return safe || fallback;
}

function imageAssetP(name, type = "") {
  if (String(type).toLowerCase().startsWith("image/")) return true;
  return new Set([".avif", ".bmp", ".gif", ".jpeg", ".jpg", ".png", ".svg", ".webp"])
    .has(extname(name).toLowerCase());
}

async function uniqueAssetPath(dir, name) {
  const ext = extname(name);
  const stem = basename(name, ext) || "attachment";
  let candidate = join(dir, name);
  for (let i = 2; existsSync(candidate); i++) {
    candidate = join(dir, `${stem}-${i}${ext}`);
  }
  return candidate;
}

function markdownRelativePath(fromFile, targetFile) {
  const fromDir = fromFile ? dirname(safeOpenFile(fromFile)) : noteRoot;
  let rel = relative(fromDir, targetFile).split(sep).join("/");
  if (!rel.startsWith(".") && !rel.startsWith("/")) rel = `./${rel}`;
  return rel;
}

function assetFolderName(current) {
  if (!current) return "scratch";
  const ext = extname(current);
  return sanitizeAssetName(basename(current, ext), "note");
}

function resolveMediaFile(file, base = "") {
  const raw = String(file || "");
  if (!raw) {
    const err = new Error("Missing media file");
    err.statusCode = 400;
    throw err;
  }
  const baseFile = base ? safeOpenFile(base) : "";
  const baseDir = baseFile ? dirname(baseFile) : noteRoot;
  const allowedRoot = baseFile && standaloneFile(baseFile) ? baseDir : noteRoot;
  const resolved = isAbsolute(raw) ? resolve(raw) : resolve(baseDir, raw);
  if (!inside(resolved, noteRoot) && !inside(resolved, allowedRoot)) {
    const err = new Error(`Media file is outside the current document folder: ${resolved}`);
    err.statusCode = 403;
    throw err;
  }
  return resolved;
}

async function storeAsset(body) {
  const current = body.file ? safeOpenFile(body.file) : "";
  const originalName = sanitizeAssetName(body.name, imageAssetP("", body.type) ? "image.png" : "attachment");
  const isImage = imageAssetP(originalName, body.type);
  const baseDir = current ? dirname(current) : noteRoot;
  const allowedRoot = current && standaloneFile(current) ? baseDir : noteRoot;
  const targetDir = join(baseDir, isImage ? "images" : "attachments", assetFolderName(current));
  if (!inside(targetDir, noteRoot) && !inside(targetDir, allowedRoot)) {
    const err = new Error(`Asset directory is outside the current document folder: ${targetDir}`);
    err.statusCode = 403;
    throw err;
  }
  const rawData = String(body.data || "");
  if (!rawData) {
    const err = new Error("Missing asset data");
    err.statusCode = 400;
    throw err;
  }
  const target = await uniqueAssetPath(targetDir, originalName);
  await mkdir(targetDir, { recursive: true });
  await writeFile(target, Buffer.from(rawData, "base64"));
  return {
    ok: true,
    file: target,
    name: basename(target),
    type: fileContentType(target),
    isImage,
    markdownPath: markdownRelativePath(current, target),
  };
}

async function pathSuggestionsForFile(file) {
  const current = file ? safeOpenFile(file) : "";
  const scanRoot = current && standaloneFile(current) ? dirname(current) : noteRoot;
  const out = new Set();
  async function walk(dir) {
    let entries = [];
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith(".")) continue;
      const full = join(dir, entry.name);
      if (!inside(full, scanRoot)) continue;
      if (entry.isDirectory()) {
        if (excludedDirs.has(entry.name)) continue;
        out.add(`${markdownRelativePath(current, full)}/`);
        await walk(full);
        continue;
      }
      if (!entry.isFile()) continue;
      const ext = extname(entry.name).toLowerCase();
      if (!contentTypes.has(ext) && !imageAssetP(entry.name)) continue;
      out.add(markdownRelativePath(current, full));
    }
  }
  await walk(scanRoot);
  return [...out].sort((a, b) => a.localeCompare(b)).slice(0, 2000);
}

function assetCandidateFile(file) {
  const relParts = relative(noteRoot, file).split(sep).map((part) => part.toLowerCase());
  if (!relParts.includes("images") && !relParts.includes("attachments")) return false;
  const ext = extname(file).toLowerCase();
  return !noteExts.has(ext) && basename(file) !== ".aaronnote-keep";
}

function resolveReferencedAsset(href, noteFile) {
  const protocol = hrefProtocol(href);
  if (protocol && protocol !== "file") return "";
  const rawPath = hrefPath(href);
  if (!rawPath || rawPath.startsWith("#")) return "";
  const file = isAbsolute(rawPath) ? resolve(rawPath) : resolve(dirname(noteFile), rawPath);
  return inside(file, noteRoot) ? file : "";
}

export function assetRefsFromContent(content, noteFile) {
  const refs = new Set();
  for (const href of markdownLinkHrefs(content)) {
    const file = resolveReferencedAsset(href, noteFile);
    if (file) refs.add(file);
  }
  for (const match of content.matchAll(/\b(?:src|href)\s*=\s*["']([^"']+)["']/gi)) {
    const file = resolveReferencedAsset(match[1], noteFile);
    if (file) refs.add(file);
  }
  return [...refs];
}

async function scanUnusedAssets() {
  const noteFiles = await walkFiles(noteScanRoot, (file) => {
    const dot = file.lastIndexOf(".");
    return dot >= 0 && noteExts.has(file.slice(dot).toLowerCase());
  });
  const referenced = new Set();
  await mapLimit(noteFiles, scanConcurrency, async (file) => {
    try {
      const content = await readFile(file, "utf8");
      for (const ref of assetRefsFromContent(content, file)) referenced.add(ref);
    } catch {}
  });
  const files = await walkFiles(noteRoot, assetCandidateFile);
  const assets = await mapLimit(files, scanConcurrency, async (file) => {
    try {
      const info = await stat(file);
      if (!info.isFile() || referenced.has(file)) return null;
      const rel = relative(noteRoot, file).split(sep).join("/");
      return {
        file,
        path: rel,
        name: basename(file),
        type: fileContentType(file),
        size: info.size,
        mtimeMs: info.mtimeMs,
        isImage: imageAssetP(file),
      };
    } catch {}
    return null;
  });
  return assets
    .filter(Boolean)
    .sort((a, b) => String(a.path).localeCompare(String(b.path)));
}

async function trashUnusedAssets(body) {
  const requested = Array.isArray(body.files) ? body.files.map((file) => resolve(String(file || ""))) : [];
  if (requested.length === 0) return { type: "unused-assets-trash", ok: true, trashed: [], skipped: [], assets: await scanUnusedAssets() };
  const assets = await scanUnusedAssets();
  const byFile = new Map(assets.map((asset) => [asset.file, asset]));
  const trashed = [];
  const skipped = [];
  for (const file of requested) {
    const asset = byFile.get(file);
    if (!asset) {
      skipped.push(file);
      continue;
    }
    try {
      trashed.push({ ...asset, trashedTo: await moveToTrash(asset.file) });
    } catch {
      skipped.push(file);
    }
  }
  return { type: "unused-assets-trash", ok: true, trashed, skipped, assets: await scanUnusedAssets() };
}

function recentStoreFile() {
  return join(workspaceRoot, "var", "Aaronnote", "recent.json");
}

function normalizeRecentNotes(entries) {
  if (!Array.isArray(entries)) return [];
  const byFile = new Map();
  for (const item of entries) {
    const file = item && typeof item.file === "string" ? item.file : "";
    const openedAt = item && typeof item.openedAt === "number" ? item.openedAt : NaN;
    if (!file || !Number.isFinite(openedAt)) continue;
    let safe;
    try {
      safe = safeOpenFile(file);
    } catch {
      continue;
    }
    const current = byFile.get(safe);
    if (!current || openedAt > current.openedAt) byFile.set(safe, { file: safe, openedAt });
  }
  return [...byFile.values()].sort((a, b) => b.openedAt - a.openedAt).slice(0, 24);
}

async function readRecentNotes() {
  try {
    const raw = await readFile(recentStoreFile(), "utf8");
    return normalizeRecentNotes(JSON.parse(raw));
  } catch {
    return [];
  }
}

async function writeRecentNotes(entries) {
  const file = recentStoreFile();
  await atomicWriteFile(file, `${JSON.stringify(normalizeRecentNotes(entries), null, 2)}\n`, "utf8");
}

async function touchRecentNote(file, openedAt = Date.now()) {
  const safe = safeOpenFile(file);
  const recent = await readRecentNotes();
  const next = normalizeRecentNotes([{ file: safe, openedAt }, ...recent]);
  await writeRecentNotes(next);
  return next;
}

function positionStoreFile() {
  return join(workspaceRoot, "var", "Aaronnote", "positions.json");
}

function pluginOverridesStoreFile() {
  return join(workspaceRoot, "var", "Aaronnote", "plugin-overrides.json");
}

function normalizePluginOverrides(value) {
  const overrides = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const out = {};
  for (const [id, state] of Object.entries(overrides)) {
    if (!id || (state !== "on" && state !== "off")) continue;
    out[String(id)] = state;
  }
  return out;
}

async function readPluginOverrides() {
  try {
    const raw = await readFile(pluginOverridesStoreFile(), "utf8");
    return normalizePluginOverrides(JSON.parse(raw));
  } catch {
    return {};
  }
}

async function writePluginOverrides(overrides) {
  const next = normalizePluginOverrides(overrides);
  await atomicWriteFile(pluginOverridesStoreFile(), `${JSON.stringify(next, null, 2)}\n`, "utf8");
  return next;
}

function normalizeCursorPositions(entries) {
  if (!Array.isArray(entries)) return [];
  const byFile = new Map();
  for (const item of entries) {
    const file = item && typeof item.file === "string" ? item.file : "";
    if (!file) continue;
    let safe;
    try {
      safe = safeOpenFile(file);
    } catch {
      continue;
    }
    const from = item && typeof item.from === "number" && Number.isFinite(item.from) ? Math.max(0, item.from) : 0;
    const to = item && typeof item.to === "number" && Number.isFinite(item.to) ? Math.max(0, item.to) : from;
    const scrollY = item && typeof item.scrollY === "number" && Number.isFinite(item.scrollY) ? Math.max(0, item.scrollY) : 0;
    const updatedAt = item && typeof item.updatedAt === "number" && Number.isFinite(item.updatedAt) ? item.updatedAt : 0;
    const mode = item && item.mode === "source" ? "source" : "markdown";
    const current = byFile.get(safe);
    if (!current || updatedAt > current.updatedAt) {
      byFile.set(safe, { file: safe, mode, from, to, scrollY, updatedAt });
    }
  }
  return [...byFile.values()].sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 240);
}

async function readCursorPositions() {
  try {
    const raw = await readFile(positionStoreFile(), "utf8");
    return normalizeCursorPositions(JSON.parse(raw));
  } catch {
    return [];
  }
}

async function writeCursorPositions(entries) {
  const file = positionStoreFile();
  await atomicWriteFile(file, `${JSON.stringify(normalizeCursorPositions(entries), null, 2)}\n`, "utf8");
}

async function touchCursorPosition(body) {
  const safe = safeOpenFile(body.file);
  const current = await readCursorPositions();
  const next = normalizeCursorPositions([{ ...body, file: safe, updatedAt: Number(body.updatedAt) || Date.now() }, ...current]);
  await writeCursorPositions(next);
  return next;
}

function modeForFile(file) {
  const lower = file.toLowerCase();
  return lower.endsWith(".md") || lower.endsWith(".markdown") ? "markdown" : "source";
}

function parseListValue(value) {
  const trimmed = String(value || "").trim();
  if (!trimmed) return [];
  if (trimmed.startsWith("(")) {
    return [...trimmed.matchAll(/"((?:[^"\\]|\\.)*)"/g)]
      .map((match) => match[1].replace(/\\"/g, '"').replace(/\\\\/g, "\\"))
      .filter(Boolean);
  }
  return trimmed.split(/[, ]+/).map((item) => item.trim()).filter(Boolean);
}

function parseMetaScalar(value) {
  let trimmed = String(value || "").trim();
  if ((trimmed.startsWith('"') && trimmed.endsWith('"')) || (trimmed.startsWith("'") && trimmed.endsWith("'"))) {
    trimmed = trimmed.slice(1, -1);
  }
  if (trimmed === "true" || trimmed === "false") return trimmed === "true";
  return trimmed.replace(/\\_/g, "_");
}

function parseMetaLines(raw) {
  const meta = {};
  let currentList = "";
  for (const rawLine of raw.split(/\r?\n/)) {
    const item = rawLine.match(/^\s*-\s*(.+?)\s*$/);
    if (item && currentList) {
      if (!Array.isArray(meta[currentList])) meta[currentList] = [];
      meta[currentList].push(parseMetaScalar(item[1]));
      continue;
    }
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const pair = line.match(/^([A-Za-z0-9_-]+)\s*:\s*(.*)$/);
    if (!pair) continue;
    const key = pair[1].toLowerCase();
    const value = pair[2].trim();
    if (!value) {
      meta[key] = [];
      currentList = key;
      continue;
    }
    if (key === "tags" || key === "refs" || key === "aliases") {
      meta[key] = parseListValue(value);
    } else {
      meta[key] = parseMetaScalar(value);
    }
    currentList = "";
  }
  return meta;
}

function parseFrontMatter(content) {
  const match = String(content || "").match(/^\s*---\s*\r?\n([\s\S]*?)\r?\n---\s*(?:\r?\n|$)/);
  return match ? parseMetaLines(match[1]) : {};
}

function parseMetaBlock(content) {
  const match = content.match(/^\s*#\+begin\s+meta\s*\r?\n([\s\S]*?)\r?\n\s*#\+end\s+meta\s*$/im);
  return match ? parseMetaLines(match[1]) : {};
}

function metaBlockRange(content) {
  const match = content.match(/^\s*#\+begin\s+meta\s*\r?\n[\s\S]*?\r?\n\s*#\+end\s+meta\s*(?:\r?\n)*/im);
  if (!match || match.index == null) return null;
  return { from: match.index, to: match.index + match[0].length, text: match[0] };
}

function hasRoamMeta(content) {
  return Object.keys(noteMetadata(content)).length > 0;
}

function normalizeTags(tags) {
  return [...new Set((Array.isArray(tags) ? tags : parseListValue(tags))
    .map((tag) => String(tag).trim())
    .filter(Boolean))].sort((a, b) => a.localeCompare(b));
}

function ensureDate(value = "") {
  return String(value || new Date().toISOString().slice(0, 10));
}

function buildMetaBlock(fields) {
  const tags = normalizeTags(fields.tags || []);
  const refs = normalizeTags(fields.refs || []);
  const aliases = normalizeTags(fields.aliases || []);
  const lines = [
    "#+begin meta",
    `id: ${fields.id}`,
    `title: ${fields.title}`,
    `date: ${ensureDate(fields.date)}`,
    `kind: ${fields.kind || defaultNoteKind}`,
    `tags: ${tags.join(", ")}`,
    `refs: ${refs.join(", ")}`,
  ];
  if (aliases.length > 0) lines.push(`aliases: ${aliases.join(", ")}`);
  if (fields.source) lines.push(`source: ${fields.source}`);
  if (fields.summary) lines.push(`summary: ${String(fields.summary).replace(/\r?\n/g, " ")}`);
  lines.push("#+end meta", "");
  return lines.join("\n");
}

function metaFieldsForFile(file, content, patch = {}) {
  const current = noteMetadata(content);
  const title = String(patch.title || current.title || titleFromContent(file, content) || basename(file, extname(file)) || "Untitled").trim();
  const id = String(patch.id || current.id || `${timestampId()}-${slugifyTitle(title)}`).trim();
  return {
    ...current,
    ...patch,
    id,
    title,
    date: ensureDate(patch.date || current.date),
    kind: normalizeNoteKind(patch.kind || current.kind || defaultNoteKind),
    tags: normalizeTags(patch.tags ?? current.tags ?? []),
    refs: normalizeTags(patch.refs ?? current.refs ?? []),
    aliases: normalizeTags(patch.aliases ?? current.aliases ?? []),
  };
}

function removeMetaBlock(content) {
  const range = metaBlockRange(content);
  if (!range) return content;
  return `${content.slice(0, range.from)}${content.slice(range.to)}`.replace(/^\s+/, "");
}

function upsertMetaBlock(file, content, patch = {}) {
  const nextMeta = buildMetaBlock(metaFieldsForFile(file, content, patch));
  const body = removeMetaBlock(content);
  return `${nextMeta}\n${body.replace(/^\s+/, "")}`;
}

function yamlishValue(content, key) {
  return content.match(new RegExp(`^\\s*${key}:\\s*"([^"]+)"`, "m"))?.[1]
    || content.match(new RegExp(`^\\s*${key}:\\s*([^\\n]+)`, "m"))?.[1]?.trim();
}

function typstUnescape(value) {
  return String(value || "")
    .replace(/\\n/g, "\n")
    .replace(/\\t/g, "\t")
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\");
}

function parseTypstMetadata(content) {
  const match = content.match(/#metadata\s*\(\(([\s\S]*?)\)\)\s*<note>/m);
  if (!match) return {};
  const body = match[1];
  const fields = {};
  const pairs = [...body.matchAll(/([A-Za-z0-9_-]+)\s*:\s*/g)];
  for (let i = 0; i < pairs.length; i++) {
    const key = pairs[i][1].toLowerCase();
    const start = pairs[i].index + pairs[i][0].length;
    const end = i + 1 < pairs.length ? pairs[i + 1].index : body.length;
    const raw = body.slice(start, end).trim().replace(/,\s*$/, "").trim();
    if (!raw) continue;
    if (raw.startsWith("(")) {
      fields[key] = [...raw.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((item) => typstUnescape(item[1]));
    } else if (raw === "true" || raw === "false") {
      fields[key] = raw === "true";
    } else {
      const string = raw.match(/"((?:[^"\\]|\\.)*)"/);
      fields[key] = string ? typstUnescape(string[1]) : raw;
    }
  }
  return fields;
}

function noteMetadata(content) {
  return {
    ...parseFrontMatter(content),
    ...parseTypstMetadata(content),
    ...parseMetaBlock(content),
  };
}

function desktopExportPath(file) {
  const raw = file ? file.split(sep).pop() || "Aaronnote.md" : "Aaronnote.md";
  const safe = raw.replace(/[/:]/g, "-") || "Aaronnote.md";
  return join(homedir(), "Desktop", safe);
}

function pdfExportName(file) {
  const raw = file ? file.split(sep).pop() || "Aaronnote.pdf" : "Aaronnote.pdf";
  const stem = raw.replace(/\.[^.]+$/, "") || "Aaronnote";
  return `${stem}.pdf`.replace(/[/:]/g, "-");
}

function slugifyTitle(title) {
  const slug = String(title || "untitled")
    .normalize("NFKD")
    .replace(/[^\w\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .toLowerCase();
  return slug || "untitled";
}

function timestampId() {
  const now = new Date();
  const pad = (value) => String(value).padStart(2, "0");
  return [
    now.getFullYear(),
    pad(now.getMonth() + 1),
    pad(now.getDate()),
    "T",
    pad(now.getHours()),
    pad(now.getMinutes()),
    pad(now.getSeconds()),
  ].join("");
}

function markdownForPdf(content) {
  return String(content ?? "")
    .replace(/^\s*#\+begin\s+meta\s*\n[\s\S]*?\n\s*\\?#\+end\s+meta\s*\n*/i, "")
    .replace(/^#\+begin\s+([A-Za-z][\w-]*)(?:\s+([^\n]+))?\s*$/gmi, (_m, kind, title = "") => {
      const label = String(kind).toLowerCase() === "summary" ? "Summary" : String(kind);
      return `::: {.${String(kind).toLowerCase()}}\n**${label}${title ? `: ${title}` : ""}.**`;
    })
    .replace(/^\\?#\+end\s+[A-Za-z][\w-]*\s*$/gmi, ":::");
}

async function exportPdf(file, content) {
  const dir = await mkdtemp(join(tmpdir(), "aaronnote-pdf-"));
  const input = join(dir, "input.md");
  const out = join(dir, "output.pdf");
  await writeFile(input, markdownForPdf(content), "utf8");
  try {
    await execFileAsync("pandoc", [
      input,
      "--from=markdown+tex_math_dollars+fenced_divs",
      "--pdf-engine=xelatex",
      "-V", "mainfont=Times New Roman",
      "-V", "CJKmainfont=FZLiuGongQuanKaiShuJF",
      "-V", "mathfont=GFS Neohellenic Math",
      "-V", "geometry:margin=1in",
      "-o", out,
    ], {
      cwd: noteRoot,
      maxBuffer: 1024 * 1024 * 8,
    });
    return {
      name: pdfExportName(file),
      data: await readFile(out),
    };
  } catch (err) {
    const message = [err.message, err.stderr, err.stdout].filter(Boolean).join("\n");
    const next = new Error(message || "PDF export failed");
    next.statusCode = 500;
    throw next;
  }
  finally {
    await rm(dir, { recursive: true, force: true });
  }
}

function titleFromContent(file, content) {
  const meta = noteMetadata(content);
  if (meta.title) return String(meta.title);
  const typTitle = yamlishValue(content, "title");
  if (typTitle) return typTitle;
  const typHeading = content.match(/^=+\s+(.+)$/m)?.[1]?.trim();
  if (typHeading) return typHeading;
  const mdHeading = content.match(/^#+\s+(.+)$/m)?.[1]?.trim();
  if (mdHeading) return mdHeading;
  return file.split(sep).pop()?.replace(/\.[^.]+$/, "") || "Untitled";
}

function idFromContent(file, root, content) {
  const meta = noteMetadata(content);
  return meta.id || yamlishValue(content, "id") || relative(root, file);
}

function tagsFromContent(content) {
  const meta = noteMetadata(content);
  if (Array.isArray(meta.tags)) return meta.tags;
  const tags = [];
  const lines = content.split(/\r?\n/);
  const start = lines.findIndex((line) => /^\s*tags:\s*$/.test(line));
  if (start >= 0) {
    for (const line of lines.slice(start + 1)) {
      const item = line.match(/^\s*-\s*(.+)$/);
      if (!item) break;
      tags.push(item[1].trim());
    }
  }
  return tags;
}

function decodeRef(ref) {
  let decoded = String(ref || "");
  try {
    decoded = decodeURIComponent(decoded);
  } catch {
    decoded = String(ref || "");
  }
  return decoded.replace(/\\([\\`*_[\](){}#+.!<>-])/g, "$1");
}

function refFromRoamHref(href) {
  const match = String(href || "").trim().match(/^roam:\/\/(.+)$/i);
  if (!match) return "";
  return decodeRef(
    match[1]
      .split(/[?#]/, 1)[0]
      .replace(/^\/+/, "")
      .replace(/[.,;:]+$/, ""),
  ).trim();
}

function hrefProtocol(href) {
  return String(href || "").trim().match(/^([A-Za-z][\w+.-]*):/)?.[1]?.toLowerCase() || "";
}

function hrefPath(href) {
  const raw = String(href || "").trim();
  if (/^file:\/\//i.test(raw)) {
    try {
      return decodeRef(new URL(raw).pathname);
    } catch {
      return decodeRef(raw.replace(/^file:\/\//i, ""));
    }
  }
  if (/^file:/i.test(raw)) return decodeRef(raw.replace(/^file:/i, "").split(/[?#]/, 1)[0] || "");
  return decodeRef(raw.split(/[?#]/, 1)[0] || "");
}

function noteFileRefFromHref(href) {
  const protocol = hrefProtocol(href);
  if (protocol && protocol !== "file") return "";
  const path = hrefPath(href);
  return /\.(?:md|markdown|typ)$/i.test(path) ? path : "";
}

function markdownEscapedAt(text, pos) {
  let slashes = 0;
  for (let i = pos - 1; i >= 0 && text[i] === "\\"; i--) slashes++;
  return slashes % 2 === 1;
}

function markdownLabelClose(text, open) {
  let depth = 0;
  for (let i = open + 1; i < text.length; i++) {
    const ch = text[i];
    if (ch === "\\" && i + 1 < text.length) {
      i++;
      continue;
    }
    if (ch === "[") {
      depth++;
      continue;
    }
    if (ch !== "]") continue;
    if (depth === 0) return i;
    depth--;
  }
  return -1;
}

function skipMarkdownSpaces(text, pos) {
  while (pos < text.length && /[ \t]/.test(text[pos])) pos++;
  return pos;
}

function parseMarkdownTitle(text, pos) {
  if (text[pos] !== '"') return null;
  let title = "";
  for (let i = pos + 1; i < text.length; i++) {
    const ch = text[i];
    if (ch === "\\" && i + 1 < text.length) {
      title += ch + text[i + 1];
      i++;
      continue;
    }
    if (ch === '"') return { title, end: i + 1 };
    if (ch === "\n" || ch === "\r") return null;
    title += ch;
  }
  return null;
}

function parseMarkdownDestination(text, pos) {
  let cursor = skipMarkdownSpaces(text, pos);
  let href = "";
  if (text[cursor] === ")") return { href, end: cursor + 1 };
  if (text[cursor] === "<") {
    let end = -1;
    for (let i = cursor + 1; i < text.length; i++) {
      const ch = text[i];
      if (ch === "\n" || ch === "\r") return null;
      if (ch === ">" && !markdownEscapedAt(text, i)) {
        end = i;
        break;
      }
    }
    if (end < 0) return null;
    href = text.slice(cursor + 1, end);
    cursor = end + 1;
  } else {
    const start = cursor;
    let depth = 0;
    for (; cursor < text.length; cursor++) {
      const ch = text[cursor];
      if (ch === "\n" || ch === "\r") return null;
      if (ch === "\\" && cursor + 1 < text.length) {
        cursor++;
        continue;
      }
      if (ch === "(") {
        depth++;
        continue;
      }
      if (ch === ")") {
        if (depth === 0) break;
        depth--;
        continue;
      }
      if (depth === 0 && /[ \t]/.test(ch)) break;
    }
    href = text.slice(start, cursor);
  }
  cursor = skipMarkdownSpaces(text, cursor);
  if (text[cursor] !== ")") {
    const title = parseMarkdownTitle(text, cursor);
    if (!title) return null;
    cursor = skipMarkdownSpaces(text, title.end);
  }
  if (text[cursor] !== ")") return null;
  return { href, end: cursor + 1 };
}

function markdownLinkHrefs(text) {
  const hrefs = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== "[" || markdownEscapedAt(text, i)) continue;
    const labelClose = markdownLabelClose(text, i);
    if (labelClose < 0 || text[labelClose + 1] !== "(") continue;
    const dest = parseMarkdownDestination(text, labelClose + 2);
    if (!dest) continue;
    hrefs.push(dest.href);
    i = dest.end - 1;
  }
  return hrefs;
}

export function refsFromContent(content) {
  const meta = noteMetadata(content);
  const refs = new Set(Array.isArray(meta.refs) ? meta.refs : []);
  for (const match of content.matchAll(/#note\("([^"]+)"\)/g)) refs.add(match[1]);
  for (const match of content.matchAll(/\[\[([^\]\n]+)\]\]/g)) refs.add(match[1].trim());
  for (const href of markdownLinkHrefs(content)) {
    const noteRef = noteFileRefFromHref(href);
    if (noteRef) refs.add(noteRef);
    if (/^roam:\/\//i.test(href)) refs.add(refFromRoamHref(href));
  }
  for (const match of content.matchAll(/\broam:\/\/[^\s<>)\]]+/gi)) {
    refs.add(refFromRoamHref(match[0]));
  }
  return [...refs].filter(Boolean);
}

function aliasesFromContent(content) {
  const meta = noteMetadata(content);
  return Array.isArray(meta.aliases) ? meta.aliases : [];
}

function dateFromContent(content) {
  const meta = noteMetadata(content);
  return String(meta.date || yamlishValue(content, "date") || "");
}

function sourceFromContent(content) {
  const meta = noteMetadata(content);
  return String(meta.source || "");
}

function normalizeNoteKind(value) {
  const item = Array.isArray(value) ? value[0] : value;
  const kind = String(item || "").trim().replace(/\\_/g, "_").toLowerCase();
  if (defaultNoteKindAliases.has(kind)) return defaultNoteKind;
  return noteKindPattern.test(kind) ? kind : defaultNoteKind;
}

export function kindFromContent(content) {
  const meta = noteMetadata(content);
  return normalizeNoteKind(meta.kind ?? meta.kinds ?? defaultNoteKind);
}

export function activeKindFromContent(content) {
  const kind = kindFromContent(content);
  return kind === defaultNoteKind ? "" : kind;
}

function summaryFromContent(content) {
  const meta = noteMetadata(content);
  if (meta.summary) return String(meta.summary);
  const withoutMeta = content
    .replace(/^\s*#\+begin\s+meta\s*\r?\n[\s\S]*?\r?\n\s*#\+end\s+meta\s*\r?\n*/im, "")
    .replace(/#metadata\s*\(\([\s\S]*?\)\)\s*<note>/m, "")
    .replace(/^#(?:import|show|set)[^\n]*$/gm, "")
    .replace(/#note\("([^"]+)"\)\[([^\]]+)\]/g, "$2")
    .replace(/^=+\s+/gm, "")
    .replace(/^#+\s+/gm, "")
    .replace(/[#*_`$()[\]{}]/g, " ");
  return withoutMeta.split(/\s+/).filter(Boolean).join(" ").slice(0, 220);
}

function groupKeyFor(file) {
  const parent = dirname(relative(noteScanRoot, file));
  return parent === "." ? "Root" : parent;
}

function groupLabelFor(groupKey) {
  if (!groupKey || groupKey === "Root") return "Root";
  const leaf = groupKey.split(sep).filter(Boolean).at(-1) || groupKey;
  return leaf.toUpperCase() === leaf ? leaf : leaf.replace(/[-_]/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());
}

function preferNote(candidate, current) {
  if (!current) return candidate;
  if (candidate.ext === "md" && current.ext !== "md") return candidate;
  if (candidate.path && candidate.path === current.source) return candidate;
  return current;
}

async function walkFiles(root, accept) {
  const files = [];
  async function walk(dir) {
    let entries = [];
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const entry of entries) {
      if (entry.name.startsWith(".") && entry.name !== ".emacs.d") continue;
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        if (!excludedDirs.has(entry.name)) await walk(full);
      } else if (entry.isFile() && accept(full, entry.name)) {
        files.push(full);
      }
    }
  }
  await walk(root);
  return files;
}

async function mapLimit(items, limit, mapper) {
  const out = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      out[index] = await mapper(items[index], index);
    }
  });
  await Promise.all(workers);
  return out;
}

async function scanNotes() {
  if (noteCacheRoot !== noteScanRoot) {
    noteCacheRoot = noteScanRoot;
    noteCache = new Map();
  }
  const files = await walkFiles(noteScanRoot, (file) => {
    const dot = file.lastIndexOf(".");
    return dot >= 0 && noteExts.has(file.slice(dot).toLowerCase());
  });
  const notes = [];
  const seen = new Set(files);
  const scanned = await mapLimit(files, scanConcurrency, async (file) => {
    try {
      const info = await stat(file);
      const cached = noteCache.get(file);
      if (cached && cached.mtimeMs === info.mtimeMs && cached.size === info.size) {
        return { ...cached.note, backlinks: [] };
      }
      const content = await readFile(file, "utf8");
      const relPath = relative(noteScanRoot, file);
      const groupKey = groupKeyFor(file);
      const id = idFromContent(file, noteScanRoot, content);
      const roam = hasRoamMeta(content);
      const note = {
        key: id,
        id,
        title: titleFromContent(file, content),
        file,
        link: relPath,
        path: relPath,
        ext: file.slice(file.lastIndexOf(".") + 1).toLowerCase(),
        kind: kindFromContent(content),
        date: dateFromContent(content),
        groupKey,
        groupLabel: groupLabelFor(groupKey),
        section: groupKey.includes(sep) ? groupKey.split(sep)[0] : groupKey,
        source: sourceFromContent(content),
        aliases: aliasesFromContent(content),
        summary: summaryFromContent(content),
        tags: tagsFromContent(content),
        refs: refsFromContent(content),
        backlinks: [],
        roam,
      };
      noteCache.set(file, { mtimeMs: info.mtimeMs, size: info.size, note });
      return { ...note };
    } catch {}
    return null;
  });
  for (const note of scanned) if (note) notes.push(note);
  for (const file of noteCache.keys()) {
    if (!seen.has(file)) noteCache.delete(file);
  }
  const uniqueNotes = [...notes.reduce((map, note) => {
    map.set(note.id, preferNote(note, map.get(note.id)));
    return map;
  }, new Map()).values()];
  const byId = new Map(uniqueNotes.map((note) => [note.id, note]));
  const byRel = new Map(uniqueNotes.map((note) => [relative(noteScanRoot, note.file), note]));
  const byBase = new Map(uniqueNotes.map((note) => [note.file.split(sep).pop(), note]));
  const bySource = new Map(uniqueNotes.filter((note) => note.source).map((note) => [note.source, note]));
  for (const note of uniqueNotes) {
    const resolved = [];
    for (const ref of note.refs || []) {
      const target = byId.get(ref) || byRel.get(ref) || byBase.get(ref) || bySource.get(ref) || byRel.get(ref.replace(/^\.\//, ""));
      if (!target || target.id === note.id) continue;
      resolved.push(target.id);
      target.backlinks.push(note.id);
    }
    note.refs = [...new Set(resolved)].sort();
  }
  for (const note of uniqueNotes) note.backlinks = [...new Set(note.backlinks)].sort();
  return uniqueNotes.sort((a, b) => a.title.localeCompare(b.title));
}

const todoStatuses = new Set(["todo", "doing", "done", "blocked"]);

export function normalizeTodoStatus(raw = "") {
  const value = String(raw || "").trim().toLowerCase();
  if (!value || value === " " || value === "open" || value === "unchecked") return "todo";
  if (value === "~" || value === "-" || value === "wip" || value === "active") return "doing";
  if (value === "x" || value === "checked" || value === "complete") return "done";
  if (value === "!" || value === "block") return "blocked";
  return todoStatuses.has(value) ? value : "todo";
}

function cleanCommandArgValue(value = "") {
  return String(value).trim().replace(/^["']|["']$/g, "");
}

export function parseCommandArgs(raw = "") {
  const body = String(raw || "").trim().replace(/^\{/, "").replace(/\}$/, "").trim();
  const args = {};
  if (!body) return args;
  for (const part of body.split(/[;,]/)) {
    const split = part.trim().match(/^([A-Za-z][\w-]*)\s*:\s*(.+)$/);
    if (!split) continue;
    const key = split[1].trim().toLowerCase();
    const value = cleanCommandArgValue(split[2]);
    if (!key || !value) continue;
    args[key] = value;
  }
  return args;
}

function findInlineCommandClose(text, open, closeChar) {
  for (let i = open + 1; i < text.length; i++) {
    const ch = text[i];
    if (ch === "\\" && i + 1 < text.length) {
      i++;
      continue;
    }
    if (ch === "\n" || ch === "\r") return -1;
    if (ch === closeChar) return i;
  }
  return -1;
}

function inlineCommandMetaRange(text, closeBracket) {
  let openBrace = closeBracket + 1;
  while (openBrace < text.length && (text[openBrace] === " " || text[openBrace] === "\t")) openBrace++;
  if (text[openBrace] !== "{") return { raw: "", fullTo: closeBracket + 1 };
  const closeBrace = findInlineCommandClose(text, openBrace, "}");
  if (closeBrace < 0) return { raw: "", fullTo: closeBracket + 1 };
  return {
    raw: text.slice(openBrace, closeBrace + 1),
    fullTo: closeBrace + 1,
  };
}

export function scanInlineCommands(text, name = "") {
  const commands = [];
  const re = /@@([A-Za-z][\w-]*)(?:\(([^)\n]*)\))?[ \t]+\[/g;
  let match;
  while ((match = re.exec(text))) {
    const commandName = match[1].toLowerCase();
    if (name && commandName !== String(name).toLowerCase()) continue;
    const openBracket = re.lastIndex - 1;
    const closeBracket = findInlineCommandClose(text, openBracket, "]");
    if (closeBracket < 0) continue;
    const meta = inlineCommandMetaRange(text, closeBracket);
    commands.push({
      name: commandName,
      switchValue: String(match[2] || "").trim(),
      context: text.slice(openBracket + 1, closeBracket),
      argsRaw: meta.raw,
      args: parseCommandArgs(meta.raw),
      fullFrom: match.index,
      fullTo: meta.fullTo,
      contextFrom: openBracket + 1,
      contextTo: closeBracket,
    });
    re.lastIndex = meta.fullTo;
  }
  return commands;
}

export function extractTodos(content, note, updatedAt) {
  const todos = [];
  const lineStarts = [0];
  for (let i = 0; i < content.length; i++) {
    if (content[i] === "\n") lineStarts.push(i + 1);
  }
  const lineFor = (index) => {
    let lo = 0;
    let hi = lineStarts.length - 1;
    while (lo <= hi) {
      const mid = Math.floor((lo + hi) / 2);
      if (lineStarts[mid] <= index) lo = mid + 1;
      else hi = mid - 1;
    }
    return Math.max(0, hi) + 1;
  };
  for (const command of scanInlineCommands(content, "todo")) {
    const source = content.slice(command.fullFrom, command.fullTo);
    const text = String(command.context || "").replace(/\\([\]\\])/g, "$1").trim();
    const status = normalizeTodoStatus(command.switchValue);
    const args = command.args;
    const line = lineFor(command.fullFrom);
    const lineStart = lineStarts[line - 1] || 0;
    const lineEnd = content.indexOf("\n", lineStart);
    const rawLine = content.slice(lineStart, lineEnd < 0 ? content.length : lineEnd).trim();
    todos.push({
      id: `${note.file}:${command.fullFrom}`,
      status,
      text,
      args,
      meta: command.argsRaw,
      ddl: args.ddl || "",
      source,
      index: command.fullFrom,
      line,
      column: command.fullFrom - lineStart + 1,
      context: rawLine,
      file: note.file,
      path: note.path,
      noteKey: note.key,
      noteId: note.id,
      noteTitle: note.title,
      noteDate: note.date || "",
      groupKey: note.groupKey || "",
      groupLabel: note.groupLabel || "",
      updatedAt,
    });
  }
  return todos;
}

async function scanTodos() {
  if (todoCacheRoot !== noteScanRoot) {
    todoCacheRoot = noteScanRoot;
    todoCache = new Map();
  }
  const scanned = await scanNotes();
  const seen = new Set(scanned.map((note) => note.file).filter(Boolean));
  const todoGroups = await mapLimit(scanned, scanConcurrency, async (note) => {
    try {
      const info = await stat(note.file);
      const cached = todoCache.get(note.file);
      if (cached && cached.mtimeMs === info.mtimeMs && cached.size === info.size) {
        return cached.todos.map((todo) => ({ ...todo }));
      }
      const content = await readFile(note.file, "utf8");
      const todos = extractTodos(content, note, info.mtimeMs);
      todoCache.set(note.file, { mtimeMs: info.mtimeMs, size: info.size, todos });
      return todos.map((todo) => ({ ...todo }));
    } catch {}
    todoCache.delete(note.file);
    return [];
  });
  for (const file of todoCache.keys()) {
    if (!seen.has(file)) todoCache.delete(file);
  }
  const todos = todoGroups.flat();
  return todos.sort((a, b) => {
    const statusRank = { blocked: 0, doing: 1, todo: 2, done: 3 };
    return (statusRank[a.status] ?? 9) - (statusRank[b.status] ?? 9)
      || b.updatedAt - a.updatedAt
      || String(a.noteTitle).localeCompare(String(b.noteTitle));
  });
}

function snippetDirs() {
  const raw = process.env.AARONNOTE_SNIPPETS;
  const dirs = raw
    ? raw.split(":").filter(Boolean)
    : [
        join(appDir, "snippets"),
      ];

  return [...new Set(dirs.map((dir) => resolve(dir)).filter((dir) => existsSync(dir)))];
}

async function snippetRoots() {
  const roots = snippetDirs().map((dir) => ({ dir, kind: "" }));
  const kindRoots = [
    resolve(workspaceRoot, "kinds"),
    resolve(appDir, "..", "kinds"),
    resolve(process.cwd(), "kinds"),
  ].filter((dir, index, dirs) => dirs.indexOf(dir) === index && existsSync(dir));
  for (const kindsRoot of kindRoots) {
    try {
      const entries = await readdir(kindsRoot, { withFileTypes: true });
      for (const entry of entries) {
        if (!entry.isDirectory()) continue;
        const kind = normalizeNoteKind(entry.name);
        if (kind === defaultNoteKind || kind !== entry.name.toLowerCase()) continue;
        const dir = resolve(kindsRoot, entry.name, "snippet");
        if (existsSync(dir) && !roots.some((root) => root.dir === dir)) roots.push({ dir, kind });
      }
    } catch {}
  }
  return roots;
}

function parseSnippetBody(content) {
  const lines = content.split(/\r?\n/);
  const headers = new Map();
  let bodyStart = 0;
  for (let i = 0; i < lines.length; i++) {
    const marker = lines[i].match(/^# --\s*$/);
    if (marker) {
      bodyStart = i + 1;
      break;
    }
    const header = lines[i].match(/^#\s*([^:\n]+):\s*(.*)$/);
    if (header) headers.set(header[1].trim().toLowerCase(), header[2].trim());
  }
  return {
    headers,
    body: lines.slice(bodyStart).join("\n").replace(/\s+$/, ""),
  };
}

export async function scanSnippets(options = {}) {
  const roots = await snippetRoots();
  const key = roots.map((root) => `${root.kind}@${root.dir}`).join(":");
  const now = Date.now();
  if (!options.force && snippetCache.key === key && now - snippetCache.scannedAt < 10_000) {
    return snippetCache.snippets;
  }
  const snippets = [];
  for (const root of roots) {
    const files = await walkFiles(root.dir, (_file, name) => !name.startsWith(".") && !name.endsWith(".el"));
    for (const file of files) {
      try {
        const content = await readFile(file, "utf8");
        const { headers, body } = parseSnippetBody(content);
        if (!body.trim()) continue;
        const rel = relative(root.dir, file);
        const parts = rel.split(sep);
        const mode = parts[0] || "";
        const key = headers.get("key") || parts.at(-1) || "snippet";
        snippets.push({
          key,
          name: headers.get("name") || key,
          mode,
          group: headers.get("group") || "",
          kind: root.kind,
          body,
          source: file,
        });
      } catch {}
    }
  }
  snippetCache = {
    key,
    scannedAt: now,
    snippets: snippets.sort((a, b) => `${a.kind}/${a.mode}/${a.key}`.localeCompare(`${b.kind}/${b.mode}/${b.key}`)),
  };
  return snippetCache.snippets;
}

export async function scanPlugins(options = {}) {
  const root = resolve(pluginRoot);
  const key = root;
  const now = Date.now();
  if (!options.force && pluginCache.key === key && now - pluginCache.scannedAt < 10_000) {
    return pluginCache.plugins;
  }
  const plugins = [];
  if (existsSync(root)) {
    const entries = await readdir(root, { withFileTypes: true }).catch(() => []);
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith(".")) continue;
      const dir = resolve(root, entry.name);
      const manifestFile = resolve(dir, "plugin.json");
      try {
        const manifest = JSON.parse(await readFile(manifestFile, "utf8"));
        const id = String(manifest.id || entry.name).trim();
        if (!id || !/^[a-z0-9_-]+$/i.test(id)) continue;
        plugins.push({
          id,
          name: String(manifest.name || id),
          version: String(manifest.version || ""),
          entry: String(manifest.entry || ""),
          autoload: manifest.autoload === true,
          path: relative(workspaceRoot, dir).replace(/\\/g, "/"),
          commands: Array.isArray(manifest.commands) ? manifest.commands.map(String) : [],
          blocks: Array.isArray(manifest.blocks) ? manifest.blocks.map(String) : [],
          actions: Array.isArray(manifest.actions) ? manifest.actions : [],
          settings: Array.isArray(manifest.settings) ? manifest.settings : [],
        });
      } catch {}
    }
  }
  pluginCache = {
    key,
    scannedAt: now,
    plugins: plugins.sort((a, b) => a.id.localeCompare(b.id)),
  };
  return pluginCache.plugins;
}

export function offsetToPosition(text, offset) {
  const source = String(text || "");
  const target = Math.max(0, Math.min(Number(offset) || 0, source.length));
  let line = 0;
  let lineStart = 0;
  for (let i = 0; i < target; i++) {
    if (source.charCodeAt(i) !== 10) continue;
    line++;
    lineStart = i + 1;
  }
  return { line, character: target - lineStart };
}

export function positionToOffset(text, position) {
  const source = String(text || "");
  const targetLine = Math.max(0, Number(position?.line) || 0);
  const targetChar = Math.max(0, Number(position?.character) || 0);
  let line = 0;
  let lineStart = 0;
  for (let i = 0; i < source.length && line < targetLine; i++) {
    if (source.charCodeAt(i) !== 10) continue;
    line++;
    lineStart = i + 1;
  }
  let lineEnd = source.indexOf("\n", lineStart);
  if (lineEnd < 0) lineEnd = source.length;
  return Math.max(lineStart, Math.min(lineStart + targetChar, lineEnd));
}

function languageIdForFile(file) {
  const ext = extname(String(file || "")).toLowerCase();
  if (ext === ".md" || ext === ".markdown") return "markdown";
  if (ext === ".typ") return "typst";
  if (ext === ".ts") return "typescript";
  if (ext === ".js" || ext === ".mjs" || ext === ".cjs") return "javascript";
  if (ext === ".json") return "json";
  if (ext === ".tex") return "latex";
  return "plaintext";
}

function copilotUriForFile(file) {
  if (typeof file === "string" && file.trim()) {
    try {
      return pathToFileURL(safeOpenFile(file)).href;
    } catch {}
  }
  return pathToFileURL(join(noteRoot, ".aaronnote-copilot.md")).href;
}

function uniqueExistingCommands(commands) {
  const seen = new Set();
  const out = [];
  for (const cmd of commands) {
    const key = `${cmd.command}\0${cmd.args.join("\0")}`;
    if (seen.has(key)) continue;
    if (cmd.mustExist && !existsSync(cmd.mustExist)) continue;
    seen.add(key);
    out.push(cmd);
  }
  return out;
}

function unpackedAsarPath(file) {
  return String(file || "").replace(/\.asar(?=$|[\\/])/, ".asar.unpacked");
}

function nodeCommand() {
  if (process.env.AARONNOTE_NODE) return process.env.AARONNOTE_NODE;
  if (process.versions?.electron) return "node";
  return process.execPath;
}

function appendCopilotLog(event, detail = {}) {
  copilotLog.push({
    at: new Date().toISOString(),
    event,
    ...detail,
  });
  if (copilotLog.length > 200) copilotLog = copilotLog.slice(-200);
}

function pushCopilotLog(event, detail = {}) {
  if (!copilotLogRecording) return;
  appendCopilotLog(event, detail);
}

function setCopilotLogRecording(enabled, options = {}) {
  if (options.clear) copilotLog = [];
  copilotLogRecording = enabled;
  appendCopilotLog(enabled ? "recording-started" : "recording-stopped", {});
}

function rawCopilotServerCommands() {
  const configured = process.env.AARONNOTE_COPILOT_LANGUAGE_SERVER;
  if (configured) return [{ command: configured, args: ["--stdio"] }];
  const binFile = join(appDir, "node_modules", ".bin", "copilot-language-server");
  const serverFile = join(appDir, "node_modules", "@github", "copilot-language-server", "dist", "language-server.js");
  const unpackedBin = unpackedAsarPath(binFile);
  const unpackedServer = unpackedAsarPath(serverFile);
  const resourceServer = process.resourcesPath
    ? join(process.resourcesPath, "app.asar.unpacked", "node_modules", "@github", "copilot-language-server", "dist", "language-server.js")
    : "";
  const commands = [];
  if (!appDir.includes(".asar")) {
    commands.push(
      { command: binFile, args: ["--stdio"], mustExist: binFile },
      { command: nodeCommand(), args: [serverFile, "--stdio"], mustExist: serverFile },
    );
  }
  for (const file of [unpackedBin, unpackedServer, resourceServer]) {
    if (!file) continue;
    if (process.versions?.electron) {
      commands.push({
        command: process.execPath,
        args: [file, "--stdio"],
        env: { ELECTRON_RUN_AS_NODE: "1" },
        mustExist: file,
      });
    } else {
      commands.push({ command: file, args: ["--stdio"], mustExist: file });
      commands.push({ command: nodeCommand(), args: [file, "--stdio"], mustExist: file });
    }
  }
  return commands;
}

function copilotServerCommands() {
  return uniqueExistingCommands(rawCopilotServerCommands());
}

function copilotDiagnostics() {
  return {
    type: "copilot-log",
    now: new Date().toISOString(),
    platform: process.platform,
    arch: process.arch,
    pid: process.pid,
    execPath: process.execPath,
    nodeCommand: nodeCommand(),
    electron: process.versions?.electron || "",
    appDir,
    childProcessCwd: copilotProcessCwd(),
    workspaceRoot,
    noteRoot,
    resourcesPath: process.resourcesPath || "",
    logRecording: copilotLogRecording,
    env: {
      AARONNOTE_COPILOT_LANGUAGE_SERVER: process.env.AARONNOTE_COPILOT_LANGUAGE_SERVER || "",
      AARONNOTE_NODE: process.env.AARONNOTE_NODE || "",
      ELECTRON_RUN_AS_NODE: process.env.ELECTRON_RUN_AS_NODE || "",
      PATH: process.env.PATH || "",
    },
    rawCommands: rawCopilotServerCommands().map((cmd) => ({
      command: cmd.command,
      args: cmd.args,
      env: cmd.env || {},
      mustExist: cmd.mustExist || "",
      exists: cmd.mustExist ? existsSync(cmd.mustExist) : existsSync(cmd.command),
    })),
    runnableCommands: copilotServerCommands().map((cmd) => ({
      command: cmd.command,
      args: cmd.args,
      env: cmd.env || {},
      mustExist: cmd.mustExist || "",
    })),
    client: copilotClient
      ? {
          hasProcess: !!copilotClient.proc,
          pid: copilotClient.proc?.pid || 0,
          status: copilotClient.status,
          pending: copilotClient.pending?.size || 0,
          documents: copilotClient.documents?.size || 0,
        }
      : null,
    log: copilotLog,
  };
}

function openExternalUri(uri) {
  if (!/^https?:\/\//i.test(String(uri || ""))) return;
  pushCopilotLog("open-uri", { uri });
  if (process.platform === "darwin") {
    execFile("open", [uri], () => {});
  }
  return uri;
}

function findFirstExternalUri(value, depth = 0) {
  if (depth > 5 || value == null) return "";
  if (typeof value === "string") return /^https?:\/\//i.test(value) ? value : "";
  if (Array.isArray(value)) {
    for (const item of value) {
      const uri = findFirstExternalUri(item, depth + 1);
      if (uri) return uri;
    }
    return "";
  }
  if (typeof value === "object") {
    for (const item of Object.values(value)) {
      const uri = findFirstExternalUri(item, depth + 1);
      if (uri) return uri;
    }
  }
  return "";
}

function findStringByKey(value, pattern, depth = 0) {
  if (depth > 5 || value == null || typeof value !== "object") return "";
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = findStringByKey(item, pattern, depth + 1);
      if (found) return found;
    }
    return "";
  }
  for (const [key, item] of Object.entries(value)) {
    if (pattern.test(key) && typeof item === "string" && item) return item;
    const found = findStringByKey(item, pattern, depth + 1);
    if (found) return found;
  }
  return "";
}

function deviceCodeFromText(text) {
  const value = String(text || "");
  const match = value.match(/\b([A-Z0-9]{4}-[A-Z0-9]{4})\b/i) || value.match(/\b([A-Z0-9]{8})\b/i);
  return match ? match[1].toUpperCase().replace(/^([A-Z0-9]{4})([A-Z0-9]{4})$/, "$1-$2") : "";
}

function copilotProcessCwd() {
  if (appDir.includes(".asar")) return dirname(appDir);
  return appDir;
}

class CopilotLspClient {
  constructor() {
    this.proc = null;
    this.buffer = Buffer.alloc(0);
    this.nextId = 1;
    this.pending = new Map();
    this.documents = new Map();
    this.status = { message: "Not started", kind: "Inactive", busy: false };
    this.ready = null;
    this.lastAuthCode = "";
    this.lastAuthMessage = "";
  }

  async ensureReady() {
    if (this.ready) return this.ready;
    this.ready = this.start();
    return this.ready;
  }

  async start() {
    const commands = copilotServerCommands();
    pushCopilotLog("start", { commands: commands.map((cmd) => ({ command: cmd.command, args: cmd.args, env: cmd.env || {} })) });
    if (commands.length === 0) {
      pushCopilotLog("missing-server", { rawCommands: copilotDiagnostics().rawCommands });
      throw new Error("Copilot language server is not installed. Run npm install @github/copilot-language-server.");
    }
    let lastError = null;
    for (const cmd of commands) {
      try {
        await this.startCommand(cmd);
        pushCopilotLog("started", { command: cmd.command, args: cmd.args, pid: this.proc?.pid || 0 });
        return;
      } catch (err) {
        lastError = err;
        pushCopilotLog("start-failed", {
          command: cmd.command,
          args: cmd.args,
          message: err instanceof Error ? err.message : String(err),
          code: err?.code || "",
        });
        this.stop();
      }
    }
    throw lastError ?? new Error("Copilot language server failed to start");
  }

  failPending(err) {
    for (const pending of this.pending.values()) pending.reject(err);
    this.pending.clear();
  }

  async startCommand(cmd) {
    const proc = spawn(cmd.command, cmd.args, {
      cwd: copilotProcessCwd(),
      env: cmd.env ? { ...process.env, ...cmd.env } : process.env,
      stdio: ["pipe", "pipe", "pipe"],
    });
    pushCopilotLog("spawn", { command: cmd.command, args: cmd.args, cwd: copilotProcessCwd(), env: cmd.env || {}, pid: proc.pid || 0 });
    this.proc = proc;
    proc.stdout.on("data", (chunk) => this.receive(chunk));
    proc.stderr.on("data", (chunk) => {
      const msg = String(chunk || "").trim();
      if (msg) {
        pushCopilotLog("stderr", { message: msg });
        console.warn(`Copilot LSP: ${msg}`);
      }
    });
    proc.once("error", (err) => {
      if (this.proc !== proc) return;
      pushCopilotLog("error", { message: err.message, code: err.code || "" });
      this.failPending(err);
      this.proc = null;
      this.ready = null;
      this.status = { message: err.message, kind: "Error", busy: false };
    });
    proc.once("exit", (code, signal) => {
      if (this.proc !== proc) return;
      const err = new Error(`Copilot language server exited (${signal || (code ?? "unknown")})`);
      pushCopilotLog("exit", { code, signal });
      this.failPending(err);
      this.proc = null;
      this.ready = null;
      this.documents.clear();
      this.status = { message: err.message, kind: "Error", busy: false };
    });

    await this.request("initialize", {
      processId: process.pid,
      rootUri: pathToFileURL(workspaceRoot).href,
      workspaceFolders: [{ uri: pathToFileURL(workspaceRoot).href, name: basename(workspaceRoot) || "workspace" }],
      capabilities: {
        workspace: { workspaceFolders: true, configuration: true },
        window: { showDocument: { support: true } },
        textDocument: {},
      },
      initializationOptions: {
        editorInfo: { name: "Aaronnote", version: "0.3.1" },
        editorPluginInfo: { name: "Aaronnote Copilot", version: "0.1.0" },
      },
    });
    this.notify("initialized", {});
    this.notify("workspace/didChangeConfiguration", {
      settings: {
        telemetry: { telemetryLevel: "all" },
      },
    });
    this.status = { message: "Ready", kind: "Normal", busy: false };
  }

  send(value) {
    if (!this.proc?.stdin?.writable) throw new Error("Copilot language server is not running");
    const body = Buffer.from(JSON.stringify(value), "utf8");
    const header = Buffer.from(`Content-Length: ${body.length}\r\n\r\n`, "utf8");
    this.proc.stdin.write(Buffer.concat([header, body]));
  }

  request(method, params) {
    const id = this.nextId++;
    this.send({ jsonrpc: "2.0", id, method, params });
    return new Promise((resolveRequest, reject) => {
      this.pending.set(id, { resolve: resolveRequest, reject });
      windowSetTimeout(() => {
        const pending = this.pending.get(id);
        if (!pending) return;
        this.pending.delete(id);
        pending.reject(new Error(`Copilot request timed out: ${method}`));
      }, 30_000);
    });
  }

  notify(method, params) {
    this.send({ jsonrpc: "2.0", method, params });
  }

  respond(id, result, error = null) {
    if (error) this.send({ jsonrpc: "2.0", id, error });
    else this.send({ jsonrpc: "2.0", id, result });
  }

  receive(chunk) {
    this.buffer = Buffer.concat([this.buffer, Buffer.from(chunk)]);
    while (true) {
      const headerEnd = this.buffer.indexOf("\r\n\r\n");
      if (headerEnd < 0) return;
      const header = this.buffer.slice(0, headerEnd).toString("utf8");
      const match = header.match(/content-length:\s*(\d+)/i);
      if (!match) {
        this.buffer = this.buffer.slice(headerEnd + 4);
        continue;
      }
      const length = Number(match[1]);
      const start = headerEnd + 4;
      const end = start + length;
      if (this.buffer.length < end) return;
      const raw = this.buffer.slice(start, end).toString("utf8");
      this.buffer = this.buffer.slice(end);
      try {
        this.handle(JSON.parse(raw));
      } catch (err) {
        console.warn("Copilot LSP parse failed", err);
      }
    }
  }

  handle(message) {
    if (Object.prototype.hasOwnProperty.call(message, "id") && (Object.prototype.hasOwnProperty.call(message, "result") || message.error)) {
      const pending = this.pending.get(message.id);
      if (!pending) return;
      this.pending.delete(message.id);
      if (message.error) pending.reject(new Error(message.error.message || "Copilot request failed"));
      else pending.resolve(message.result);
      return;
    }
    if (message.method === "didChangeStatus") {
      this.status = message.params || this.status;
      return;
    }
    if (message.method === "window/logMessage") {
      const msg = message.params?.message;
      if (msg) console.warn(`Copilot LSP: ${msg}`);
      return;
    }
    if (message.method === "window/showDocument") {
      openExternalUri(message.params?.uri);
      this.respond(message.id, { success: true });
      return;
    }
    if (message.method === "workspace/configuration") {
      const items = Array.isArray(message.params?.items) ? message.params.items : [];
      this.respond(message.id, items.map(() => ({})));
      return;
    }
    if (message.method === "window/showMessageRequest") {
      const text = String(message.params?.message || "");
      const code = deviceCodeFromText(text);
      if (code) {
        this.lastAuthCode = code;
        this.lastAuthMessage = text;
      }
      pushCopilotLog("show-message-request", {
        message: text,
        code,
        actions: Array.isArray(message.params?.actions) ? message.params.actions : [],
      });
      const actions = Array.isArray(message.params?.actions) ? message.params.actions : [];
      this.respond(message.id, actions[0] ?? null);
      return;
    }
    if (Object.prototype.hasOwnProperty.call(message, "id")) {
      this.respond(message.id, null);
    }
  }

  syncDocument(uri, file, content) {
    const languageId = languageIdForFile(file);
    const current = this.documents.get(uri);
    if (!current) {
      const version = 1;
      this.documents.set(uri, { version, content, languageId });
      this.notify("textDocument/didOpen", {
        textDocument: { uri, languageId, version, text: content },
      });
      return { version, languageId };
    }
    if (current.content !== content) {
      const version = current.version + 1;
      this.notify("textDocument/didChange", {
        textDocument: { uri, version },
        contentChanges: [{
          range: { start: { line: 0, character: 0 }, end: offsetToPosition(current.content, current.content.length) },
          rangeLength: current.content.length,
          text: content,
        }],
      });
      this.documents.set(uri, { version, content, languageId });
      return { version, languageId };
    }
    return { version: current.version, languageId: current.languageId };
  }

  async inline(body) {
    await this.ensureReady();
    const content = String(body.content || "");
    const file = String(body.file || "");
    const offset = Math.max(0, Math.min(Number(body.offset) || 0, content.length));
    const uri = copilotUriForFile(file);
    const { version } = this.syncDocument(uri, file, content);
    this.notify("textDocument/didFocus", { textDocument: { uri } });
    const result = await this.request("textDocument/inlineCompletion", {
      textDocument: { uri, version },
      position: offsetToPosition(content, offset),
      context: { triggerKind: 2 },
      formattingOptions: { tabSize: 2, insertSpaces: true },
    });
    const item = Array.isArray(result?.items) ? result.items.find((candidate) => typeof candidate?.insertText === "string") : null;
    if (!item) return { type: "copilot-inline", items: [], status: this.status };
    const range = item.range
      ? {
          from: positionToOffset(content, item.range.start),
          to: positionToOffset(content, item.range.end),
        }
      : { from: offset, to: offset };
    return {
      type: "copilot-inline",
      items: [{
        insertText: item.insertText,
        range,
        item,
      }],
      status: this.status,
    };
  }

  async shown(body) {
    await this.ensureReady();
    if (body?.item) this.notify("textDocument/didShowCompletion", { item: body.item });
    return { ok: true };
  }

  async accept(body) {
    await this.ensureReady();
    const item = body?.item;
    if (!item) return { ok: false };
    const acceptedLength = Number(body.acceptedLength);
    if (Number.isFinite(acceptedLength) && acceptedLength >= 0 && acceptedLength < String(item.insertText || "").length) {
      this.notify("textDocument/didPartiallyAcceptCompletion", { item, acceptedLength });
      return { ok: true, partial: true };
    }
    if (item.command?.command) {
      await this.request("workspace/executeCommand", {
        command: item.command.command,
        arguments: Array.isArray(item.command.arguments) ? item.command.arguments : [],
      });
    }
    return { ok: true };
  }

  async signIn() {
    await this.ensureReady();
    this.lastAuthCode = "";
    this.lastAuthMessage = "";
    const result = await this.request("signIn", {});
    pushCopilotLog("sign-in-result", { result });
    const resultUri = findStringByKey(result, /^(verificationUri|verification_uri|verificationUriComplete|verification_uri_complete|uri|url)$/i)
      || findFirstExternalUri(result);
    const userCode = findStringByKey(result, /^(userCode|user_code|code)$/i) || this.lastAuthCode || deviceCodeFromText(this.lastAuthMessage);
    const openedUri = result?.status === "AlreadySignedIn"
      ? openExternalUri("https://github.com/settings/copilot")
      : openExternalUri(resultUri);
    if (result?.command?.command) {
      void this.request("workspace/executeCommand", {
        command: result.command.command,
        arguments: Array.isArray(result.command.arguments) ? result.command.arguments : [],
      }).catch((err) => {
        console.warn("Copilot sign-in command failed", err);
      });
    }
    const message = result?.status === "AlreadySignedIn"
      ? `Already signed in${result?.user ? ` as ${result.user}` : ""}; opened GitHub Copilot settings`
      : openedUri
        ? userCode
          ? `Opened GitHub login; code ${userCode}`
          : "Opened GitHub login"
        : userCode
          ? `Copilot login code ${userCode}`
          : "Copilot login did not return a device code";
    return { type: "copilot-sign-in", ...result, openedUri, userCode, message, status: this.status };
  }

  async signOut() {
    await this.ensureReady();
    await this.request("signOut", {});
    return { ok: true, status: this.status };
  }

  async quota() {
    await this.ensureReady();
    const result = await this.request("checkQuota", {}).catch((err) => ({ error: err.message }));
    return { type: "copilot-quota", result };
  }

  stop() {
    this.proc?.kill();
    this.proc = null;
    this.ready = null;
  }
}

function windowSetTimeout(fn, ms) {
  return setTimeout(fn, ms);
}

function getCopilotClient() {
  if (!copilotClient) copilotClient = new CopilotLspClient();
  return copilotClient;
}

async function handleCopilotRequest(action, body = {}) {
  if (action === "log") {
    if (body?.record === true) {
      setCopilotLogRecording(true, { clear: body?.clear !== false });
      return { ...copilotDiagnostics(), message: "Copilot log recording started" };
    }
    if (body?.record === false) {
      setCopilotLogRecording(false);
      return { ...copilotDiagnostics(), message: "Copilot logs recorded" };
    }
    return copilotDiagnostics();
  }
  const overrides = await readPluginOverrides();
  if (overrides.copilot === "off" && !["sign-in", "sign-out"].includes(action)) {
    copilotClient?.stop();
    return { ok: false, disabled: true, message: "Copilot plugin is disabled", status: { message: "Disabled", kind: "Inactive", busy: false } };
  }
  const client = getCopilotClient();
  if (action === "inline") return client.inline(body);
  if (action === "shown") return client.shown(body);
  if (action === "accept") return client.accept(body);
  if (action === "sign-in") return client.signIn();
  if (action === "sign-out") return client.signOut();
  if (action === "quota") return client.quota();
  if (action === "status") {
    await client.ensureReady();
    return { type: "copilot-status", status: client.status };
  }
  return { ok: false, message: "Unknown Copilot action" };
}

const defaultCodexSearchPaths = [
  "/opt/homebrew/bin/codex",
  "/usr/local/bin/codex",
  "/usr/bin/codex",
  "/bin/codex",
];

export function codexEnvPath(basePath = process.env.PATH || "") {
  const extras = [
    "/opt/homebrew/bin",
    "/opt/homebrew/sbin",
    "/usr/local/bin",
    "/usr/local/sbin",
    "/usr/bin",
    "/bin",
  ];
  const parts = String(basePath || "").split(":").filter(Boolean);
  for (const entry of extras) {
    if (!parts.includes(entry)) parts.push(entry);
  }
  return parts.join(":");
}

export function codexCommand() {
  const configured = String(process.env.AARONNOTE_CODEX || process.env.CODEX || "").trim();
  if (configured) return configured;
  for (const candidate of defaultCodexSearchPaths) {
    if (existsSync(candidate)) return candidate;
  }
  return "codex";
}

function codexSpawnError(err) {
  if (err && typeof err === "object" && err.code === "ENOENT") {
    const command = codexCommand();
    return new Error(
      `Codex executable not found: ${command}. Set AARONNOTE_CODEX or CODEX to the full path, for example /opt/homebrew/bin/codex.`,
    );
  }
  return err;
}

function roamLookupPromptFile() {
  return resolve(String(process.env.AARONNOTE_LOOKUP_PROMPT || join(workspaceRoot, "agent", "skill", "lookup.md")));
}

function shortSessionId() {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

function stripAnsi(text) {
  return String(text || "")
    .replace(/\u001b\[[0-?]*[ -/]*[@-~]/g, "")
    .trim();
}

class RoamLookupSession {
  constructor() {
    this.id = shortSessionId();
    this.createdAt = Date.now();
    this.lastInteraction = this.createdAt;
    this.history = [];
    this.proc = null;
    this.idleTimer = null;
    this.busy = false;
    this.closed = false;
    this.status = "Ready";
    this.scheduleIdle();
  }

  summary() {
    return {
      type: "roamlookup-session",
      ok: !this.closed,
      sessionId: this.id,
      busy: this.busy,
      status: this.status,
      idleMs: roamLookupIdleMs,
      createdAt: this.createdAt,
      lastInteraction: this.lastInteraction,
      turns: this.history.length,
    };
  }

  touch() {
    this.lastInteraction = Date.now();
    this.scheduleIdle();
  }

  scheduleIdle() {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    if (this.closed) return;
    const wait = Math.max(1_000, roamLookupIdleMs - (Date.now() - this.lastInteraction));
    this.idleTimer = setTimeout(() => {
      if (this.closed) return;
      if (this.busy) {
        this.scheduleIdle();
        return;
      }
      this.close("idle");
      if (roamLookupSession === this) roamLookupSession = null;
    }, wait);
  }

  close(reason = "closed") {
    this.closed = true;
    this.status = reason === "idle" ? "Idle timeout" : "Closed";
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = null;
    if (this.proc) {
      this.proc.kill("SIGTERM");
      this.proc = null;
    }
    return { ...this.summary(), ok: true, closed: true, reason };
  }

  async buildPrompt(query) {
    const lookupPrompt = await readFile(roamLookupPromptFile(), "utf8");
    const transcript = this.history.slice(-8).map((turn, index) => [
      `### Turn ${index + 1} User`,
      turn.query,
      "",
      `### Turn ${index + 1} Assistant`,
      turn.answer,
    ].join("\n")).join("\n\n");
    return [
      lookupPrompt,
      "## Aaronnote RoamLookup Runtime",
      "You are answering inside Aaronnote. Keep the task read-only. Use local shell search only when needed, and verify precise claims against original Markdown files under roam/.",
      "Answer only the current user query. If the previous turns are relevant, use them as conversation context.",
      transcript ? `## Previous Turns\n\n${transcript}` : "",
      `## Current User Query\n\n${query}`,
    ].filter(Boolean).join("\n\n");
  }

  async ask(query) {
    if (this.closed) {
      const err = new Error("RoamLookup session is closed");
      err.statusCode = 410;
      throw err;
    }
    const cleanQuery = String(query || "").trim();
    if (!cleanQuery) {
      const err = new Error("Missing lookup query");
      err.statusCode = 400;
      throw err;
    }
    if (this.busy) {
      const err = new Error("RoamLookup is already answering");
      err.statusCode = 409;
      throw err;
    }

    this.touch();
    this.busy = true;
    this.status = "Running";
    try {
      const answer = await this.runCodex(await this.buildPrompt(cleanQuery));
      this.history.push({ query: cleanQuery, answer, at: Date.now() });
      if (this.history.length > 12) this.history = this.history.slice(-12);
      this.status = "Ready";
      return { ...this.summary(), answer };
    } catch (err) {
      this.status = err instanceof Error ? err.message : "RoamLookup failed";
      throw err;
    } finally {
      this.busy = false;
      this.proc = null;
      this.touch();
    }
  }

  async runCodex(prompt) {
    const tmp = await mkdtemp(join(tmpdir(), "aaronnote-roamlookup-"));
    const outputFile = join(tmp, "last-message.md");
    const args = [
      "exec",
      "--cd", workspaceRoot,
      "--sandbox", "read-only",
      "--ephemeral",
      "--color", "never",
      "--output-last-message", outputFile,
      "-",
    ];
    let stdout = "";
    let stderr = "";
    try {
      const result = await new Promise((resolveRun, rejectRun) => {
        const proc = spawn(codexCommand(), args, {
          cwd: workspaceRoot,
          env: { ...process.env, PATH: codexEnvPath(process.env.PATH) },
          stdio: ["pipe", "pipe", "pipe"],
        });
        this.proc = proc;
        const timer = setTimeout(() => {
          proc.kill("SIGTERM");
          rejectRun(new Error("RoamLookup query timed out"));
        }, roamLookupQueryTimeoutMs);
        proc.stdout.on("data", (chunk) => {
          stdout += String(chunk || "");
        });
        proc.stderr.on("data", (chunk) => {
          stderr += String(chunk || "");
        });
        proc.once("error", (err) => {
          clearTimeout(timer);
          rejectRun(codexSpawnError(err));
        });
        proc.once("exit", (code, signal) => {
          clearTimeout(timer);
          if (code === 0) resolveRun({ code, signal });
          else rejectRun(new Error(stripAnsi(stderr || stdout) || `Codex exited (${signal || (code ?? "unknown")})`));
        });
        proc.stdin.end(prompt);
      });
      void result;
      const answer = await readFile(outputFile, "utf8").catch(() => "");
      return stripAnsi(answer || stdout) || "RoamLookup returned no answer.";
    } finally {
      await rm(tmp, { recursive: true, force: true }).catch(() => {});
    }
  }
}

function getRoamLookupSession(sessionId = "") {
  if (roamLookupSession && !roamLookupSession.closed) {
    if (!sessionId || sessionId === roamLookupSession.id) return roamLookupSession;
    roamLookupSession.close("replaced");
  }
  roamLookupSession = new RoamLookupSession();
  return roamLookupSession;
}

async function handleRoamLookupRequest(action, body = {}) {
  const overrides = await readPluginOverrides();
  if (overrides.roamlookup === "off") {
    roamLookupSession?.close("disabled");
    roamLookupSession = null;
    return { ok: false, disabled: true, message: "RoamLookup plugin is disabled" };
  }
  if (action === "start") {
    const session = getRoamLookupSession(String(body.sessionId || ""));
    session.touch();
    return session.summary();
  }
  if (action === "query") {
    const session = getRoamLookupSession(String(body.sessionId || ""));
    return session.ask(body.query);
  }
  if (action === "close") {
    const sessionId = String(body.sessionId || "");
    if (roamLookupSession && (!sessionId || sessionId === roamLookupSession.id)) {
      const result = roamLookupSession.close("closed");
      roamLookupSession = null;
      return result;
    }
    return { type: "roamlookup-session", ok: true, closed: true, reason: "missing" };
  }
  if (action === "status") {
    if (!roamLookupSession || roamLookupSession.closed) {
      return { type: "roamlookup-session", ok: false, sessionId: "", busy: false, status: "Not started", idleMs: roamLookupIdleMs };
    }
    return roamLookupSession.summary();
  }
  return { ok: false, message: "Unknown RoamLookup action" };
}

async function readNote(file) {
  const safe = safeOpenFile(file);
  const info = await stat(safe);
  if (!info.isFile()) {
    const err = new Error(`Not a regular file: ${safe}`);
    err.statusCode = 400;
    throw err;
  }
  const content = await readFile(safe, "utf8");
  const standalone = standaloneFile(safe);
  return {
    type: "open",
    file: safe,
    title: titleFromContent(safe, content),
    mode: modeForFile(safe),
    content,
    kind: kindFromContent(content),
    standalone,
    notes: await scanNotes(),
    snippets: await scanSnippets(),
  };
}

function roamDbFile() {
  return join(noteRoot, "roam.db");
}

function sqlString(value) {
  return `'${String(value ?? "").replace(/'/g, "''")}'`;
}

function sqlNumber(value) {
  return Number.isFinite(value) ? String(value) : "0";
}

function notePosition(content) {
  const range = metaBlockRange(content);
  if (!range) return 1;
  return range.to + 1;
}

async function syncRoamDb(notes = null) {
  const scanned = notes ?? await scanNotes();
  const roamNotes = scanned.filter((note) => note.roam && note.file);
  const roamIds = new Set(roamNotes.map((note) => note.id));
  const dbFile = roamDbFile();
  const statements = [
    "PRAGMA foreign_keys = OFF;",
    "BEGIN;",
    `CREATE TABLE IF NOT EXISTS files (
      path text primary key,
      mtime real not null,
      title text,
      node_id text,
      size integer not null default 0
    );`,
    `CREATE TABLE IF NOT EXISTS nodes (
      id text primary key,
      file text not null,
      title text not null,
      date text,
      position integer not null,
      summary text not null default ''
    );`,
    "CREATE TABLE IF NOT EXISTS tags (node_id text not null, tag text not null);",
    "CREATE TABLE IF NOT EXISTS aliases (node_id text not null, alias text not null);",
    "CREATE TABLE IF NOT EXISTS links (source_id text not null, target_id text not null, file text not null, line integer not null, label text);",
    "CREATE INDEX IF NOT EXISTS note_nodes_file_idx on nodes(file);",
    "CREATE INDEX IF NOT EXISTS note_tags_node_idx on tags(node_id);",
    "CREATE INDEX IF NOT EXISTS note_aliases_node_idx on aliases(node_id);",
    "CREATE INDEX IF NOT EXISTS note_links_target_idx on links(target_id);",
    "CREATE INDEX IF NOT EXISTS note_links_source_idx on links(source_id);",
    "DELETE FROM links;",
    "DELETE FROM tags;",
    "DELETE FROM aliases;",
    "DELETE FROM nodes;",
    "DELETE FROM files;",
  ];

  for (const note of roamNotes) {
    let info = null;
    let content = "";
    try {
      info = await stat(note.file);
      content = await readFile(note.file, "utf8");
    } catch {
      continue;
    }
    statements.push(
      `INSERT INTO files(path, mtime, title, node_id, size) VALUES (${[
        sqlString(note.file),
        sqlNumber(info.mtimeMs / 1000),
        sqlString(note.title || ""),
        sqlString(note.id || ""),
        sqlNumber(info.size),
      ].join(", ")});`,
      `INSERT INTO nodes(id, file, title, date, position, summary) VALUES (${[
        sqlString(note.id || ""),
        sqlString(note.file),
        sqlString(note.title || "Untitled"),
        sqlString(note.date || ""),
        sqlNumber(notePosition(content)),
        sqlString(note.summary || ""),
      ].join(", ")});`,
    );
    for (const tag of note.tags || []) {
      statements.push(`INSERT INTO tags(node_id, tag) VALUES (${sqlString(note.id)}, ${sqlString(tag)});`);
    }
    for (const alias of note.aliases || []) {
      statements.push(`INSERT INTO aliases(node_id, alias) VALUES (${sqlString(note.id)}, ${sqlString(alias)});`);
    }
    for (const targetId of note.refs || []) {
      if (!roamIds.has(targetId)) continue;
      statements.push(`INSERT INTO links(source_id, target_id, file, line, label) VALUES (${[
        sqlString(note.id),
        sqlString(targetId),
        sqlString(note.file),
        "1",
        sqlString(""),
      ].join(", ")});`);
    }
  }
  statements.push("COMMIT;");
  await mkdir(dirname(dbFile), { recursive: true });
  await execFileAsync("sqlite3", [dbFile, statements.join("\n")], {
    cwd: noteRoot,
    maxBuffer: 1024 * 1024 * 8,
  });
  return scanned;
}

async function createNode(body) {
  const title = String(body.title || "Untitled").trim() || "Untitled";
  const nodeType = String(body.nodeType || body.type || "roam").toLowerCase() === "regular" ? "regular" : "roam";
  const roam = nodeType === "roam";
  const id = String(body.id || `${timestampId()}-${slugifyTitle(title)}`).trim();
  const tags = Array.isArray(body.tags) ? body.tags.map(String).filter(Boolean) : [];
  const rawPath = String(body.path || body.file || "").trim();
  const directory = String(body.directory || ".").trim() || ".";
  const defaultName = `${slugifyTitle(roam ? id : title)}.md`;
  let relativePath = rawPath
    ? rawPath
    : join(directory, defaultName);
  if (relativePath.endsWith("/") || relativePath.endsWith(sep)) {
    relativePath = join(relativePath, defaultName);
  } else if (!extname(relativePath)) {
    relativePath = `${relativePath}.md`;
  }
  const file = resolve(noteRoot, relativePath);
  if (!inside(file, noteRoot)) {
    const err = new Error(`File is outside note root: ${file}`);
    err.statusCode = 403;
    throw err;
  }
  if (!/\.(?:md|markdown)$/i.test(file)) {
    const err = new Error("New notes must use .md or .markdown");
    err.statusCode = 400;
    throw err;
  }
  const dir = dirname(file);
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, ".aaronnote-keep"), "", { flag: "a" }).catch(() => {});
  if (existsSync(file)) {
    const err = new Error(`Node already exists: ${file}`);
    err.statusCode = 409;
    throw err;
  }
  const content = roam
    ? [
        buildMetaBlock({
          id,
          title,
          date: new Date().toISOString().slice(0, 10),
          kind: body.kind || "note",
          tags,
          refs: [],
        }),
        `# ${title}`,
        "",
      ].join("\n")
    : [`# ${title}`, ""].join("\n");
  await writeFile(file, content, "utf8");
  const opened = await readNote(file);
  if (roam) await syncRoamDb(opened.notes);
  return opened;
}

async function createFolder(body) {
  const rawPath = String(body.path || body.dir || body.folder || "").trim();
  if (!rawPath) {
    const err = new Error("Missing folder path");
    err.statusCode = 400;
    throw err;
  }
  const dir = resolve(noteRoot, rawPath);
  if (!inside(dir, noteRoot)) {
    const err = new Error(`Folder is outside note root: ${dir}`);
    err.statusCode = 403;
    throw err;
  }
  await mkdir(dir, { recursive: true });
  await writeFile(join(dir, ".aaronnote-keep"), "", { flag: "a" }).catch(() => {});
  return {
    ok: true,
    path: relative(noteRoot, dir).split(sep).join("/"),
    notes: await scanNotes(),
  };
}

async function uniqueTrashPath(file) {
  const trashDir = join(homedir(), ".Trash");
  await mkdir(trashDir, { recursive: true });
  const ext = extname(file);
  const stem = basename(file, ext) || "note";
  let target = join(trashDir, basename(file));
  for (let i = 2; existsSync(target); i++) {
    target = join(trashDir, `${stem}-${i}${ext}`);
  }
  return target;
}

async function moveToTrash(file) {
  try {
    const electron = await import("electron");
    if (electron.shell?.trashItem) {
      await electron.shell.trashItem(file);
      return "system-trash";
    }
  } catch {}
  if (process.platform === "darwin") {
    try {
      await execFileAsync("osascript", [
        "-e",
        `tell application "Finder" to delete POSIX file ${JSON.stringify(file)}`,
      ]);
      return "system-trash";
    } catch {}
  }
  const target = await uniqueTrashPath(file);
  await rename(file, target);
  return target;
}

function scheduleRoamDbSync(notes) {
  queuedRoamSyncNotes = notes;
  if (roamSyncTimer) clearTimeout(roamSyncTimer);
  roamSyncTimer = setTimeout(() => {
    const next = queuedRoamSyncNotes;
    queuedRoamSyncNotes = null;
    roamSyncTimer = null;
    void syncRoamDb(next).catch((err) => {
      console.error("Aaronnote roam db sync failed:", err?.message || err);
    });
  }, 1800);
}

async function deleteNote(body) {
  const file = safeFile(body.file);
  const trashedTo = await moveToTrash(file);
  const notes = await scanNotes();
  await syncRoamDb(notes);
  return { type: "deleted", ok: true, file, trashedTo, notes };
}

async function updateCurrentNoteMeta(body, action) {
  const file = safeFile(body.file);
  const content = typeof body.content === "string" ? body.content : await readFile(file, "utf8");
  let next = content;
  if (action === "remove") {
    next = removeMetaBlock(content);
  } else if (action === "tag") {
    const currentTags = tagsFromContent(content);
    const incoming = Array.isArray(body.tags) ? body.tags : parseListValue(body.tags || "");
    next = upsertMetaBlock(file, content, { tags: normalizeTags([...currentTags, ...incoming]) });
  } else {
    next = upsertMetaBlock(file, content, {
      title: body.title,
      tags: body.tags || tagsFromContent(content),
      kind: body.kind || defaultNoteKind,
    });
  }
  if (next !== content) await atomicWriteFile(file, next, "utf8");
  const opened = await readNote(file);
  await syncRoamDb(opened.notes);
  return opened;
}

async function readRequestJson(req) {
  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > maxJsonBodyBytes) {
      const err = new Error(`JSON request body exceeds ${maxJsonBodyBytes} bytes`);
      err.statusCode = 413;
      throw err;
    }
    chunks.push(chunk);
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8") || "{}");
  } catch {
    const err = new Error("Invalid JSON request body");
    err.statusCode = 400;
    throw err;
  }
}

function acceptSaveRequest(file, body) {
  const clientId = typeof body.clientId === "string" ? body.clientId : "";
  const seq = Number(body.seq);
  if (!clientId || !Number.isSafeInteger(seq) || seq <= 0) return true;
  const key = `${clientId}\0${file}`;
  const previous = saveRequestVersions.get(key) ?? 0;
  if (seq < previous) return false;
  saveRequestVersions.set(key, seq);
  if (saveRequestVersions.size > 2000) {
    for (const oldKey of saveRequestVersions.keys()) {
      saveRequestVersions.delete(oldKey);
      if (saveRequestVersions.size <= 1000) break;
    }
  }
  return true;
}

async function enqueueSaveWrite(file, task) {
  const previous = saveWriteQueues.get(file) ?? Promise.resolve();
  const current = previous.catch(() => {}).then(task);
  saveWriteQueues.set(file, current);
  try {
    return await current;
  } finally {
    if (saveWriteQueues.get(file) === current) saveWriteQueues.delete(file);
  }
}

async function routeApi(req, res) {
  const url = new URL(req.url || "/", `http://${host}:${port}`);
  try {
    if (req.method === "GET" && url.pathname === "/api/bootstrap") {
      const notes = await scanNotes();
      const snippets = await scanSnippets();
      const file = url.searchParams.get("file");
      if (file) {
        sendJson(res, 200, await readNote(file));
        return true;
      }
      sendJson(res, 200, {
        type: "open",
        file: "",
        title: "Aaronnote",
        mode: "markdown",
        content: "# Aaronnote\n\nSelect a note from the left, or keep this scratch buffer.",
        notes,
        snippets,
        root: noteRoot,
        noteDir: ".",
      });
      return true;
    }

    if (req.method === "GET" && url.pathname === "/api/file") {
      sendJson(res, 200, await readNote(url.searchParams.get("file")));
      return true;
    }

    if (req.method === "GET" && url.pathname === "/api/notes") {
      sendJson(res, 200, { type: "notes", notes: await scanNotes(), root: noteRoot });
      return true;
    }

    if (req.method === "GET" && url.pathname === "/api/snippets") {
      const force = url.searchParams.get("reload") === "1";
      sendJson(res, 200, { type: "snippets", snippets: await scanSnippets({ force }) });
      return true;
    }

    if (req.method === "GET" && url.pathname === "/api/plugins") {
      const force = url.searchParams.get("reload") === "1";
      sendJson(res, 200, { type: "plugins", plugins: await scanPlugins({ force }), root: pluginRoot });
      return true;
    }

    if (req.method === "GET" && url.pathname === "/api/plugin-overrides") {
      sendJson(res, 200, { type: "plugin-overrides", overrides: await readPluginOverrides() });
      return true;
    }

    if (req.method === "POST" && url.pathname === "/api/plugin-overrides") {
      const body = await readRequestJson(req);
      sendJson(res, 200, { type: "plugin-overrides", overrides: await writePluginOverrides(body?.overrides) });
      return true;
    }

    if (req.method === "GET" && url.pathname === "/api/copilot/status") {
      sendJson(res, 200, await handleCopilotRequest("status"));
      return true;
    }

    if (req.method === "GET" && url.pathname === "/api/roamlookup/status") {
      sendJson(res, 200, await handleRoamLookupRequest("status"));
      return true;
    }

    if (req.method === "GET" && url.pathname === "/api/todos") {
      sendJson(res, 200, { type: "todos", todos: await scanTodos(), root: noteRoot });
      return true;
    }

    if (req.method === "GET" && url.pathname === "/api/roamdb/sync") {
      const notes = await syncRoamDb();
      sendJson(res, 200, { type: "notes", notes, root: noteRoot, db: roamDbFile() });
      return true;
    }

    if (req.method === "GET" && url.pathname === "/api/recent") {
      sendJson(res, 200, { type: "recent", recent: await readRecentNotes() });
      return true;
    }

    if (req.method === "GET" && url.pathname === "/api/positions") {
      sendJson(res, 200, { type: "positions", positions: await readCursorPositions() });
      return true;
    }

    if (req.method === "GET" && url.pathname === "/api/path-suggestions") {
      sendJson(res, 200, {
        type: "path-suggestions",
        paths: await pathSuggestionsForFile(url.searchParams.get("file") || ""),
      });
      return true;
    }

    if (req.method === "GET" && url.pathname === "/api/assets/orphans") {
      sendJson(res, 200, {
        type: "unused-assets",
        assets: await scanUnusedAssets(),
        root: noteRoot,
      });
      return true;
    }

    if (req.method === "POST" && url.pathname === "/api/recent") {
      const body = await readRequestJson(req);
      sendJson(res, 200, {
        type: "recent",
        recent: await touchRecentNote(String(body.file || ""), Number(body.openedAt) || Date.now()),
      });
      return true;
    }

    if (req.method === "POST" && url.pathname === "/api/position") {
      const body = await readRequestJson(req);
      sendJson(res, 200, {
        type: "positions",
        positions: await touchCursorPosition(body),
      });
      return true;
    }

    if (req.method === "POST" && (url.pathname === "/api/node" || url.pathname === "/api/create-node")) {
      sendJson(res, 200, await createNode(await readRequestJson(req)));
      return true;
    }

    if (req.method === "POST" && url.pathname === "/api/folder") {
      sendJson(res, 200, await createFolder(await readRequestJson(req)));
      return true;
    }

    if (req.method === "POST" && url.pathname === "/api/delete") {
      sendJson(res, 200, await deleteNote(await readRequestJson(req)));
      return true;
    }

    if (req.method === "POST" && url.pathname === "/api/assets/orphans/trash") {
      sendJson(res, 200, await trashUnusedAssets(await readRequestJson(req)));
      return true;
    }

    if (req.method === "POST" && url.pathname.startsWith("/api/copilot/")) {
      const action = url.pathname.slice("/api/copilot/".length);
      sendJson(res, 200, await handleCopilotRequest(action, await readRequestJson(req)));
      return true;
    }

    if (req.method === "POST" && url.pathname.startsWith("/api/roamlookup/")) {
      const action = url.pathname.slice("/api/roamlookup/".length);
      sendJson(res, 200, await handleRoamLookupRequest(action, await readRequestJson(req)));
      return true;
    }

    if (req.method === "POST" && url.pathname === "/api/meta/add") {
      sendJson(res, 200, await updateCurrentNoteMeta(await readRequestJson(req), "add"));
      return true;
    }

    if (req.method === "POST" && url.pathname === "/api/meta/remove") {
      sendJson(res, 200, await updateCurrentNoteMeta(await readRequestJson(req), "remove"));
      return true;
    }

    if (req.method === "POST" && url.pathname === "/api/tags/add") {
      sendJson(res, 200, await updateCurrentNoteMeta(await readRequestJson(req), "tag"));
      return true;
    }

    if (req.method === "POST" && url.pathname === "/api/save") {
      const body = await readRequestJson(req);
      const file = safeOpenFile(body.file);
      const wrote = await enqueueSaveWrite(file, async () => {
        if (!acceptSaveRequest(file, body)) return false;
        await atomicWriteFile(file, String(body.content ?? ""), "utf8");
        return true;
      });
      if (!wrote) {
        sendJson(res, 200, { type: "saved", ok: true, file, stale: true, message: "Skipped stale save" });
        return true;
      }
      if (standaloneFile(file)) {
        sendJson(res, 200, { type: "saved", ok: true, file, kind: kindFromContent(String(body.content ?? "")), message: "Saved", standalone: true });
      } else {
        const notes = await scanNotes();
        scheduleRoamDbSync(notes);
        sendJson(res, 200, { type: "saved", ok: true, file, message: "Saved", notes, standalone: false });
      }
      return true;
    }

    if (req.method === "POST" && url.pathname === "/api/asset") {
      sendJson(res, 200, await storeAsset(await readRequestJson(req)));
      return true;
    }

    if (req.method === "GET" && url.pathname === "/api/media") {
      const file = resolveMediaFile(url.searchParams.get("file"), url.searchParams.get("base"));
      const info = await stat(file);
      if (!info.isFile()) {
        const err = new Error(`Not a regular media file: ${file}`);
        err.statusCode = 404;
        throw err;
      }
      await sendTextFile(res, file, fileContentType(file));
      return true;
    }

    if (req.method === "POST" && url.pathname === "/api/export-desktop") {
      const body = await readRequestJson(req);
      const out = desktopExportPath(String(body.file || ""));
      await writeFile(out, String(body.content ?? ""));
      sendJson(res, 200, { type: "exported", ok: true, file: out, message: `Exported ${out}` });
      return true;
    }

    if (req.method === "POST" && url.pathname === "/api/export-pdf") {
      const body = await readRequestJson(req);
      const pdf = await exportPdf(String(body.file || ""), String(body.content ?? ""));
      res.writeHead(200, {
        "content-type": "application/pdf",
        "content-length": pdf.data.length,
        "content-disposition": `attachment; filename="${pdf.name.replace(/"/g, "")}"`,
      });
      res.end(pdf.data);
      return true;
    }
  } catch (err) {
    sendJson(res, err.statusCode || 500, {
      type: "error",
      ok: false,
      message: err.message || String(err),
    });
    return true;
  }
  return false;
}

async function routeRoamTools(req, res) {
  const url = new URL(req.url || "/", `http://${host}:${port}`);
  if (req.method !== "GET") return false;
  if (url.pathname === "/roam-tools/data.js") {
    const notes = (await scanNotes()).filter((note) => note.roam);
    const tags = [...new Set(notes.flatMap((note) => note.tags || []))].sort();
    const data = {
      meta: {
        generatedAt: new Date().toISOString(),
        noteCount: notes.length,
        tagCount: tags.length,
      },
      notes,
    };
    const body = `window.SITE_DATA = ${JSON.stringify(data)};\n`;
    res.writeHead(200, {
      "content-type": "application/javascript; charset=utf-8",
      "content-length": Buffer.byteLength(body),
    });
    res.end(body);
    return true;
  }
  if (url.pathname === "/roam-tools/knowledge.js") {
    await sendTextFile(res, join(publishJsDir, "knowledge.js"), "application/javascript; charset=utf-8");
    return true;
  }
  if (url.pathname === "/roam-tools/graph.js") {
    await sendTextFile(res, join(publishJsDir, "graph.js"), "application/javascript; charset=utf-8");
    return true;
  }
  return false;
}

export async function startAaronnoteServer(options = {}) {
  host = String(options.host || args.host || process.env.AARONNOTE_HOST || "127.0.0.1");
  port = Number(options.port ?? args.port ?? process.env.AARONNOTE_PORT ?? 5179);
  noteRoot = resolve(String(options.root || args.root || process.env.AARONNOTE_ROOT || join(appDir, "..", "roam")));
  noteScanRoot = noteRoot;
  workspaceRoot = resolve(String(options.workspaceRoot || process.env.AARONNOTE_WORKSPACE_ROOT || resolve(appDir, "..")));
  publishJsDir = resolve(String(options.publishJsDir || process.env.AARONNOTE_PUBLISH_JS_DIR || join(workspaceRoot, "js")));
  pluginRoot = resolve(String(options.pluginRoot || process.env.AARONNOTE_PLUGIN_ROOT || join(workspaceRoot, "plugin")));
  const staticDir = options.staticDir || process.env.AARONNOTE_STATIC_DIR;

  let vite;
  const server = createHttpServer(async (req, res) => {
    if ((req.url || "").startsWith("/api/") && await routeApi(req, res)) return;
    if ((req.url || "").startsWith("/kinds/") && await serveKindAsset(req, res)) return;
    if ((req.url || "").startsWith("/roam-tools/") && await routeRoamTools(req, res)) return;
    if (staticDir && await serveStaticFile(req, res, resolve(String(staticDir)))) return;
    if (vite) {
      vite.middlewares(req, res, () => {
        res.statusCode = 404;
        res.end("Not found");
      });
      return;
    }
    res.statusCode = 404;
    res.end("Not found");
  });

  if (!staticDir) {
    const { createServer: createViteServer } = await import("vite");
    vite = await createViteServer({
      configFile: join(appDir, "vite.aaronnote.config.ts"),
      server: {
        middlewareMode: true,
        host,
        hmr: { server },
      },
      appType: "spa",
    });
  }

  await new Promise((resolveListen, rejectListen) => {
    server.once("error", rejectListen);
    server.listen(port, host, resolveListen);
  });
  const address = server.address();
  const actualPort = typeof address === "object" && address ? address.port : port;
  const url = `http://${host}:${actualPort}/`;
  console.log(`Aaronnote root: ${noteRoot}`);
  console.log(`Aaronnote notes: ${noteScanRoot}`);
  console.log(`Aaronnote snippets: ${snippetDirs().join(":") || "(none)"}`);
  console.log(`Aaronnote plugins: ${pluginRoot}`);
  console.log(`Aaronnote URL: ${url}`);
  return {
    server,
    vite,
    host,
    port: actualPort,
    url,
    close: async () => {
      if (roamSyncTimer) {
        clearTimeout(roamSyncTimer);
        roamSyncTimer = null;
        const next = queuedRoamSyncNotes;
        queuedRoamSyncNotes = null;
        if (next) await syncRoamDb(next).catch(() => {});
      }
      copilotClient?.stop?.();
      copilotClient = null;
      roamLookupSession?.close?.("server-close");
      roamLookupSession = null;
      await vite?.close?.();
      await new Promise((resolveClose) => server.close(resolveClose));
    },
  };
}

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  await startAaronnoteServer();
}
