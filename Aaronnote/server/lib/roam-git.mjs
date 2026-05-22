import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { writeFile } from "node:fs/promises";
import { relative, resolve, sep } from "node:path";

const execFileAsync = promisify(execFile);

const MAX_BUFFER = 1024 * 1024 * 4;

async function git(noteRoot, args) {
  const { stdout } = await execFileAsync("git", ["-C", noteRoot, ...args], {
    maxBuffer: MAX_BUFFER,
  });
  return stdout.trim();
}

// Resolves the git repository root from noteRoot (follows symlinks via git itself).
// Cached by noteRoot value — invalidated automatically when noteRoot changes.
let cachedGitRootKey = null;
let cachedGitRootValue = null;
async function gitRoot(noteRoot) {
  if (cachedGitRootKey !== noteRoot) {
    cachedGitRootValue = await git(noteRoot, ["rev-parse", "--show-toplevel"]);
    cachedGitRootKey = noteRoot;
  }
  return cachedGitRootValue;
}

// Resolves a git-output path (relative to git root) to an absolute path,
// then returns it only if it lives inside noteRoot.
async function resolveGitPath(noteRoot, gitRelPath) {
  const root = await gitRoot(noteRoot);
  const abs = resolve(root, gitRelPath);
  // Must be inside noteRoot (which may be a symlink; git resolves real paths)
  const noteRootReal = resolve(noteRoot);
  return (abs === noteRootReal || abs.startsWith(noteRootReal + sep)) ? abs : null;
}

// Returns current HEAD sha, or null if not in a git repo / no commits yet.
export async function headSha(noteRoot) {
  try {
    return await git(noteRoot, ["rev-parse", "HEAD"]);
  } catch {
    return null;
  }
}

