/**
 * .lean/ mirror tree — writes and manages the lean files that mirror .md notes.
 *
 * notes/path/foo.md  →  notesRoot/.lean/path/foo.lean
 */
import { copyFile, mkdir, readFile, rm, stat, writeFile, rename } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, relative, resolve } from "node:path";

/**
 * Compute the .lean mirror path for a given note path and notes root.
 */
export function leanMirrorPath(notePath, notesRoot) {
  const rel = relative(notesRoot, notePath);
  const leanRel = rel.endsWith(".md") ? rel.slice(0, -3) + ".lean" : rel + ".lean";
  return resolve(notesRoot, ".lean", leanRel);
}

/**
 * Compute the mirror directory for a managed note directory.
 */
export function leanMirrorDirPath(dirPath, notesRoot) {
  const rel = relative(notesRoot, dirPath);
  return resolve(notesRoot, ".lean", rel);
}

/**
 * Write the generated lean text to the mirror path, only if content changed.
 * Returns true if a write was performed, false if skipped (same content).
 */
export async function writeMirror(notePath, leanText, notesRoot, options = {}) {
  const dest = leanMirrorPath(notePath, notesRoot);
  const create = options.create !== false;
  if (!create && !existsSync(dest)) return false;
  // check existing content to avoid spurious mtime updates (Lake rebuilds on mtime)
  if (existsSync(dest)) {
    try {
      const existing = await readFile(dest, "utf8");
      if (existing === leanText) return false;
    } catch {}
  }
  await mkdir(dirname(dest), { recursive: true });
  await writeFile(dest, leanText, "utf8");
  return true;
}

/**
 * Delete the .lean mirror for a note (when the note is deleted/trashed).
 */
export async function deleteMirror(notePath, notesRoot) {
  return deleteMirrorPath(notePath, notesRoot, { directory: false });
}

/**
 * Delete the mirror for a managed note path. For directories, this removes the
 * corresponding subtree under .lean/.
 */
export async function deleteMirrorPath(path, notesRoot, options = {}) {
  const dest = options.directory ? leanMirrorDirPath(path, notesRoot) : leanMirrorPath(path, notesRoot);
  try {
    await rm(dest, { force: true, recursive: options.directory === true });
    // clean up empty parent dirs under .lean/
    await pruneEmptyDirs(dirname(dest), resolve(notesRoot, ".lean"));
  } catch {}
}

/**
 * Rename/move the .lean mirror when a note is renamed/moved.
 */
export async function renameMirror(oldNotePath, newNotePath, notesRoot) {
  return renameMirrorPath(oldNotePath, newNotePath, notesRoot, { directory: false });
}

/**
 * Rename/move the mirror for a managed note path. For directories, this moves
 * the corresponding mirror subtree under .lean/.
 */
export async function renameMirrorPath(oldPath, newPath, notesRoot, options = {}) {
  const oldDest = options.directory ? leanMirrorDirPath(oldPath, notesRoot) : leanMirrorPath(oldPath, notesRoot);
  const newDest = options.directory ? leanMirrorDirPath(newPath, notesRoot) : leanMirrorPath(newPath, notesRoot);
  if (!existsSync(oldDest)) return;
  await mkdir(dirname(newDest), { recursive: true });
  await rename(oldDest, newDest);
  await pruneEmptyDirs(dirname(oldDest), resolve(notesRoot, ".lean"));
}

/**
 * Copy the mirror for a managed note file, if it exists.
 */
export async function copyMirrorPath(oldPath, newPath, notesRoot) {
  const oldDest = leanMirrorPath(oldPath, notesRoot);
  const newDest = leanMirrorPath(newPath, notesRoot);
  if (!existsSync(oldDest)) return;
  await mkdir(dirname(newDest), { recursive: true });
  await copyFile(oldDest, newDest);
}

async function pruneEmptyDirs(dir, stopAt) {
  if (dir === stopAt || !dir.startsWith(stopAt)) return;
  try {
    const s = await stat(dir);
    if (!s.isDirectory()) return;
    const { readdir } = await import("node:fs/promises");
    const entries = await readdir(dir);
    if (entries.length > 0) return;
    await rm(dir, { recursive: true, force: true });
    await pruneEmptyDirs(dirname(dir), stopAt);
  } catch {}
}
