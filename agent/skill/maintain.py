#!/usr/bin/env python3
from __future__ import annotations

from dataclasses import dataclass, field
import json
from pathlib import Path
import os
import re
import random
import shutil
import subprocess


ROOT = Path(__file__).resolve().parents[2]
AGENT_DIR = ROOT / "agent"
ROAM_DIR = ROOT / "roam"
INDEX_DIR = AGENT_DIR / "index"
WIKI_DIR = AGENT_DIR / "wiki"
WIKI_NOTES_DIR = WIKI_DIR / "notes"
STATE_DIR = AGENT_DIR / ".state"
STATE_FILE = STATE_DIR / "maintain-state.json"
DEFAULT_SAMPLE_RATIO = 0.15
DEFAULT_MIN_SAMPLE = 1

TITLE_RE = re.compile(r"^#\+title:\s*(.+)$", re.IGNORECASE)
DATE_RE = re.compile(r"^#\+date:\s*(.+)$", re.IGNORECASE)
FILETAGS_RE = re.compile(r"^#\+filetags:\s*(.+)$", re.IGNORECASE)
ID_RE = re.compile(r"^:ID:\s*(.+)$", re.IGNORECASE)
HEADING_RE = re.compile(r"^(\*+)\s+(.+)$")
ID_LINK_RE = re.compile(r"\[\[id:([^\]]+)\](?:\[([^\]]*)\])?\]")
ORG_LINK_RE = re.compile(r"\[\[(?:id:|file:)?[^\]]+\](?:\[([^\]]+)\])?\]")


@dataclass
class Note:
    path: Path
    rel_path: str
    wiki_path: Path
    id: str = ""
    title: str = ""
    date: str = ""
    tags: list[str] = field(default_factory=list)
    headings: list[tuple[int, str]] = field(default_factory=list)
    summary: str = ""
    outgoing_ids: list[str] = field(default_factory=list)

    def to_state(self) -> dict[str, object]:
        return {
            "path": self.path.as_posix(),
            "rel_path": self.rel_path,
            "wiki_path": self.wiki_path.as_posix(),
            "id": self.id,
            "title": self.title,
            "date": self.date,
            "tags": self.tags,
            "headings": self.headings,
            "summary": self.summary,
            "outgoing_ids": self.outgoing_ids,
        }

    @classmethod
    def from_state(cls, data: dict[str, object]) -> "Note":
        return cls(
            path=Path(str(data["path"])),
            rel_path=str(data["rel_path"]),
            wiki_path=Path(str(data["wiki_path"])),
            id=str(data.get("id", "")),
            title=str(data.get("title", "")),
            date=str(data.get("date", "")),
            tags=[str(tag) for tag in data.get("tags", [])],
            headings=[(int(level), str(title)) for level, title in data.get("headings", [])],
            summary=str(data.get("summary", "")),
            outgoing_ids=[str(item) for item in data.get("outgoing_ids", [])],
        )


def clean_org_markup(text: str) -> str:
    text = ORG_LINK_RE.sub(lambda match: match.group(1) or "", text)
    text = text.replace("*", "").replace("~", "")
    return " ".join(text.split())


def parse_tags(raw: str) -> list[str]:
    raw = raw.strip()
    if raw.startswith(":") and raw.endswith(":"):
        return [part for part in raw.strip(":").split(":") if part]
    return [part.strip(" :") for part in raw.split(",") if part.strip(" :")]


def unique(values: list[str]) -> list[str]:
    seen: set[str] = set()
    result: list[str] = []
    for value in values:
        if value and value not in seen:
            seen.add(value)
            result.append(value)
    return result


def wiki_path_for(org_path: Path) -> Path:
    rel = org_path.relative_to(ROAM_DIR).with_suffix(".md")
    return WIKI_NOTES_DIR / rel


