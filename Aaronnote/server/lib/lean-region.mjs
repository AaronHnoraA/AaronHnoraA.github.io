import { readFile, writeFile, mkdir } from "node:fs/promises";
import { dirname } from "node:path";
import { leanMirrorPath } from "./lean-mirror.mjs";

const TAG_RE = /^--[ \t]*@aaronnote[ \t]+([A-Za-z0-9_.:-]+)[ \t]*$/gm;

export function normalizeLeanTag(value) {
  return String(value || "")
    .trim()
    .replace(/^\[|\]$/g, "")
    .replace(/[^A-Za-z0-9_.:-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);
}

export function leanPathForMarkdownNote(notePath, notesRoot) {
  return leanMirrorPath(notePath, notesRoot);
}

export function scanLeanRegions(text) {
  const regions = [];
  const matches = [];
  let match;
  TAG_RE.lastIndex = 0;
  while ((match = TAG_RE.exec(text))) {
    const markerFrom = match.index;
    const markerTo = TAG_RE.lastIndex;
    const bodyFrom = text.slice(markerTo, markerTo + 1) === "\n" ? markerTo + 1 : markerTo;
    matches.push({
      tag: match[1],
      markerFrom,
      markerTo,
      bodyFrom,
    });
  }

  for (let i = 0; i < matches.length; i++) {
    const current = matches[i];
    const next = matches[i + 1];
    const bodyTo = next ? next.markerFrom : text.length;
    regions.push({
      ...current,
      bodyTo,
      body: text.slice(current.bodyFrom, bodyTo),
    });
  }
  return regions;
}

export function findLeanRegion(text, tag) {
  const clean = normalizeLeanTag(tag);
  if (!clean) return null;
  return scanLeanRegions(text).find((region) => region.tag === clean) ?? null;
}

export async function readLeanFile(path) {
  try {
    return await readFile(path, "utf8");
  } catch (err) {
    if (err?.code === "ENOENT") return "";
    throw err;
  }
}

async function writeLeanFile(path, text) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, text, "utf8");
}

function regionInsertOffset(text, { beforeTag, afterTag } = {}) {
  const regions = scanLeanRegions(text);
  const cleanAfter = normalizeLeanTag(afterTag);
  if (cleanAfter) {
    const after = regions.find((region) => region.tag === cleanAfter);
    if (after) return after.markerFrom;
  }

  const cleanBefore = normalizeLeanTag(beforeTag);
  if (cleanBefore) {
    const before = regions.find((region) => region.tag === cleanBefore);
    if (before) return before.bodyTo;
  }

  return text.length;
}

function insertRegionMarker(text, offset, tag) {
  const at = Math.max(0, Math.min(text.length, Number(offset) || 0));
  const before = text.slice(0, at);
  const after = text.slice(at);
  const prefix = before.length === 0 || before.endsWith("\n") ? "" : "\n";
  const marker = `-- @aaronnote ${tag}\n`;
  return `${before}${prefix}${marker}${after}`;
}

export async function ensureLeanRegion({ notePath, notesRoot, tag, beforeTag = "", afterTag = "" }) {
  const cleanTag = normalizeLeanTag(tag);
  if (!cleanTag) throw new Error("Missing Lean tag");
  const leanPath = leanPathForMarkdownNote(notePath, notesRoot);
  const text = await readLeanFile(leanPath);
  const existing = findLeanRegion(text, cleanTag);
  if (existing) return { leanPath, tag: cleanTag, created: false, text, region: existing };

  const offset = regionInsertOffset(text, { beforeTag, afterTag });
  const nextText = insertRegionMarker(text, offset, cleanTag);
  await writeLeanFile(leanPath, nextText);
  const region = findLeanRegion(nextText, cleanTag);
  return { leanPath, tag: cleanTag, created: true, text: nextText, region };
}

export async function readLeanRegion({ notePath, notesRoot, tag, beforeTag = "", afterTag = "" }) {
  const ensured = await ensureLeanRegion({ notePath, notesRoot, tag, beforeTag, afterTag });
  return {
    leanPath: ensured.leanPath,
    tag: ensured.tag,
    text: ensured.text,
    region: ensured.region,
    body: ensured.region?.body ?? "",
    created: ensured.created,
  };
}

export async function updateLeanRegion({ notePath, notesRoot, tag, body }) {
  const ensured = await ensureLeanRegion({ notePath, notesRoot, tag });
  if (!ensured.region) throw new Error("Lean region not found");
  let cleanBody = String(body ?? "");
  if (ensured.region.bodyTo < ensured.text.length && cleanBody && !cleanBody.endsWith("\n")) {
    cleanBody += "\n";
  }
  const before = ensured.text.slice(0, ensured.region.bodyFrom);
  const after = ensured.text.slice(ensured.region.bodyTo);
  const nextText = before + cleanBody + after;
  await writeLeanFile(ensured.leanPath, nextText);
  const region = findLeanRegion(nextText, ensured.tag);
  return {
    leanPath: ensured.leanPath,
    tag: ensured.tag,
    text: nextText,
    region,
    body: region?.body ?? "",
  };
}

export async function deleteLeanRegion({ notePath, notesRoot, tag }) {
  const cleanTag = normalizeLeanTag(tag);
  if (!cleanTag) throw new Error("Missing Lean tag");
  const leanPath = leanPathForMarkdownNote(notePath, notesRoot);
  const text = await readLeanFile(leanPath);
  const region = findLeanRegion(text, cleanTag);
  if (!region) return { leanPath, tag: cleanTag, deleted: false, text, region: null };

  let from = region.markerFrom;
  let to = region.bodyTo;
  if (to < text.length && text[to] === "\n") {
    to += 1;
  } else if (to >= text.length && from > 0 && text[from - 1] === "\n") {
    from -= 1;
  }

  const nextText = text.slice(0, from) + text.slice(to);
  await writeLeanFile(leanPath, nextText);
  return { leanPath, tag: cleanTag, deleted: true, text: nextText, region: null };
}