// Returns absolute paths of roam .md/.markdown files that changed since `commit`.
// Covers both committed changes (diff against HEAD) and uncommitted working tree changes.
// Returns null to signal "fall back to full rebuild" (bad commit ref or not a repo).
export async function changedRoamFilesSince(noteRoot, commit) {
  if (!commit) return null;

  const mdPattern = /\.(?:md|markdown)$/i;
  const paths = new Set();

  // Committed changes since the recorded commit
  // git diff --name-only outputs paths relative to git root, not cwd
  try {
    const out = await git(noteRoot, [
      "diff", "--name-only", "--diff-filter=AMRCD", commit, "HEAD", "--",
    ]);
    for (const line of out.split("\n")) {
      const p = line.trim();
      if (!p || !mdPattern.test(p)) continue;
      const abs = await resolveGitPath(noteRoot, p);
      if (abs) paths.add(abs);
    }
  } catch {
    // commit no longer exists (e.g. after rebase/squash) — signal full rebuild
    return null;
  }

  // Uncommitted working-tree + index changes
  // git status --porcelain also outputs paths relative to git root
  try {
    const out = await git(noteRoot, ["status", "--porcelain", "--"]);
    for (const line of out.split("\n")) {
      // format: "XY path"  or  "XY old -> new"
      const raw = line.slice(3).trim();
      const p = raw.includes(" -> ") ? raw.split(" -> ")[1] : raw;
      if (!p || !mdPattern.test(p)) continue;
      const abs = await resolveGitPath(noteRoot, p.replace(/"/g, ""));
      if (abs) paths.add(abs);
    }
  } catch {
    // not fatal — working tree status is best-effort
  }

  return [...paths];
}

// Stages all changes in noteRoot and commits if there are staged changes.
// Scoped to noteRoot via "." pathspec — never touches unrelated staged changes.
// .gitignore handles exclusions (roam.db, .aaronnote-sync-state.json, etc.).
// Returns the new HEAD sha (or current HEAD if nothing was committed).
export async function commitRoam(noteRoot, message) {
  try {
    await git(noteRoot, ["add", "--", "."]);
  } catch {
    // not fatal if nothing to stage
  }

  // Check staged changes scoped to noteRoot ("." = cwd = noteRoot with -C)
  try {
    await git(noteRoot, ["diff", "--cached", "--quiet", "--", "."]);
    // exit 0 → nothing staged → nothing to commit
    return headSha(noteRoot);
  } catch {
    // Non-zero exit = staged changes exist
    try {
      // Commit scoped to noteRoot so unrelated staged changes in parent repo are left alone
      await git(noteRoot, ["commit", "-m", message, "--", "."]);
    } catch (err) {
      // Non-fatal: git user not configured, nothing to commit after scope filter, etc.
      console.warn("[roam-git] commit failed:", err?.message);
    }
  }

  return headSha(noteRoot);
}

// Returns { branch, ahead, behind, uncommitted, remoteUrl } for the roam repo.
export async function roamRepoStatus(noteRoot) {
  let branch = "", ahead = 0, behind = 0, uncommitted = false, remoteUrl = "";
  try {
    branch = await git(noteRoot, ["rev-parse", "--abbrev-ref", "HEAD"]);
  } catch {}
  try {
    remoteUrl = await git(noteRoot, ["config", "--get", "remote.origin.url"]);
  } catch {}
  if (remoteUrl) {
    try {
      await git(noteRoot, ["fetch", "--quiet"]);
    } catch {}
    try {
      const aheadBehind = await git(noteRoot, [
        "rev-list", "--left-right", "--count", `${branch}...origin/${branch}`,
      ]);
      const [a, b] = aheadBehind.split("\t").map(Number);
      ahead = a || 0;
      behind = b || 0;
    } catch {}
  }
  try {
    const out = await git(noteRoot, ["status", "--porcelain", "--"]);
    uncommitted = out.split("\n").some((l) => {
      const f = l.slice(3).trim();
      return f && /\.(?:md|markdown)$/i.test(f);
    });
  } catch {}
  return { branch, ahead, behind, uncommitted, hasRemote: Boolean(remoteUrl), remoteUrl };
}

// Push roam repo to origin. Throws if no remote or push fails.
export async function pushRoam(noteRoot) {
  return git(noteRoot, ["push", "origin", "HEAD"]);
}

// Returns recent commits for the entire roam repo.
// Each entry: { sha, date, subject, files }
export async function repoHistory(noteRoot, limit = 30) {
  try {
    const out = await git(noteRoot, [
      "log", `--format=%H\t%cI\t%s`, `-n`, String(limit),
    ]);
    if (!out) return [];
    return out.split("\n").filter(Boolean).map((line) => {
      const [sha, date, ...rest] = line.split("\t");
      return { sha, date, subject: rest.join("\t") };
    });
  } catch {
    return [];
  }
}

// Returns recent commits that touched the given absolute file path.
// Each entry: { sha, date, subject }
export async function fileHistory(noteRoot, absFile, limit = 20) {
  // git log path args are relative to cwd (-C noteRoot), which git converts
  // to git-root-relative internally — this works correctly.
  const rel = relative(noteRoot, absFile);
  if (!rel || rel.startsWith("..")) return [];
  try {
    const out = await git(noteRoot, [
      "log", `--format=%H\t%cI\t%s`, `-n`, String(limit), "--", rel,
    ]);
    if (!out) return [];
    return out.split("\n").filter(Boolean).map((line) => {
      const [sha, date, ...rest] = line.split("\t");
      return { sha, date, subject: rest.join("\t") };
    });
  } catch {
    return [];
  }
}

// Restores the file at absFile to its contents at the given commit sha.
// Writes directly to the working tree; does NOT modify the git index.
export async function restoreFileFromCommit(noteRoot, absFile, sha) {
  const rel = relative(noteRoot, absFile);
  if (!rel || rel.startsWith("..")) throw new Error(`File outside noteRoot: ${absFile}`);
  // git show <sha>:<path> — path must be relative to git root.
  const root = await gitRoot(noteRoot);
  const gitRel = relative(root, absFile);
  const content = await git(noteRoot, ["show", `${sha}:${gitRel}`]);
  await writeFile(absFile, content, "utf8");
}