def parse_note(path: Path) -> Note:
    rel_path = path.relative_to(ROOT).as_posix()
    text = path.read_text(encoding="utf-8")
    lines = text.splitlines()
    note = Note(path=path, rel_path=rel_path, wiki_path=wiki_path_for(path))

    in_drawer = False
    in_block = False
    in_latex = False
    summary_done = False
    summary_parts: list[str] = []
    outgoing_ids: list[str] = []

    for line in lines:
        stripped = line.strip()
        lower = stripped.lower()

        if stripped == ":PROPERTIES:":
            in_drawer = True
        elif stripped == ":END:" and in_drawer:
            in_drawer = False

        id_match = ID_RE.match(stripped)
        if id_match:
            note.id = id_match.group(1).strip()

        title_match = TITLE_RE.match(stripped)
        if title_match:
            note.title = clean_org_markup(title_match.group(1).strip())

        date_match = DATE_RE.match(stripped)
        if date_match:
            note.date = date_match.group(1).strip()

        tags_match = FILETAGS_RE.match(stripped)
        if tags_match:
            note.tags = parse_tags(tags_match.group(1))

        heading_match = HEADING_RE.match(line)
        if heading_match:
            level = len(heading_match.group(1))
            title = clean_org_markup(heading_match.group(2))
            note.headings.append((level, title))

        outgoing_ids.extend(match.group(1).strip() for match in ID_LINK_RE.finditer(line))

        if lower.startswith("#+begin_"):
            in_block = True
            continue
        if lower.startswith("#+end_"):
            in_block = False
            continue
        if stripped.startswith(r"\begin{"):
            in_latex = True
            continue
        if stripped.startswith(r"\end{"):
            in_latex = False
            continue
        if summary_done:
            continue
        if in_drawer or in_block:
            continue
        if in_latex:
            continue
        if not stripped or stripped.startswith("#+") or stripped.startswith(":"):
            continue
        if stripped.startswith("|"):
            continue
        if heading_match:
            continue

        cleaned = clean_org_markup(stripped)
        if cleaned:
            summary_parts.append(cleaned)
        if len(" ".join(summary_parts)) >= 420:
            summary_done = True

    note.title = note.title or path.stem.replace("_", " ").title()
    note.summary = truncate(" ".join(summary_parts), 420)
    note.outgoing_ids = unique(outgoing_ids)
    return note


def truncate(text: str, limit: int) -> str:
    if len(text) <= limit:
        return text
    return text[: limit - 1].rstrip() + "..."


def md_escape(text: str) -> str:
    return text.replace("|", "\\|").replace("\n", " ")


def rel_link(from_file: Path, to_file: Path) -> str:
    return os.path.relpath(to_file, start=from_file.parent).replace(os.sep, "/")


def note_link(from_file: Path, note: Note) -> str:
    return f"[{note.title}]({rel_link(from_file, note.wiki_path)})"


def source_link(from_file: Path, note: Note) -> str:
    return f"[{note.rel_path}]({rel_link(from_file, note.path)})"


def build_backlinks(notes: list[Note]) -> dict[str, list[Note]]:
    by_id = {note.id: note for note in notes if note.id}
    backlinks: dict[str, list[Note]] = {note.id: [] for note in notes if note.id}
    for note in notes:
        for target_id in note.outgoing_ids:
            if target_id in by_id and note not in backlinks[target_id]:
                backlinks[target_id].append(note)
    return backlinks


def write(path: Path, content: str) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(content.rstrip() + "\n", encoding="utf-8")


def write_if_changed(path: Path, content: str) -> bool:
    normalized = content.rstrip() + "\n"
    if path.exists() and path.read_text(encoding="utf-8") == normalized:
        return False
    write(path, normalized)
    return True


def current_head() -> str:
    try:
        result = subprocess.run(
            ["git", "rev-parse", "HEAD"],
            cwd=ROOT,
            check=True,
            capture_output=True,
            text=True,
        )
    except (OSError, subprocess.CalledProcessError):
        return ""
    return result.stdout.strip()


