/**
 * .lean/ mirror tree — writes and manages the lean files that mirror .md notes.
 *
 * notes/path/foo.md  →  notesRoot/.lean/path/foo.lean
 */
import { mkdir, readFile, rm, stat, writeFile, rename } from "node:fs/promises";
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
 * Write the generated lean text to the mirror path, only if content changed.
 * Returns true if a write was performed, false if skipped (same content).
 */
export async function writeMirror(notePath, leanText, notesRoot) {
  const dest = leanMirrorPath(notePath, notesRoot);
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
  const dest = leanMirrorPath(notePath, notesRoot);
  try {
    await rm(dest, { force: true });
    // clean up empty parent dirs under .lean/
    await pruneEmptyDirs(dirname(dest), resolve(notesRoot, ".lean"));
  } catch {}
}

/**
 * Rename/move the .lean mirror when a note is renamed/moved.
 */
export async function renameMirror(oldNotePath, newNotePath, notesRoot) {
  const oldDest = leanMirrorPath(oldNotePath, notesRoot);
  const newDest = leanMirrorPath(newNotePath, notesRoot);
  if (!existsSync(oldDest)) return;
  await mkdir(dirname(newDest), { recursive: true });
  await rename(oldDest, newDest);
  await pruneEmptyDirs(dirname(oldDest), resolve(notesRoot, ".lean"));
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
