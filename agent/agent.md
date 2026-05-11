# Agent Workspace

`agent/` is the AI-maintained navigation layer for Aaron's Typst note system. It helps agents find, summarize, and update knowledge without disturbing the human writing workflow.

## Principles

- Typst files are canonical. Generated index/wiki files must never replace source notes.
- Note identity comes from `#metadata((kind: "note", id: ..., title: ..., tags: ...)) <note>`.
- Links come from `#note("id")[Title]`.
- Keep derived Markdown deterministic and easy to diff.
- Do not commit unrelated user edits.
- Keep `project-overview.md` and `growth-log.md` compact.

## Directory Contract

- `index/`: generated indexes for fast lookup by title, path, tag, link, and backlink. Existing generated files are left as-is until the Typst index refresh is handled separately.
- `wiki/`: generated condensed note pages for quick AI reading.
- `skill/`: AI-usable scripts and maintenance procedures.
- `develop.md`: temporary development gate and vote ledger for autonomous tooling changes.

## Maintenance Flow

Run:

```sh
make llm
```

Lookup:

```sh
make lookup QUERY="What is a quantum state?"
```

The lookup agent may use `agent/index/` and `agent/wiki/` to find candidate notes, but precise answers must be verified against original `.typ` files.

Useful checks:

```sh
python3 agent/skill/maintain.py
python3 agent/skill/check_agent_text_limits.py
```