def load_state() -> dict[str, object]:
    if not STATE_FILE.exists():
        return {}
    data = json.loads(STATE_FILE.read_text(encoding="utf-8"))
    return data if isinstance(data, dict) else {}


def load_note_cache() -> dict[str, dict[str, object]]:
    state = load_state()
    notes = state.get("notes", {})
    return notes if isinstance(notes, dict) else {}


def save_state(notes: list[Note], fingerprints: dict[str, dict[str, int]], last_head: str) -> None:
    STATE_DIR.mkdir(parents=True, exist_ok=True)
    payload = {
        "last_head": last_head,
        "notes": {
            note.rel_path: {
                "fingerprint": fingerprints[note.rel_path],
                "note": note.to_state(),
            }
            for note in notes
        }
    }
    write(STATE_FILE, json.dumps(payload, indent=2, sort_keys=True))


def fingerprint(path: Path) -> dict[str, int]:
    stat = path.stat()
    return {"mtime_ns": stat.st_mtime_ns, "size": stat.st_size}


def sample_ratio() -> float:
    raw = os.environ.get("AGENT_MAINTAIN_SAMPLE_RATIO", "").strip()
    if not raw:
        return DEFAULT_SAMPLE_RATIO
    try:
        value = float(raw)
    except ValueError:
        return DEFAULT_SAMPLE_RATIO
    return max(0.0, min(1.0, value))


def min_sample() -> int:
    raw = os.environ.get("AGENT_MAINTAIN_MIN_SAMPLE", "").strip()
    if not raw:
        return DEFAULT_MIN_SAMPLE
    try:
        value = int(raw)
    except ValueError:
        return DEFAULT_MIN_SAMPLE
    return max(0, value)


def choose_sample(paths: list[Path]) -> set[Path]:
    if not paths:
        return set()
    count = max(min_sample(), int(len(paths) * sample_ratio()))
    count = min(len(paths), count)
    if count == 0:
        return set()
    return set(random.sample(paths, count))


def parse_changed_paths(output: str) -> set[str]:
    changed: set[str] = set()
    for raw_line in output.splitlines():
        line = raw_line.rstrip()
        if not line:
            continue
        path_text = line[3:] if len(line) > 3 and line[1] == " " else line
        if " -> " in path_text:
            path_text = path_text.split(" -> ", 1)[1]
        if not path_text.endswith(".org"):
            continue
        if not (path_text.startswith("roam/") or path_text.startswith("daily/")):
            continue
        changed.add(path_text)
    return changed


def git_changed_org_paths(last_head: str) -> set[str]:
    changed: set[str] = set()

    if last_head:
        try:
            committed = subprocess.run(
                ["git", "diff", "--name-only", f"{last_head}..HEAD", "--", "roam", "daily"],
                cwd=ROOT,
                check=True,
                capture_output=True,
                text=True,
            )
            changed.update(parse_changed_paths(committed.stdout))
        except (OSError, subprocess.CalledProcessError):
            pass

    try:
        working = subprocess.run(
            ["git", "status", "--short", "--untracked-files=all", "--", "roam", "daily"],
            cwd=ROOT,
            check=True,
            capture_output=True,
            text=True,
        )
    except (OSError, subprocess.CalledProcessError):
        return changed

    changed.update(parse_changed_paths(working.stdout))
    return changed


