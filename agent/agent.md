# Agent Workspace

`agent/` is reserved for AI-maintained structure around the Org knowledge base. It should help agents find, summarize, and update knowledge without disturbing the human note workflow.

## Principles

- The Org files are canonical. Generated index/wiki files must never replace the source notes.
- Keep AI artifacts deterministic and easy to diff.
- Prefer small derived Markdown files over large opaque dumps.
- Keep database access read-only unless the user explicitly asks for a repair.
- Do not commit unrelated user edits. `make llm` stages only `agent.md`, `agent/`, and `Makefile`.
- Keep `project-overview.md` and `growth-log.md` under 500 non-space body characters each.

## Directory Contract

- `index/`: generated indexes for fast lookup by title, path, tag, link, and backlink.
- `wiki/`: generated condensed note pages for quick AI reading.
- `skill/`: AI-usable scripts and maintenance procedures.
- `db/`: database links or database-facing notes. `org-roam.sqlite3` points at the local org-roam DB.
- `project-overview.md`: compact project summary for first-pass context.
- `growth-log.md`: compact natural-language evolution log, rewritten when needed to stay below 500 characters.

## Maintenance Flow

Run:

```sh
make llm
```

This target:

1. Launches `codex exec` with `agent/skill/llm-maintenance.md`.
2. Lets Codex inspect the repository and decide the targeted AI maintenance work.
3. Refreshes or improves `agent/index/`, `agent/wiki/`, and `agent/skill/` as needed.
4. Stages only AI maintenance files by default.
5. Creates a timestamped commit if those files changed.
6. Pushes the current branch.

Lookup:

```sh
make lookup
```

This launches interactive Codex with `agent/skill/lookup.md` in read-only mode. The agent may use `agent/index/` and `agent/wiki/` to find candidate notes, but precise answers must be verified against the original Org files. You may also pass an initial query with `make lookup QUERY="What is a quantum state?"`.

For database inspection, use:

```sh
python3 agent/skill/read_org_roam_db.py summary
python3 agent/skill/read_org_roam_db.py nodes
python3 agent/skill/read_org_roam_db.py links
python3 agent/skill/check_agent_text_limits.py
```

## Update Rules For Agents

- When adding a new index format, implement it in `agent/skill/maintain.py` and document it here.
- When changing the `make llm` behavior, update `agent/skill/llm-maintenance.md`.
- When changing the `make lookup` behavior, update `agent/skill/lookup.md`.
- When adding a new reusable procedure, place it in `agent/skill/` with a short README entry.
- When a generated file becomes too large, split it by domain or path while preserving the top-level index pointer.
- When updating the overview or growth log, rewrite them as compact living context instead of appending indefinitely.
- If the org-roam DB is stale, regenerate it from the editor/org-roam workflow first; do not invent DB rows manually.
