#!/usr/bin/env python3
from __future__ import annotations

from dataclasses import dataclass, field
from pathlib import Path
import os
import re
import shutil


ROOT = Path(__file__).resolve().parents[2]
AGENT_DIR = ROOT / "agent"
ROAM_DIR = ROOT / "roam"
INDEX_DIR = AGENT_DIR / "index"
WIKI_DIR = AGENT_DIR / "wiki"
WIKI_NOTES_DIR = WIKI_DIR / "notes"

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


def refresh_wiki_notes_dir() -> None:
    if WIKI_NOTES_DIR.exists():
        shutil.rmtree(WIKI_NOTES_DIR)
    WIKI_NOTES_DIR.mkdir(parents=True, exist_ok=True)


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

    notes = sorted(
        [parse_note(path) for path in ROAM_DIR.rglob("*.org")],
        key=lambda note: note.rel_path.lower(),
    )
    notes_by_id = {note.id: note for note in notes if note.id}
    backlinks = build_backlinks(notes)

    refresh_wiki_notes_dir()
    write(INDEX_DIR / "README.md", render_index_readme(notes))
    write(INDEX_DIR / "org-roam-index.md", render_org_roam_index(notes, backlinks))
    write(INDEX_DIR / "tags.md", render_tags(notes))
    write(INDEX_DIR / "graph.md", render_graph(notes, backlinks))
    write(WIKI_DIR / "README.md", render_wiki_readme(notes))

    for note in notes:
        write(note.wiki_path, render_wiki_note(note, notes_by_id, backlinks))

    print(f"Indexed {len(notes)} org-roam notes into {INDEX_DIR.relative_to(ROOT)} and {WIKI_DIR.relative_to(ROOT)}.")


if __name__ == "__main__":
    main()