def load_notes(paths: list[Path]) -> tuple[list[Note], list[str], int]:
    state = load_state()
    previous = load_note_cache()
    path_by_rel = {path.relative_to(ROOT).as_posix(): path for path in paths}
    unchanged_candidates: list[Path] = []
    notes_by_rel: dict[str, Note] = {}
    fingerprints: dict[str, dict[str, int]] = {}
    reparsed = 0
    last_head = str(state.get("last_head", ""))
    git_changed = git_changed_org_paths(last_head)
    head = current_head()

    for rel_path, path in path_by_rel.items():
        current_fp = fingerprint(path)
        fingerprints[rel_path] = current_fp
        previous_entry = previous.get(rel_path)
        changed_in_git = rel_path in git_changed
        if (
            not changed_in_git
            and previous_entry
            and isinstance(previous_entry, dict)
            and previous_entry.get("fingerprint") == current_fp
            and "note" in previous_entry
        ):
            unchanged_candidates.append(path)
        else:
            notes_by_rel[rel_path] = parse_note(path)
            reparsed += 1

    sampled = choose_sample(unchanged_candidates)
    for path in unchanged_candidates:
        rel_path = path.relative_to(ROOT).as_posix()
        previous_entry = previous[rel_path]
        if path in sampled:
            notes_by_rel[rel_path] = parse_note(path)
            reparsed += 1
        else:
            notes_by_rel[rel_path] = Note.from_state(previous_entry["note"])

    deleted = sorted(set(previous) - set(path_by_rel))
    notes = sorted(notes_by_rel.values(), key=lambda note: note.rel_path.lower())
    save_state(notes, fingerprints, head)
    return notes, deleted, reparsed


def render_index_readme(notes: list[Note]) -> str:
    return "\n".join(
        [
            "# Agent Index",
            "",
            "Generated by `python3 agent/skill/maintain.py`.",
            "",
            f"- Notes indexed: {len(notes)}",
            "- Main index: `org-roam-index.md`",
            "- Tag index: `tags.md`",
            "- Link graph: `graph.md`",
        ]
    )


def render_org_roam_index(notes: list[Note], backlinks: dict[str, list[Note]]) -> str:
    lines = [
        "# Org Roam Index",
        "",
        "| Title | Path | Tags | Summary |",
        "| --- | --- | --- | --- |",
    ]
    index_file = INDEX_DIR / "org-roam-index.md"
    for note in notes:
        tags = ", ".join(note.tags)
        lines.append(
            f"| {md_escape(note.title)} | {source_link(index_file, note)} | {md_escape(tags)} | {md_escape(note.summary)} |"
        )

    lines.extend(["", "## Note Links", ""])
    by_id = {note.id: note for note in notes if note.id}
    for note in notes:
        outgoing = [by_id[target_id] for target_id in note.outgoing_ids if target_id in by_id]
        incoming = backlinks.get(note.id, []) if note.id else []
        lines.append(f"### {note.title}")
        lines.append(f"- Source: {source_link(index_file, note)}")
        lines.append(f"- Wiki: {note_link(index_file, note)}")
        lines.append(
            "- Outgoing: "
            + (", ".join(note_link(index_file, target) for target in outgoing) if outgoing else "None")
        )
        lines.append(
            "- Backlinks: "
            + (", ".join(note_link(index_file, source) for source in incoming) if incoming else "None")
        )
        lines.append("")
    return "\n".join(lines)


def render_tags(notes: list[Note]) -> str:
    tags: dict[str, list[Note]] = {}
    for note in notes:
        for tag in note.tags:
            tags.setdefault(tag, []).append(note)

    tag_file = INDEX_DIR / "tags.md"
    lines = ["# Tags", ""]
    for tag in sorted(tags, key=str.lower):
        lines.append(f"## {tag}")
        for note in sorted(tags[tag], key=lambda item: item.title.lower()):
            lines.append(f"- {note_link(tag_file, note)}")
        lines.append("")
    return "\n".join(lines)


def render_graph(notes: list[Note], backlinks: dict[str, list[Note]]) -> str:
    graph_file = INDEX_DIR / "graph.md"
    by_id = {note.id: note for note in notes if note.id}
    lines = ["# Link Graph", "", "## Edges", ""]
    edge_count = 0
    for note in notes:
        for target_id in note.outgoing_ids:
            target = by_id.get(target_id)
            if not target:
                continue
            lines.append(f"- {note_link(graph_file, note)} -> {note_link(graph_file, target)}")
            edge_count += 1
    if edge_count == 0:
        lines.append("- None")

    lines.extend(["", "## Backlink Counts", ""])
    for note in notes:
        count = len(backlinks.get(note.id, [])) if note.id else 0
        lines.append(f"- {note_link(graph_file, note)}: {count}")
    return "\n".join(lines)


def render_wiki_readme(notes: list[Note]) -> str:
    wiki_file = WIKI_DIR / "README.md"
    lines = [
        "# Agent Wiki",
        "",
        "Condensed Markdown views generated from Org notes. These files are for fast AI lookup; edit the source Org files instead.",
        "",
        "## Notes",
        "",
    ]
    for note in notes:
        lines.append(f"- {note_link(wiki_file, note)}")
    return "\n".join(lines)


def render_wiki_note(note: Note, notes_by_id: dict[str, Note], backlinks: dict[str, list[Note]]) -> str:
    lines = [
        f"# {note.title}",
        "",
        f"- Source: {source_link(note.wiki_path, note)}",
        f"- ID: `{note.id or 'missing'}`",
        f"- Date: {note.date or 'unknown'}",
        f"- Tags: {', '.join(note.tags) if note.tags else 'None'}",
        "",
        "## Summary",
        "",
        note.summary or "No body summary found.",
        "",
        "## Structure",
        "",
    ]

    if note.headings:
        for level, heading in note.headings[:24]:
            indent = "  " * max(level - 1, 0)
            lines.append(f"{indent}- {heading}")
    else:
        lines.append("- No headings found.")

    lines.extend(["", "## Links", ""])
    outgoing = [notes_by_id[target_id] for target_id in note.outgoing_ids if target_id in notes_by_id]
    if outgoing:
        for target in outgoing:
            lines.append(f"- {note_link(note.wiki_path, target)}")
    else:
        lines.append("- None")

    lines.extend(["", "## Backlinks", ""])
    incoming = backlinks.get(note.id, []) if note.id else []
    if incoming:
        for source in incoming:
            lines.append(f"- {note_link(note.wiki_path, source)}")
    else:
        lines.append("- None")

    return "\n".join(lines)


def main() -> None:
    INDEX_DIR.mkdir(parents=True, exist_ok=True)
    WIKI_DIR.mkdir(parents=True, exist_ok=True)
    WIKI_NOTES_DIR.mkdir(parents=True, exist_ok=True)

    note_paths = sorted(ROAM_DIR.rglob("*.org"))
    notes, deleted, reparsed = load_notes(note_paths)
    notes_by_id = {note.id: note for note in notes if note.id}
    backlinks = build_backlinks(notes)

    for rel_path in deleted:
        stale_wiki = WIKI_NOTES_DIR / Path(rel_path).relative_to("roam").with_suffix(".md")
        if stale_wiki.exists():
            stale_wiki.unlink()

    write_if_changed(INDEX_DIR / "README.md", render_index_readme(notes))
    write_if_changed(INDEX_DIR / "org-roam-index.md", render_org_roam_index(notes, backlinks))
    write_if_changed(INDEX_DIR / "tags.md", render_tags(notes))
    write_if_changed(INDEX_DIR / "graph.md", render_graph(notes, backlinks))
    write_if_changed(WIKI_DIR / "README.md", render_wiki_readme(notes))

    for note in notes:
        write_if_changed(note.wiki_path, render_wiki_note(note, notes_by_id, backlinks))

    print(
        "Indexed "
        f"{len(notes)} org-roam notes into {INDEX_DIR.relative_to(ROOT)} and {WIKI_DIR.relative_to(ROOT)}. "
        f"Reparsed {reparsed} notes; reused cache for {len(notes) - reparsed}; removed {len(deleted)} deleted notes."
    )


if __name__ == "__main__":
    main()
